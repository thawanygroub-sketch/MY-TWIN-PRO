"""
MyTwin – External Services v5.2 (جميع الأدوات - داخل tools/)
Tier 1: Weather, YouTube, Spotify, Google Search, Calendar
Tier 2: Home Assistant, News, Maps, Location, Currency
Tier 3: Email, Telegram, Notes, Tasks
"""
import os, logging, base64, asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
import httpx

logger = logging.getLogger(__name__)

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "")
SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID", "")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", os.getenv("YOUTUBE_API_KEY", ""))
GOOGLE_CSE_ID = os.getenv("GOOGLE_CSE_ID", "")
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "")
HASS_TOKEN = os.getenv("HOME_ASSISTANT_TOKEN", "")
HASS_URL = os.getenv("HOME_ASSISTANT_URL", "")
EMAIL_API_KEY = os.getenv("SENDGRID_API_KEY", "")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")

def _get_limits_manager():
    try:
        from message_limits import check_feature_usage
        return check_feature_usage
    except:
        return None

_db = None
def get_db():
    global _db
    if _db is None:
        from supabase import create_client
        SUPABASE_URL = os.getenv("SUPABASE_URL")
        SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
        if SUPABASE_URL and SUPABASE_KEY:
            _db = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _db

async def city_to_coordinates(city: str):
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": city, "format": "json", "limit": 1},
                headers={"User-Agent": "MyTwin/1.0"},
                timeout=5.0
            )
            if resp.status_code == 200:
                data = resp.json()
                if data:
                    return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        logger.warning(f"Geocoding failed for {city}: {e}")
    return None, None

class SpotifyClient:
    def __init__(self):
        self.client_id = SPOTIFY_CLIENT_ID
        self.client_secret = SPOTIFY_CLIENT_SECRET
        self._token = None
        self._token_expiry = None

    async def _get_token(self) -> Optional[str]:
        if not self.client_id or not self.client_secret:
            return None
        if self._token and self._token_expiry and datetime.now(timezone.utc) < self._token_expiry:
            return self._token
        auth = base64.b64encode(f"{self.client_id}:{self.client_secret}".encode()).decode()
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://accounts.spotify.com/api/token",
                    headers={"Authorization": f"Basic {auth}"},
                    data={"grant_type": "client_credentials"},
                    timeout=10.0
                )
                if resp.status_code == 200:
                    data = resp.json()
                    self._token = data.get("access_token")
                    self._token_expiry = datetime.now(timezone.utc) + timedelta(seconds=3600 - 60)
                    return self._token
        except Exception as e:
            logger.error(f"Spotify Auth Error: {e}")
        return None

    async def search(self, query: str) -> str:
        token = await self._get_token()
        if not token: return ""
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.spotify.com/v1/search",
                    headers={"Authorization": f"Bearer {token}"},
                    params={"q": query, "type": "track", "limit": 1},
                    timeout=10.0
                )
                if resp.status_code == 200:
                    tracks = resp.json().get("tracks", {}).get("items", [])
                    if tracks:
                        t = tracks[0]
                        return f"🎵 {t['name']} - {t['artists'][0]['name']}\n🔗 {t['external_urls']['spotify']}"
        except Exception as e:
            logger.error(f"Spotify Search Error: {e}")
        return ""

spotify_client = SpotifyClient()

async def search_spotify(query: str, user_id: Optional[str] = None, tier: str = "free") -> Optional[str]:
    check_func = _get_limits_manager()
    if check_func and user_id:
        allowed, _ = check_func(user_id, tier, "spotify")
        if not allowed: return "🎵 لقد استنفدت استخدام Spotify اليوم."
    return await spotify_client.search(query)

async def search_youtube(query: str, max_results: int = 3, lang: str = "ar", user_id: Optional[str] = None, tier: str = "free") -> Optional[str]:
    if not YOUTUBE_API_KEY: return None
    check_func = _get_limits_manager()
    if check_func and user_id:
        allowed, _ = check_func(user_id, tier, "youtube")
        if not allowed: return "📺 لقد استنفدت استخدام YouTube اليوم."
    try:
        region = "SA" if lang == "ar" else "US"
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={"key": YOUTUBE_API_KEY, "q": query, "part": "snippet", "type": "video", "maxResults": max_results, "regionCode": region, "relevanceLanguage": lang},
                timeout=5.0
            )
            if resp.status_code == 200:
                items = resp.json().get("items", [])
                if not items: return None
                return "\n\n".join(f"📺 {item['snippet']['title']}\n🔗 https://youtube.com/watch?v={item['id']['videoId']}" for item in items[:max_results])
    except Exception as e:
        logger.error(f"YouTube Error: {e}")
    return None

