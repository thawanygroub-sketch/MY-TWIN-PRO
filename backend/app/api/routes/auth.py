"""
Auth Routes v7.1 — Signup يُرجع Token مباشرة
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from app.infrastructure.database.supabase_client import get_db, get_service_role_db
import logging, httpx

logger = logging.getLogger("auth_routes")
router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginBody(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)

class SignupBody(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)
    twin_name: str = "توأمك"
    lang: str = "ar"

async def _wake_up_twin(user_id: str, lang: str = "ar"):
    try:
        from app.twin_brain.unified_brain import unified_brain
        await unified_brain.process(user_id=user_id, message="أنا هنا." if lang == "ar" else "I am here.",
            lang=lang, perception={"user_state": "normal"})
    except Exception as e:
        logger.warning(f"Twin wake-up skipped: {e}")

@router.post("/login")
async def login(body: LoginBody):
    db = get_db()
    try:
        result = db.auth.sign_in_with_password({"email": body.email, "password": body.password})
        if result.user and result.session:
            return {"token": result.session.access_token, "user_id": result.user.id}
        raise HTTPException(401, "Invalid credentials")
    except Exception as e:
        raise HTTPException(401, "Invalid email or password")

@router.post("/signup")
async def signup(body: SignupBody):
    db = get_db()
    service_db = get_service_role_db()
    try:
        result = db.auth.sign_up({"email": body.email, "password": body.password})
        if result.user:
            # إنشاء الملف الشخصي
            service_db.table("profiles").insert({
                "id": result.user.id, "email": body.email,
                "full_name": body.email.split('@')[0], "twin_name": body.twin_name,
                "lang": body.lang, "tier": "free", "twin_energy": 100,
                "onboarded": False, "last_active": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()

            if result.session:
                # ✅ إرجاع token مباشرة
                await _wake_up_twin(result.user.id, body.lang)
                return {"token": result.session.access_token, "user_id": result.user.id}
            
            # إذا لم يكن هناك session (تأكيد البريد مطلوب)، نسجل الدخول فوراً
            try:
                login_result = db.auth.sign_in_with_password({"email": body.email, "password": body.password})
                if login_result.session:
                    return {"token": login_result.session.access_token, "user_id": login_result.user.id}
            except:
                pass
            
            return {"message": "Account created. Please login.", "user_id": result.user.id}
        raise HTTPException(400, "Signup failed")
    except Exception as e:
        if "already registered" in str(e).lower():
            raise HTTPException(409, "Email already registered")
        raise HTTPException(400, str(e))

@router.get("/verify-token")
async def verify_token(user_id: str):
    service_db = get_service_role_db()
    profile = service_db.table("profiles").select("id").eq("id", user_id).execute()
    return {"valid": bool(profile.data)}

logger.info("✅ Auth Routes v7.1 initialized")
