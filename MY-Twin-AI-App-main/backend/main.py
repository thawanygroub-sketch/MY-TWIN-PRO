import os, asyncio, logging, json
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Any

# ✅ إعداد Sentry مبكراً (قبل أي شيء)
try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration

    sentry_sdk.init(
        dsn=os.getenv("SENTRY_DSN", ""),
        integrations=[FastApiIntegration(transaction_style="endpoint")],
        traces_sample_rate=0.3,
        environment=os.getenv("ENVIRONMENT", "production"),
    )
except Exception:
    pass

from fastapi import FastAPI, HTTPException, Request, Depends, Header
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from slowapi.errors import RateLimitExceeded
from supabase import create_client, Client

from twin_brain import TwinBrain
from rate_limiter import limiter, rate_limit_exceeded_handler
from cache import get as cache_get, set as cache_set
from multi_ai import AIUnavailable
from consciousness_core import ConsciousnessCore
from message_limits import (
    check_message_limit, check_tok, check_feature_usage,
    get_usage_summary, get_tier_features, activate_referral_bonus,
    add_referral_tok_bonus
)
from tools.external_services import (
    search_youtube, search_spotify, get_weather,
    get_todoist_tasks, get_calendar_events,
    get_news, get_location_info, get_knowledge,
    search_google, get_currency, home_assistant_control,
    send_email, send_telegram, get_notes, create_note,
    get_tasks, create_task, get_maps
)
from telegram_webhook import router as telegram_router, setup_webhook
from referral import generate_referral_code, activate_referral
from proactive_engine import proactive_engine
from dream_engine import analyze_dream
from growth_tracker import get_growth_history
from response_validator import response_validator

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mytwin")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
CRON_SECRET_KEY = os.getenv("CRON_SECRET_KEY", "")

if not all([SUPABASE_URL, SUPABASE_KEY]):
    raise RuntimeError("Missing required env vars")

db: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
brain = TwinBrain(GEMINI_KEY)
consciousness = ConsciousnessCore(twin_name="MyTwin")

ALLOWED_ORIGINS = [
    "https://mytwin.app",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1:19006",
    "exp://192.168.1.1:19000"
]

app = FastAPI(title="MyTwin API", version="10.6.0")
app.include_router(telegram_router)

@app.on_event("startup")
async def startup_event():
    await setup_webhook()

app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["*"], allow_headers=["*"], allow_credentials=True)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

def get_user(auth: str = Header(default=None, alias="Authorization")) -> Optional[str]:
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(401, "unauthorized")
    token = auth[7:].strip()
    try:
        user_resp = db.auth.get_user(token)
        if not user_resp.user or not user_resp.user.id:
            raise HTTPException(401, "unauthorized")
        return user_resp.user.id
    except Exception as e:
        logger.warning(f"Auth failed: {e}")
        raise HTTPException(401, "unauthorized")

def get_profile(uid: str) -> dict:
    k = f"p:{uid}"
    if c := cache_get(k): return c
    try:
        r = db.table("profiles").select("*").eq("id", uid).maybeSingle().execute()
        p = r.data or {}
        cache_set(k, p, 600)
        return p
    except Exception as e:
        logger.error(f"Profile fetch failed: {e}")
        return {}

