"""Auth Routes v6 — Email-only, token-first, profile best-effort.
القاعدة: الدخول/التسجيل يُرجعان توكن بأي حال؛ تجهيز البروفايل لا يحجب أبدًا."""
import os, logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client
from app.infrastructure.database.supabase_client import get_db, get_service_role_db
logger = logging.getLogger("auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginBody(BaseModel):
    email: str
    password: str
class SignupBody(BaseModel):
    email: str
    password: str
    twin_name: Optional[str] = "توأمي"
    lang: Optional[str] = "ar"
class ForgotBody(BaseModel):
    email: str

def _now(): return datetime.now(timezone.utc).isoformat()

def _profile_payload(user_id, email, twin_name, lang):
    return {"id": user_id, "email": email, "full_name": email.split('@')[0],
            "twin_name": twin_name or email.split('@')[0], "lang": lang or "ar",
            "tier": "free", "twin_energy": 100, "onboarded": False,
            "last_active": _now(), "updated_at": _now()}

def _ensure_profile_best_effort(service_db, token, user_id, email, twin_name, lang):
    """يحاول بالخدمة ثم بتوكن المستخدم ثم يصمت — لا يرمي أبدًا."""
    payload = _profile_payload(user_id, email, twin_name, lang)
    try:
        if service_db is not None:
            service_db.table("profiles").upsert(payload, on_conflict="id").execute()
            return True
    except Exception as e:
        logger.warning(f"profile via service skipped: {e}")
    try:
        if token:
            create_client(os.getenv("SUPABASE_URL", ""), token).table("profiles").upsert(payload, on_conflict="id").execute()
            return True
    except Exception as e:
        logger.warning(f"profile via token skipped: {e}")
    return False

@router.post("/signup")
async def signup(body: SignupBody):
    db = get_db(); service_db = get_service_role_db()
    email = body.email.strip().lower()
    result = None
    try:
        result = db.auth.sign_up({"email": email, "password": body.password})
    except Exception as e:
        if "already registered" not in str(e).lower() and "exists" not in str(e).lower():
            raise HTTPException(400, "تعذر إنشاء الحساب. تحقق من البريد وكلمة المرور.")
    user_id = result.user.id if (result and result.user) else None
    session = result.session if result else None
    if user_id and service_db is not None:
        try: service_db.auth.admin.update_user_by_id(user_id, {"email_confirm": True})
        except Exception: pass
    if not session:
        try:
            lr = db.auth.sign_in_with_password({"email": email, "password": body.password})
            session = lr.session
            user_id = user_id or (lr.user.id if lr.user else None)
        except Exception:
            session = None
    if not session or not user_id:
        raise HTTPException(400, "هذا البريد مسجل بالفعل — استخدم تسجيل الدخول.")
    _ensure_profile_best_effort(service_db, session.access_token, user_id, email, body.twin_name, body.lang)
    logger.info(f"signup ok: {email}")
    return {"token": session.access_token, "user_id": user_id, "onboarded": False}

@router.post("/login")
async def login(body: LoginBody):
    db = get_db(); service_db = get_service_role_db()
    email = body.email.strip().lower()
    try:
        lr = db.auth.sign_in_with_password({"email": email, "password": body.password})
    except Exception:
        raise HTTPException(400, "بيانات الدخول غير صحيحة.")
    if not lr.session or not lr.user:
        raise HTTPException(400, "بيانات الدخول غير صحيحة.")
    _ensure_profile_best_effort(service_db, lr.session.access_token, lr.user.id, email, None, None)
    return {"token": lr.session.access_token, "user_id": lr.user.id, "onboarded": False}

@router.post("/forgot-password")
async def forgot_password(body: ForgotBody):
    try:
        get_db().auth.reset_password_for_email(body.email.strip(), {"redirect_to": "mytwin://reset"})
    except Exception as e:
        logger.warning(f"forgot-password skipped: {e}")
    return {"success": True, "message": "إن كان البريد مسجلًا فستصلك رسالة الاستعادة."}

@router.get("/verify-token")
async def verify_token(user_id: str):
    try:
        r = get_db().table("profiles").select("id").eq("id", user_id).limit(1).execute()
        return {"valid": bool(r.data), "user_id": user_id}
    except Exception:
        return {"valid": True, "user_id": user_id}

@router.post("/google")
async def google():
    raise HTTPException(501, "تسجيل الدخول عبر Google قريبًا — استخدم البريد حاليًا.")
