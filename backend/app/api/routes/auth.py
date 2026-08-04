"""Auth Routes v8.0 — forgot-password + إدخال ملف محصّن (service role ثم جلسة المستخدم)
+ أخطاء كريمة بلا تسريب (الفصل 32)."""
import logging, os, httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.infrastructure.database.supabase_client import get_db, get_service_role_db

logger = logging.getLogger("auth_routes")
router = APIRouter(prefix="/api/auth", tags=["auth"])
SUPABASE_URL = os.getenv("SUPABASE_URL", "")

class LoginBody(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)
class SignupBody(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=6)
    twin_name: str = "توأمك"
    lang: str = "ar"
class ForgotBody(BaseModel):
    email: str = Field(..., min_length=3)
class GoogleAuthBody(BaseModel):
    code: str = Field(..., min_length=10)
    redirect_uri: str = Field(..., min_length=5)
    code_verifier: str = ""
    lang: str = "ar"

def _now(): return datetime.now(timezone.utc).isoformat()

async def _wake_up_twin(user_id: str, lang: str = "ar"):
    try:
        from app.twin_brain.unified_brain import unified_brain
        await unified_brain.process(user_id=user_id,
            message="أنا هنا." if lang == "ar" else "I am here.",
            lang=lang, perception={"user_state": "normal"})
    except Exception as e:
        logger.warning(f"Twin wake-up skipped: {e}")

def _create_profile(user_id, email, twin_name, lang, access_token=None):
    """محاولة 1: service role (يتجاوز RLS بأمان). محاولة 2: جلسة المستخدم نفسها."""
    payload = {"id": user_id, "email": email, "full_name": email.split('@')[0],
               "twin_name": twin_name, "lang": lang, "tier": "free", "twin_energy": 100,
               "onboarded": False, "last_active": _now(), "created_at": _now()}
    try:
        get_service_role_db().table("profiles").upsert(payload, on_conflict="id").execute()
        return True
    except Exception as e1:
        logger.warning(f"service-role profile insert failed: {e1}")
    if access_token:
        try:
            from supabase import create_client
            create_client(SUPABASE_URL, access_token).table("profiles") \
                .upsert(payload, on_conflict="id").execute()
            return True
        except Exception as e2:
            logger.error(f"user-session profile insert failed: {e2}")
    return False

@router.post("/login")
async def login(body: LoginBody):
    try:
        result = get_db().auth.sign_in_with_password(
            {"email": body.email.strip(), "password": body.password})
        if result.user and result.session:
            return {"token": result.session.access_token, "user_id": result.user.id,
                    "onboarded": True}
        raise HTTPException(401, "بيانات الدخول غير صحيحة.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"login error: {e}")
        raise HTTPException(401, "تعذر تسجيل الدخول. تحقق من بريدك وكلمة المرور.")

@router.post("/signup")
async def signup(body: SignupBody):
    try:
        result = get_db().auth.sign_up(
            {"email": body.email.strip(), "password": body.password})
        if not result.user:
            raise HTTPException(400, "تعذر إنشاء الحساب. حاول مرة أخرى.")
        user_id = result.user.id
        try:
            get_service_role_db().auth.admin.update_user_by_id(
                user_id, {"email_confirm": True})
        except Exception as e:
            logger.warning(f"auto-confirm skipped: {e}")
        token = result.session.access_token if result.session else None
        if not _create_profile(user_id, body.email.strip(), body.twin_name, body.lang, token):
            raise HTTPException(500, "تعذر تجهيز ملفك الشخصي. حاول مرة أخرى.")
        try:
            lr = get_db().auth.sign_in_with_password(
                {"email": body.email.strip(), "password": body.password})
            if lr.session:
                await _wake_up_twin(user_id, body.lang)
                return {"token": lr.session.access_token, "user_id": user_id, "onboarded": False}
        except Exception:
            pass
        if result.session:
            await _wake_up_twin(user_id, body.lang)
            return {"token": result.session.access_token, "user_id": user_id, "onboarded": False}
        return {"message": "تم إنشاء الحساب. سجل الدخول للمتابعة.", "user_id": user_id}
    except HTTPException:
        raise
    except Exception as e:
        msg = str(e).lower()
        if "already registered" in msg or "exists" in msg:
            raise HTTPException(409, "هذا البريد مسجل بالفعل. حاول تسجيل الدخول.")
        logger.error(f"signup error: {e}")
        raise HTTPException(400, "تعذر إنشاء الحساب. حاول مرة أخرى.")

@router.post("/forgot-password")
async def forgot_password(body: ForgotBody):
    try:
        get_db().auth.reset_password_for_email(
            body.email.strip(), {"redirect_to": "mytwin://reset"})
    except Exception as e:
        logger.warning(f"forgot-password skipped: {e}")
    return {"success": True,
            "message": "إذا كان البريد مسجلًا، فستصلك رسالة لاستعادة الوصول."}

@router.post("/google")
async def google_auth(body: GoogleAuthBody):
    try:
        async with httpx.AsyncClient() as client:
            tr = await client.post("https://oauth2.googleapis.com/token", data={
                "code": body.code,
                "client_id": "907014926697-cj53f1nj1es27n1a5hhtnp7vv6q8uffn.apps.googleusercontent.com",
                "redirect_uri": body.redirect_uri,
                "grant_type": "authorization_code",
                **({"code_verifier": body.code_verifier} if body.code_verifier else {}),
            }, timeout=10.0)
            if tr.status_code != 200:
                logger.error(f"google token exchange: {tr.status_code} {tr.text[:200]}")
                raise HTTPException(401, "تعذر التحقق من حساب Google. حاول مرة أخرى.")
            access_token = tr.json().get("access_token")
            ur = await client.get("https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}, timeout=10.0)
            if ur.status_code != 200:
                raise HTTPException(401, "تعذر جلب بيانات Google.")
            info = ur.json(); email = info.get("email"); name = info.get("name", "")
            if not email:
                raise HTTPException(400, "بريد Google غير متاح.")
        db = get_db()
        result = db.auth.sign_in_with_oauth({"provider": "google", "access_token": access_token})
        if result.user and result.session:
            uid = result.user.id
            if not _create_profile(uid, email, "توأمك" if body.lang == "ar" else "MyTwin", body.lang,
                                   result.session.access_token):
                logger.warning("google profile creation deferred")
            await _wake_up_twin(uid, body.lang)
            return {"token": result.session.access_token, "user_id": uid, "onboarded": True}
        raise HTTPException(500, "تعذر تسجيل الدخول بـ Google.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"google auth error: {e}")
        raise HTTPException(500, "تعذر تسجيل الدخول بـ Google. حاول مرة أخرى.")

@router.get("/verify-token")
async def verify_token(user_id: str):
    profile = get_service_role_db().table("profiles").select("id").eq("id", user_id).execute()
    return {"valid": bool(profile.data)}
