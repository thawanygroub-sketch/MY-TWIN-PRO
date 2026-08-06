"""Expo Push Sender — إرسال إشعارات حقيقي."""
import logging, httpx
logger = logging.getLogger("expo_push")
async def send_push(token: str, title: str, body: str, data: dict = None) -> bool:
    if not token or not token.startswith("ExponentPushToken"): return False
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post("https://exp.host/--/api/v2/push/send", json={
                "to": token, "title": title, "body": body, "sound": "default", "data": data or {}})
            return r.status_code == 200
    except Exception as e:
        logger.warning(f"push error: {e}")
        return False