WEATHER_CODES_AR = {0:"سماء صافية",1:"غائم جزئياً",2:"غائم",3:"غائم كلياً",45:"ضباب",48:"ضباب متجمد",51:"رذاذ خفيف",53:"رذاذ متوسط",55:"رذاذ كثيف",61:"أمطار خفيفة",63:"أمطار متوسطة",65:"أمطار غزيرة",71:"ثلوج خفيفة",73:"ثلوج متوسطة",75:"ثلوج كثيفة",80:"زخات مطر",95:"عاصفة رعدية",96:"عاصفة رعدية مع بَرَد",99:"عاصفة رعدية شديدة"}

async def get_weather(city: str = "Cairo", lat: Optional[float] = None, lon: Optional[float] = None, user_id: Optional[str] = None, tier: str = "free") -> Optional[str]:
    check_func = _get_limits_manager()
    if check_func and user_id:
        allowed, _ = check_func(user_id, tier, "weather")
        if not allowed: return "🌤️ لقد استنفدت استعلامات الطقس اليوم."
    if lat is None or lon is None:
        lat, lon = await city_to_coordinates(city)
        if lat is None: return f"لم أتمكن من تحديد إحداثيات {city}."
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://api.open-meteo.com/v1/forecast", params={"latitude":lat,"longitude":lon,"current_weather":True,"daily":"temperature_2m_max,temperature_2m_min","timezone":"auto"}, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                current = data.get("current_weather",{})
                return f"🌤️ الطقس في {city}:\n{WEATHER_CODES_AR.get(current.get('weathercode',0),'غير معروف')}\n🌡️ {current.get('temperature','?')}°C\n💨 رياح: {current.get('windspeed',0)} كم/س"
    except Exception as e:
        logger.error(f"Open-Meteo Error: {e}")
    return None

async def search_google(query: str, num: int = 3, user_id: Optional[str] = None, tier: str = "free") -> Optional[str]:
    if not GOOGLE_API_KEY or not GOOGLE_CSE_ID: return None
    check_func = _get_limits_manager()
    if check_func and user_id:
        allowed, _ = check_func(user_id, tier, "search")
        if not allowed: return "🔍 لقد استنفدت عمليات البحث اليوم."
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://www.googleapis.com/customsearch/v1", params={"key":GOOGLE_API_KEY,"cx":GOOGLE_CSE_ID,"q":query,"num":min(num,5)}, timeout=5.0)
            if resp.status_code == 200:
                items = resp.json().get("items",[])
                if not items: return None
                return "\n\n".join(f"🔎 {item['title']}\n{item['snippet']}\n🔗 {item['link']}" for item in items[:num])
    except Exception as e:
        logger.error(f"Google Search Error: {e}")
    return None

async def get_todoist_tasks(token: str) -> str:
    if not token: return "يحتاج ربط حساب Todoist."
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://api.todoist.com/rest/v2/tasks", headers={"Authorization":f"Bearer {token}"}, params={"filter":"today | overdue"}, timeout=10.0)
            if resp.status_code == 200:
                tasks = resp.json()
                if not tasks: return "لا توجد مهام اليوم 🎉"
                return "✅ مهامك:\n" + "\n".join(f"• {t['content']}" for t in tasks[:10])
    except Exception as e:
        logger.error(f"Todoist Error: {e}")
    return ""

async def get_calendar_events(token: str) -> str:
    if not token: return "يحتاج ربط Google Calendar."
    try:
        now = datetime.now(timezone.utc).isoformat() + "Z"
        end = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat() + "Z"
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://www.googleapis.com/calendar/v3/calendars/primary/events", headers={"Authorization":f"Bearer {token}"}, params={"timeMin":now,"timeMax":end,"maxResults":5,"singleEvents":True,"orderBy":"startTime"}, timeout=10.0)
            if resp.status_code == 200:
                events = resp.json().get("items",[])
                if not events: return "لا توجد أحداث اليوم."
                return "📅 أحداث اليوم:\n" + "\n".join(f"• {e.get('summary','?')}" for e in events[:5])
    except Exception as e:
        logger.error(f"Calendar Error: {e}")
    return ""

