"""
Auth Routes v7.2 — مع دعم كامل لـ Google OAuth
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

class GoogleAuthBody(BaseModel):
    code: str = Field(..., min_length=10)
    redirect_uri: str = Field(..., min_length=5)
    code_verifier: str = Field(..., min_length=43)
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
            service_db.table("profiles").insert({
                "id": result.user.id, "email": body.email,
                "full_name": body.email.split('@')[0], "twin_name": body.twin_name,
                "lang": body.lang, "tier": "free", "twin_energy": 100,
                "onboarded": False, "last_active": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }).execute()

            if result.session:
                await _wake_up_twin(result.user.id, body.lang)
                return {"token": result.session.access_token, "user_id": result.user.id}
            
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

@router.post("/google")
async def google_auth(body: GoogleAuthBody):
    try:
        # 1. تبادل code بـ access_token من Google
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": body.code,
                    "client_id": "907014926697-cj53f1nj1es27n1a5hhtnp7vv6q8uffn.apps.googleusercontent.com",
                    "redirect_uri": body.redirect_uri,
                    "code_verifier": body.code_verifier,
                    "grant_type": "authorization_code",
                },
                timeout=10.0,
            )
            if token_response.status_code != 200:
                raise HTTPException(401, f"Google token exchange failed: {token_response.text}")
            token_data = token_response.json()
            access_token = token_data.get("access_token")

        # 2. جلب معلومات المستخدم من Google
        async with httpx.AsyncClient() as client:
            user_response = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=10.0,
            )
            if user_response.status_code != 200:
                raise HTTPException(401, "Invalid Google token")
            user_info = user_response.json()
            email = user_info.get("email")
            name = user_info.get("name", "")
            if not email:
                raise HTTPException(400, "Email not provided by Google")

        # 3. تسجيل الدخول أو إنشاء حساب
        db = get_db()
        service_db = get_service_role_db()
        result = db.auth.sign_in_with_oauth({"provider": "google", "access_token": access_token})
        if result.user and result.session:
            user_id = result.user.id
            existing_profile = service_db.table("profiles").select("id").eq("id", user_id).execute()
            if not existing_profile.data:
                service_db.table("profiles").insert({
                    "id": user_id, "email": email,
                    "full_name": name or email.split('@')[0],
                    "twin_name": "توأمك" if body.lang == "ar" else "MyTwin",
                    "lang": body.lang, "tier": "free", "twin_energy": 100,
                    "onboarded": False, "last_active": datetime.now(timezone.utc).isoformat(),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }).execute()
            else:
                service_db.table("profiles").update({"email": email, "last_active": datetime.now(timezone.utc).isoformat()}).eq("id", user_id).execute()
            await _wake_up_twin(user_id, body.lang)
            return {"token": result.session.access_token, "user_id": user_id, "is_new": False}
        raise HTTPException(500, "Google authentication failed")
    except HTTPException: raise
    except Exception as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(500, str(e))

@router.get("/verify-token")
async def verify_token(user_id: str):
    service_db = get_service_role_db()
    profile = service_db.table("profiles").select("id").eq("id", user_id).execute()
    return {"valid": bool(profile.data)}

logger.info("✅ Auth Routes v7.2 initialized")
