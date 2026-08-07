"""Auth Routes v8 — forgot-password + رسائل كريمة + upsert ملف (بلا تسريب أخطاء)."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from app.infrastructure.database.supabase_client import get_db, get_service_role_db
import logging
logger = logging.getLogger("auth_routes")
router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginBody(BaseModel):
    email: str = Field(..., min_length=3); password: str = Field(..., min_length=6)
class SignupBody(BaseModel):
    email: str = Field(..., min_length=3); password: str = Field(..., min_length=6)
    twin_name: str = "توأمك"; lang: str = "ar"
class ForgotBody(BaseModel):
    email: str = Field(..., min_length=3)
class GoogleAuthBody(BaseModel):
    code: str = Field(..., min_length=10); redirect_uri: str = Field(..., min_length=5)
    code_verifier: str = ""; lang: str = "ar"

def _now(): return datetime.now(timezone.utc).isoformat()

async def _wake_up_twin(user_id: str, lang: str = "ar"):
    try:
        from app.twin_brain.unified_brain import unified_brain
        await unified_brain.process(user_id=user_id,
            message="أنا هنا." if lang == "ar" else "I am here.",
            lang=lang, perception={"user_state": "normal"})
    except Exception as e:
        logger.warning(f"Twin wake-up skipped: {e}")

def _upsert_profile(db, user_id, email, name, twin_name, lang) -> bool:
    try:
        db.table("profiles").upsert({"id": user_id, "email": email,
            "full_name": name, "twin_name": twin_name, "lang": lang, "tier": "free",
            "twin_energy": 100, "onboarded": False, "last_active": _now(),
            "created_at": _now()}, on_conflict="id").execute()
        return True
    except Exception as e:
        logger.error(f"profile upsert failed: {e}")
        return False

@router.post("/login")
async def login(body: LoginBody):
    try:
        result = get_db().auth.sign_in_with_password(
            {"email": body.email.strip(), "password": body.password})
        if result.user and result.session:
            return {"token": result.session.access_token, "user_id": result.user.id, "onboarded": True}
        raise HTTPException(401, "بيانات الدخول غير صحيحة.")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(401, "تعذر تسجيل الدخول. تحقق من بريدك وكلمة المرور.")

@router.post("/signup")
async def signup(body: SignupBody):
    db = get_db(); service_db = get_service_role_db()
    try:
        result = db.auth.sign_up({"email": body.email.strip(), "password": body.password})
        if not result.user:
            raise HTTPException(400, "تعذر إنشاء الحساب. حاول مرة أخرى.")
        user_id = result.user.id
        try:
            service_db.auth.admin.update_user_by_id(user_id, {"email_confirm": True})
        except Exception as e:
            logger.warning(f"auto-confirm skipped: {e}")
        token = result.session.access_token if result.session else None
        ok = _upsert_profile(service_db, user_id, body.email.strip(),
                             body.email.split('@')[0], body.twin_name, body.lang)
        if not ok and token:
            from supabase import create_client
            import os
            ok = _upsert_profile(create_client(os.getenv("SUPABASE_URL", ""), token),
                                 user_id, body.email.strip(), body.email.split('@')[0], body.twin_name, body.lang)
        if not ok:
            try:
                from datetime import datetime, timezone
                service_db.table("profiles").upsert({
                    "id": user_id, "email": body.email.strip(),
                    "full_name": body.email.split('@')[0],
                    "twin_name": body.twin_name, "lang": body.lang,
                    "tier": "free", "updated_at": datetime.now(timezone.utc).isoformat(),
                }).execute()
                ok = True
            except Exception as e2:
                logger.error(f"direct profile upsert failed: {e2}")
        if not ok:
            raise HTTPException(500, "تعذر تجهيز ملفك الشخصي. حاول مرة أخرى.")
        try:
            lr = db.auth.sign_in_with_password({"email": body.email.strip(), "password": body.password})
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
        get_db().auth.reset_password_for_email(body.email.strip(), {"redirect_to": "mytwin://reset"})
    except Exception as e:
        logger.warning(f"forgot-password skipped: {e}")
    return {"success": True, "message": "إذا كان البريد مسجلًا، فستصلك رسالة لاستعادة الوصول."}

@router.post("/google")
async def google_auth(body: GoogleAuthBody):
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            tr = await client.post("https://oauth2.googleapis.com/token", data={
                "code": body.code,
                "client_id": "907014926697-cj53f1nj1es27n1a5hhtnp7vv6q8uffn.apps.googleusercontent.com",
                "redirect_uri": body.redirect_uri,
                "grant_type": "authorization_code",
                **({"code_verifier": body.code_verifier} if body.code_verifier else {})}, timeout=10.0)
            if tr.status_code != 200:
                raise HTTPException(401, "تعذر التحقق من حساب Google. حاول مرة أخرى.")
            access_token = tr.json().get("access_token")
            ur = await client.get("https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}, timeout=10.0)
            if ur.status_code != 200:
                raise HTTPException(401, "تعذر جلب بيانات Google.")
            info = ur.json(); email = info.get("email"); name = info.get("name", "")
            if not email:
                raise HTTPException(400, "بريد Google غير متاح.")
        db = get_db(); service_db = get_service_role_db()
        result = db.auth.sign_in_with_oauth({"provider": "google", "access_token": access_token})
        if result.user and result.session:
            uid = result.user.id
            _upsert_profile(service_db, uid, email, name or email.split('@')[0],
                            "توأمك" if body.lang == "ar" else "MyTwin", body.lang)
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