async def home_assistant_control(command: str, entity_id: Optional[str] = None) -> str:
    if not HASS_TOKEN or not HASS_URL: return "🏠 Home Assistant غير مهيأ."
    headers = {"Authorization":f"Bearer {HASS_TOKEN}","Content-Type":"application/json"}
    try:
        async with httpx.AsyncClient() as client:
            if "تشغيل" in command and entity_id:
                await client.post(f"{HASS_URL}/api/services/light/turn_on", headers=headers, json={"entity_id":entity_id})
                return "💡 تم تشغيل الإضاءة"
            elif "إطفاء" in command and entity_id:
                await client.post(f"{HASS_URL}/api/services/light/turn_off", headers=headers, json={"entity_id":entity_id})
                return "💡 تم إطفاء الإضاءة"
            else:
                return "🏠 الأمر غير معروف"
    except Exception as e:
        logger.error(f"Home Assistant Error: {e}")
        return "⚠️ خطأ في الاتصال"

async def get_news(country: str = "sa", category: str = "general", user_id: Optional[str] = None, tier: str = "free") -> Optional[str]:
    if not NEWS_API_KEY: return None
    check_func = _get_limits_manager()
    if check_func and user_id:
        allowed, _ = check_func(user_id, tier, "news")
        if not allowed: return "📰 استنفدت استعلامات الأخبار اليوم."
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://newsapi.org/v2/top-headlines", params={"country":country,"category":category,"apiKey":NEWS_API_KEY,"pageSize":5}, timeout=5.0)
            if resp.status_code == 200:
                articles = resp.json().get("articles",[])
                if not articles: return "لا توجد أخبار حالياً."
                return "\n\n".join(f"📰 {a['title']}\n{a['description']}\n{a['url']}" for a in articles[:5])
    except Exception as e:
        logger.error(f"News Error: {e}")
    return None

async def get_maps(query: str) -> Optional[str]:
    if GOOGLE_API_KEY: return f"🗺️ ابحث عن '{query}' على الخرائط"
    return None

async def get_location_info(lat: float, lon: float) -> Optional[str]:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}", headers={"User-Agent":"MyTwin/1.0"}, timeout=5.0)
            if resp.status_code == 200:
                data = resp.json()
                return f"📍 {data.get('display_name','موقع غير معروف')}"
    except:
        pass
    return None

async def get_currency(base: str = "USD", symbols: str = "EGP,SAR,AED") -> Optional[str]:
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://api.exchangerate.host/latest", params={"base":base,"symbols":symbols}, timeout=5.0)
            if resp.status_code == 200:
                rates = resp.json().get("rates",{})
                return "\n".join(f"💱 {base} → {k}: {v}" for k,v in rates.items())
    except:
        pass
    return None

async def send_email(to: str, subject: str, body: str) -> str:
    if not EMAIL_API_KEY: return "📧 البريد غير مهيأ"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post("https://api.sendgrid.com/v3/mail/send", headers={"Authorization":f"Bearer {EMAIL_API_KEY}","Content-Type":"application/json"}, json={"personalizations":[{"to":[{"email":to}],"subject":subject}],"from":{"email":"noreply@mytwin.app"},"content":[{"type":"text/plain","value":body}]}, timeout=10.0)
            if resp.status_code == 202: return "📧 تم إرسال البريد بنجاح"
    except Exception as e:
        logger.error(f"Email Error: {e}")
    return "فشل إرسال البريد"

async def send_telegram(chat_id: str, message: str) -> str:
    if not TELEGRAM_BOT_TOKEN: return "✈️ تيليجرام غير مهيأ"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage", json={"chat_id":chat_id,"text":message}, timeout=10.0)
            if resp.status_code == 200: return "✈️ تم إرسال رسالة تيليجرام"
    except Exception as e:
        logger.error(f"Telegram Error: {e}")
    return "فشل إرسال تيليجرام"

async def get_notes(user_id: str) -> List[Dict]:
    db = get_db()
    if not db: return []
    res = db.table("notes").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return res.data or []

async def create_note(user_id: str, content: str) -> Dict:
    db = get_db()
    if not db: return {}
    res = db.table("notes").insert({"user_id":user_id,"content":content}).execute()
    return res.data[0] if res.data else {}

async def get_tasks(user_id: str) -> List[Dict]:
    db = get_db()
    if not db: return []
    res = db.table("tasks").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return res.data or []

async def create_task(user_id: str, title: str, due: Optional[str] = None) -> Dict:
    db = get_db()
    if not db: return {}
    res = db.table("tasks").insert({"user_id":user_id,"title":title,"due":due}).execute()
    return res.data[0] if res.data else {}

async def get_knowledge(query: str) -> Optional[str]:
    return None