class ChatReq(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    twin_name: str = Field("توأمك")
    bond_level: float = Field(0.0)
    relationship_dims: dict = Field(default_factory=dict)
    history: list = Field(default_factory=list)

class ReferralCodeReq(BaseModel):
    code: str = Field(..., min_length=2, max_length=20)

# ========== المحادثة ==========
@app.post("/api/chat")
@limiter.limit("30/minute")
async def chat(
    request: Request,
    body: ChatReq,
    uid: str = Depends(get_user),
    calm: str = Header("false"),
    x_country_code: str = Header("SA"),
    x_twin_gender: str = Header("female")
):
    is_calm = calm.lower() == "true"
    country_code = x_country_code or "SA"
    p = get_profile(uid)
    tier = p.get("tier", "free")
    signup_date = p.get("created_at")

    from safety_engine import safety_engine
    safety_check = safety_engine.check_safety(body.message)
    if not safety_check["safe"] and safety_check["severity"] == "critical":
        return {"reply": safety_engine.HELPLINE_MESSAGE, "safety_alert": True, "provider": "safety_engine"}

    allowed, remaining, reason = check_message_limit(uid, tier, signup_date)
    if not allowed:
        await proactive_engine.trigger_daily_limit_notification(uid, tier, p.get("lang", "ar"))
        return JSONResponse(status_code=429, content={"reply": "استنفدت طاقتي اليومية 💜", "limit_reached": True, "remaining": 0})

    res = {}
    try:
        res = await brain.respond(
            message=body.message, twin_name=body.twin_name, bond_level=body.bond_level,
            dims=body.relationship_dims, memories=[], history=body.history[-10:],
            calm=is_calm, personality=None, country_code=country_code,
            user_id=uid, tier=tier, join_date=signup_date,
            recent_messages=[h.get("content", "") for h in body.history[-20:] if isinstance(h, dict)],
            user_profile=p
        )
        if not isinstance(res, dict):
            res = {"reply": "حدث خطأ تقني مؤقت 💜", "provider": "error_handler"}
    except AIUnavailable:
        res = {"reply": "أواجه ضغطاً تقنياً مؤقتاً 💜", "provider": "fallback"}
    except Exception as e:
        logger.error(f"Critical Brain Error: {e}")
        res = {"reply": "أواجه ضغطاً تقنياً 💜", "provider": "exception_handler"}

    validation = response_validator.validate(reply=res.get("reply", ""))
    if validation.get("repaired"):
        res["reply"] = validation.get("final_reply", res.get("reply", ""))

    try:
        db.table("profiles").update({"last_active": datetime.now(timezone.utc).isoformat()}).eq("id", uid).execute()
    except:
        pass

    return {
        "reply": res.get("reply", "..."),
        "new_bond": res.get("new_bond", 0),
        "emotion": res.get("emotion", {}),
        "provider": res.get("provider", "unknown"),
        "latency_ms": res.get("latency_ms", 0),
        "journey_phase": res.get("journey_phase"),
        "journey_day": res.get("journey_day"),
        "attachment_style": res.get("attachment_style"),
        "relationship_dims": res.get("relationship_dims", {}),
        "energy": res.get("energy"),
    }

# ========== الإحالة ==========
@app.post("/api/referral/generate")
async def generate_referral(uid: str = Depends(get_user)):
    code = generate_referral_code(uid)
    return {"code": code}

@app.post("/api/referral/activate")
async def activate_referral_endpoint(body: ReferralCodeReq, uid: str = Depends(get_user)):
    result = activate_referral(uid, body.code)
    if result.get("success"):
        inviter_id = result.get("inviter_id")
        if inviter_id:
            add_referral_tok_bonus(inviter_id)
            add_referral_tok_bonus(uid)
            activate_referral_bonus(uid)
        return {"success": True, "bonus": 500}
    raise HTTPException(400, result.get("error", "invalid_code"))

# ========== Proactive ==========
@app.post("/cron/proactive")
async def cron_proactive(req: Request):
    key = req.headers.get("X-Cron-Key", "")
    if not CRON_SECRET_KEY or key != CRON_SECRET_KEY:
        raise HTTPException(401, "unauthorized")
    result = await proactive_engine.run_cron_job()
    return result

@app.post("/api/proactive/trigger")
async def trigger_proactive_manual(uid: str = Depends(get_user)):
    p = get_profile(uid)
    if proactive_engine.should_send_proactive(uid):
        msg = await proactive_engine.generate_proactive_message(uid, p.get("twin_name", "صديقي"), p.get("lang", "ar"))
        sent = await proactive_engine.send_notification(uid, "MyTwin 💜", msg or "أفتقدك 💜")
        return {"sent": sent, "message": msg}
    return {"sent": False, "reason": "cooldown"}

@app.get("/api/proactive/check")
async def proactive_check(uid: str = Depends(get_user)):
    try:
        should_send = proactive_engine.should_send_proactive(uid)
        return {"should_send": should_send, "user_id": uid}
    except Exception as e:
        logger.error(f"Proactive check error: {e}")
        return {"error": "unavailable", "details": str(e)}

# ========== أحلام ==========
@app.post("/api/dream/analyze")
async def analyze_dream_endpoint(body: dict, uid: str = Depends(get_user)):
    return await analyze_dream(uid, body.get("dream", ""), body.get("lang", "ar"))

@app.get("/api/growth/history")
async def growth_history(uid: str = Depends(get_user)):
    return await get_growth_history(uid)

# ========== خدمات Tier 1 ==========
@app.get("/api/services/youtube")
async def youtube_endpoint(query: str, lang: str = "ar", uid: str = Depends(get_user)):
    p = get_profile(uid)
    allowed, remaining = check_feature_usage(uid, p.get("tier", "free"), "youtube")
    if not allowed:
        return JSONResponse(status_code=429, content={"error": "daily_limit_reached"})
    result = await search_youtube(query, lang=lang)
    return {"result": result, "remaining": remaining} if result else {"error": "unavailable"}

@app.get("/api/services/spotify")
async def spotify_endpoint(query: str, uid: str = Depends(get_user)):
    p = get_profile(uid)
    allowed, remaining = check_feature_usage(uid, p.get("tier", "free"), "spotify")
    if not allowed:
        return JSONResponse(status_code=429, content={"error": "daily_limit_reached"})
    result = await search_spotify(query, uid, p.get("tier", "free"))
    return {"result": result, "remaining": remaining}

@app.get("/api/services/weather")
async def weather_endpoint(city: str = "Cairo", uid: str = Depends(get_user)):
    p = get_profile(uid)
    allowed, remaining = check_feature_usage(uid, p.get("tier", "free"), "weather")
    if not allowed:
        return JSONResponse(status_code=429, content={"error": "daily_limit_reached"})
    result = await get_weather(city)
    return {"result": result} if result else {"error": "unavailable"}

@app.get("/api/services/google")
async def google_endpoint(query: str, uid: str = Depends(get_user)):
    p = get_profile(uid)
    allowed, remaining = check_feature_usage(uid, p.get("tier", "free"), "search")
    if not allowed:
        return JSONResponse(status_code=429, content={"error": "daily_limit_reached"})
    result = await search_google(query, user_id=uid, tier=p.get("tier", "free"))
    return {"result": result, "remaining": remaining}

@app.get("/api/services/calendar")
async def calendar_endpoint(uid: str = Depends(get_user)):
    p = get_profile(uid)
    token = p.get("calendar_token")
    if not token:
        return {"error": "calendar_not_connected"}
    result = await get_calendar_events(token)
    return {"result": result}

# ========== خدمات Tier 2 ==========
@app.get("/api/services/news")
async def news_endpoint(country: str = "sa", uid: str = Depends(get_user)):
    p = get_profile(uid)
    allowed, remaining = check_feature_usage(uid, p.get("tier", "free"), "news")
    if not allowed:
        return JSONResponse(status_code=429, content={"error": "daily_limit_reached"})
    result = await get_news(country, user_id=uid, tier=p.get("tier", "free"))
    return {"result": result}

@app.get("/api/services/maps")
async def maps_endpoint(query: str, uid: str = Depends(get_user)):
    result = await get_maps(query)
    return {"result": result}

@app.get("/api/services/location")
async def location_endpoint(lat: float, lon: float, uid: str = Depends(get_user)):
    result = await get_location_info(lat, lon)
    return {"result": result}

@app.get("/api/services/currency")
async def currency_endpoint(base: str = "USD", uid: str = Depends(get_user)):
    result = await get_currency(base)
    return {"result": result}

@app.post("/api/services/homeassistant")
async def hass_endpoint(command: str, entity_id: Optional[str] = None, uid: str = Depends(get_user)):
    result = await home_assistant_control(command, entity_id)
    return {"result": result}

# ========== خدمات Tier 3 ==========
@app.post("/api/services/email")
async def email_endpoint(to: str, subject: str, body: str, uid: str = Depends(get_user)):
    result = await send_email(to, subject, body)
    return {"result": result}

@app.post("/api/services/telegram")
async def telegram_endpoint(chat_id: str, message: str, uid: str = Depends(get_user)):
    result = await send_telegram(chat_id, message)
    return {"result": result}

@app.get("/api/services/notes")
async def notes_endpoint(uid: str = Depends(get_user)):
    result = await get_notes(uid)
    return {"notes": result}

@app.post("/api/services/notes")
async def create_note_endpoint(content: str, uid: str = Depends(get_user)):
    result = await create_note(uid, content)
    return {"note": result}

@app.get("/api/services/tasks")
async def tasks_endpoint(uid: str = Depends(get_user)):
    result = await get_tasks(uid)
    return {"tasks": result}

@app.post("/api/services/tasks")
async def create_task_endpoint(title: str, due: Optional[str] = None, uid: str = Depends(get_user)):
    result = await create_task(uid, title, due)
    return {"task": result}

# ========== صحة ==========
@app.get("/")
async def root():
    return {"status": "ok", "version": "10.6.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/api/stats")
async def get_ai_stats(uid: str = Depends(get_user)):
    p = get_profile(uid)
    summary = get_usage_summary(uid, p.get("tier", "free"), p.get("created_at"))
    return {"daily_requests": summary["messages"]["used"], "limits": summary}

@app.get("/api/limits/check")
async def check_limits(uid: str = Depends(get_user), feature: str = ""):
    p = get_profile(uid)
    summary = get_usage_summary(uid, p.get("tier", "free"), p.get("created_at"))
    return summary

# ========== توليد الصور ==========
@app.post("/api/image/generate")
async def generate_image(prompt: str = "A beautiful sunset", uid: str = Depends(get_user)):
    try:
        from google import genai
        image_key = os.getenv("GEMINI_IMAGE_API_KEY")
        if not image_key:
            return {"status": "error", "message": "Image API key not configured"}
        client = genai.Client(api_key=image_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=prompt,
        )
        if response.parts and hasattr(response.parts[0], 'inline_data'):
            return {"status": "success", "image_base64": response.parts[0].inline_data.data}
        return {"status": "error", "message": "No image generated"}
    except Exception as e:
        logger.error(f"Image generation failed: {e}")
        return {"status": "error", "message": str(e)}
