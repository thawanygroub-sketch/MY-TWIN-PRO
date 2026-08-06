"""Push Routes v4.0 — تسجيل التوكن + إرسال حقيقي عبر Expo."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from app.api.dependencies.auth import get_current_user_id
from app.infrastructure.database.supabase_client import get_db
logger = logging.getLogger("push_routes")
router = APIRouter(prefix="/api/push", tags=["push"])
class PushTokenBody(BaseModel):
    token: str = Field(..., min_length=10)
    platform: str = Field("android")
class PushSettingsBody(BaseModel):
    sound_enabled: bool = True
    vibration_enabled: bool = True
    proactive_enabled: bool = True
    categories: Optional[list] = None
@router.put("/token")
async def update_push_token(body: PushTokenBody, user_id: str = Depends(get_current_user_id)):
    try:
        get_db().table("profiles").update({
            "push_token": body.token, "device_platform": body.platform,
            "push_token_updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", user_id).execute()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(500, str(e))
@router.get("/settings")
async def get_push_settings(user_id: str = Depends(get_current_user_id)):
    try:
        p = get_db().table("profiles").select("push_token,device_platform,push_settings").eq("id", user_id).single().execute()
        return {"token_registered": bool(p.data.get("push_token")) if p.data else False,
                "platform": p.data.get("device_platform") if p.data else None,
                "settings": p.data.get("push_settings", {}) if p.data else {}}
    except Exception:
        return {"token_registered": False, "platform": None, "settings": {}}
@router.put("/settings")
async def update_push_settings(body: PushSettingsBody, user_id: str = Depends(get_current_user_id)):
    try:
        get_db().table("profiles").update({"push_settings": {
            "sound_enabled": body.sound_enabled, "vibration_enabled": body.vibration_enabled,
            "proactive_enabled": body.proactive_enabled,
            "categories": body.categories or ["general"]}}).eq("id", user_id).execute()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(500, str(e))
@router.post("/send-proactive")
async def send_proactive_notification(user_id: str = Depends(get_current_user_id)):
    p = get_db().table("profiles").select("push_token").eq("id", user_id).single().execute()
    if not p.data or not p.data.get("push_token"):
        raise HTTPException(400, "لم يتم تسجيل جهاز للإشعارات بعد")
    from app.infrastructure.push.expo_push import send_push
    ok = await send_push(p.data["push_token"], "توأمك", "أنا هنا. هل تريد الحديث قليلًا؟ 💜")
    return {"status": "sent" if ok else "failed"}
logger.info("✅ Push Routes v4.0 (real Expo push)")
