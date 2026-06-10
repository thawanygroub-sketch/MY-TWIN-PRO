import os, logging, asyncio, httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("telegram_webhook")

router = APIRouter()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_API_BASE = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"

async def send_telegram_message(chat_id: int, text: str) -> bool:
    if not TELEGRAM_BOT_TOKEN:
        return False
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{TELEGRAM_API_BASE}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
                timeout=10.0,
            )
            return resp.status_code == 200
    except Exception as e:
        logger.warning(f"Telegram send failed: {e}")
        return False

async def send_proactive_telegram(user_id: str, message: str, telegram_chat_id: int) -> bool:
    return await send_telegram_message(telegram_chat_id, message)

async def setup_webhook():
    if not TELEGRAM_BOT_TOKEN:
        logger.info("Telegram bot token not set. Skipping webhook setup.")
        return

    base_url = os.getenv("RAILWAY_PUBLIC_DOMAIN", os.getenv("EXPO_PUBLIC_API_URL", ""))
    if not base_url:
        logger.warning("No public URL found for Telegram webhook.")
        return

    webhook_url = f"{base_url}/api/telegram/webhook"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{TELEGRAM_API_BASE}/setWebhook",
                json={"url": webhook_url},
                timeout=10.0,
            )
            if resp.status_code == 200:
                logger.info(f"✅ Telegram webhook set to: {webhook_url}")
            else:
                logger.warning(f"Telegram webhook setup failed: {resp.text}")
    except Exception as e:
        logger.error(f"Telegram webhook setup error: {e}")

@router.post("/api/telegram/webhook")
async def telegram_webhook(request: Request):
    if not TELEGRAM_BOT_TOKEN:
        return JSONResponse({"status": "error", "message": "Telegram not configured"})

    try:
        body = await request.json()
        message = body.get("message", {})
        chat = message.get("chat", {})
        user = message.get("from", {})
        text = message.get("text", "").strip()
        chat_id = chat.get("id")
        user_id_str = str(user.get("id", ""))
        first_name = user.get("first_name", "صديقي")

        if not text or not chat_id:
            return JSONResponse({"status": "ok"})

        if text.startswith("/start"):
            await send_telegram_message(chat_id, f"مرحباً {first_name}! 💜\nأنا توأمك الرقمي من MyTwin.\nأرسل لي أي شيء وسأرد عليك!")
            return JSONResponse({"status": "ok", "action": "start"})

        if text.startswith("/reset"):
            await send_telegram_message(chat_id, "تم مسح المحادثة 💜")
            return JSONResponse({"status": "ok", "action": "reset"})

        try:
            from twin_brain import twin_brain
            temp_user_id = f"tg_{user_id_str}"
            response = await twin_brain.respond(
                message=text, twin_name="MyTwin", bond_level=50,
                dims={}, memories=[], history=[],
                user_id=temp_user_id, tier="free", country_code="SA",
            )
            reply = response.get("reply", "أنا هنا معاك 💜")
            clean_reply = reply.replace("**", "").replace("*", "").replace("__", "").replace("`", "")
            await send_telegram_message(chat_id, clean_reply)
        except Exception as e:
            logger.error(f"Telegram chat error: {e}")
            await send_telegram_message(chat_id, "أواجه ضغطاً تقنياً، سأعود قريباً 💜")

        return JSONResponse({"status": "ok"})
    except Exception as e:
        logger.error(f"Telegram webhook error: {e}")
        return JSONResponse({"status": "error", "message": str(e)})

@router.post("/api/telegram/send")
async def send_telegram_notification(chat_id: int, message: str):
    success = await send_telegram_message(chat_id, message)
    return {"success": success}
