"""
MyTwin – Telegram Webhook v2.0 (موثق ومحسن)
يدعم استقبال الرسائل من تيليجرام والرد عليها باستخدام TwinBrain.
يدعم أيضاً إرسال إشعارات استباقية عبر تيليجرام.
"""
import os, logging, asyncio, httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("telegram_webhook")

router = APIRouter()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_API_BASE = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"

# ========== إرسال رسالة تيليجرام ==========
async def send_telegram_message(chat_id: int, text: str) -> bool:
    """إرسال رسالة نصية إلى محادثة تيليجرام محددة."""
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("Telegram bot token not set")
        return False
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{TELEGRAM_API_BASE}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
                timeout=10.0,
            )
            if resp.status_code == 200:
                return True
            else:
                logger.warning(f"Telegram send failed: {resp.status_code} - {resp.text}")
                return False
    except Exception as e:
        logger.warning(f"Telegram send failed: {e}")
        return False

# ========== إرسال إشعار استباقي ==========
async def send_proactive_telegram(user_id: str, message: str, telegram_chat_id: int) -> bool:
    """إرسال إشعار استباقي لمستخدم محدد عبر تيليجرام."""
    return await send_telegram_message(telegram_chat_id, message)

# ========== إعداد Webhook ==========
async def setup_webhook():
    """إعداد webhook تيليجرام لاستقبال الرسائل."""
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

# ========== نقطة نهاية Webhook ==========
@router.post("/api/telegram/webhook")
async def telegram_webhook(request: Request):
    """استقبال رسائل تيليجرام والرد عليها باستخدام TwinBrain."""
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

        # أمر البدء
        if text.startswith("/start"):
            welcome_msg = (
                f"مرحباً {first_name}! 💜\n"
                f"أنا توأمك الرقمي من MyTwin.\n"
                f"أرسل لي أي شيء وسأرد عليك!\n\n"
                f"الأوامر المتاحة:\n"
                f"/start - رسالة الترحيب\n"
                f"/reset - مسح المحادثة\n"
                f"/weather مدينة - الطقس\n"
                f"/news - آخر الأخبار\n"
                f"/youtube بحث - فيديوهات يوتيوب\n"
                f"/spotify أغنية - بحث سبوتيفاي\n"
                f"/search بحث - بحث جوجل"
            )
            await send_telegram_message(chat_id, welcome_msg)
            return JSONResponse({"status": "ok", "action": "start"})

        # أمر المسح
        if text.startswith("/reset"):
            await send_telegram_message(chat_id, "تم مسح المحادثة 💜")
            return JSONResponse({"status": "ok", "action": "reset"})

        # ✅ معالجة الأدوات المباشرة (Tool Router للتليجرام)
        tool_result = None
        msg_lower = text.lower()
        
        if text.startswith("/weather") or "طقس" in msg_lower:
            city = text.replace("/weather", "").strip() or "Cairo"
            from tools.external_services import get_weather
            tool_result = await get_weather(city=city)
        elif text.startswith("/news") or "أخبار" in msg_lower:
            from tools.external_services import get_news
            tool_result = await get_news()
        elif text.startswith("/youtube") or "يوتيوب" in msg_lower:
            query = text.replace("/youtube", "").strip() or text
            from tools.external_services import search_youtube
            tool_result = await search_youtube(query)
        elif text.startswith("/spotify") or "سبوتيفاي" in msg_lower:
            query = text.replace("/spotify", "").strip() or text
            from tools.external_services import search_spotify
            tool_result = await search_spotify(query)
        elif text.startswith("/search") or "بحث" in msg_lower:
            query = text.replace("/search", "").strip() or text
            from tools.external_services import search_google
            tool_result = await search_google(query)

        if tool_result:
            await send_telegram_message(chat_id, tool_result)
            return JSONResponse({"status": "ok", "action": "tool"})

        # المحادثة العادية باستخدام TwinBrain
        try:
            from twin_brain import twin_brain
            temp_user_id = f"tg_{user_id_str}"
            response = await twin_brain.respond(
                message=text,
                twin_name="MyTwin",
                bond_level=50,
                dims={},
                memories=[],
                history=[],
                user_id=temp_user_id,
                tier="free",
                country_code="SA",
            )
            reply = response.get("reply", "أنا هنا معاك 💜")
            # تنظيف التنسيق لتليجرام
            clean_reply = reply.replace("**", "").replace("*", "").replace("__", "").replace("`", "")
            await send_telegram_message(chat_id, clean_reply)
        except Exception as e:
            logger.error(f"Telegram chat error: {e}")
            await send_telegram_message(chat_id, "أواجه ضغطاً تقنياً، سأعود قريباً 💜")

        return JSONResponse({"status": "ok"})
    except Exception as e:
        logger.error(f"Telegram webhook error: {e}")
        return JSONResponse({"status": "error", "message": str(e)})

# ========== نقطة نهاية الإرسال اليدوي ==========
@router.post("/api/telegram/send")
async def send_telegram_notification(chat_id: int, message: str):
    """إرسال إشعار تيليجرام يدوياً."""
    success = await send_telegram_message(chat_id, message)
    return {"success": success}
