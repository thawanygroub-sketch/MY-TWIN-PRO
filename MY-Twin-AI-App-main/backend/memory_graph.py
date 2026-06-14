import os, logging, json, asyncio, re
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from supabase import create_client, Client

logger = logging.getLogger("memory_graph")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
db: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

def _ensure_indexes():
    if db:
        try:
            db.query("CREATE INDEX IF NOT EXISTS idx_memories_user_created ON memories(user_id, created_at DESC)").execute()
            db.query("CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(user_id, importance DESC)").execute()
            db.query("CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(user_id, memory_type)").execute()
            logger.info("✅ فهارس الذاكرة جاهزة")
        except: pass

_ensure_indexes()

_cache: Dict[str, List[Dict]] = {}
_cache_time: Dict[str, datetime] = {}
CACHE_TTL = 60

def _get_ai_client():
    try:
        from multi_ai import MultiAIClient
        return MultiAIClient()
    except: return None

async def store_mem(uid, content, importance=0.5, emotion="neutral"):
    if not db: return
    try:
        db.table("memories").insert({"user_id":uid,"content":content,"importance":importance,"emotion":emotion,"memory_type":"daily","created_at":datetime.now(timezone.utc).isoformat()}).execute()
        if uid in _cache: del _cache[uid]
    except Exception as e: logger.error(f"Memory store error: {e}")

async def retrieve_memories(uid: str, query="", days=30, lim=5, memory_type=None) -> List[Dict]:
    if not db: return []
    cache_key = f"{uid}:{memory_type}:{lim}"
    if cache_key in _cache and (datetime.now() - _cache_time.get(cache_key, datetime.min)).seconds < CACHE_TTL:
        return _cache[cache_key]
    try:
        req = db.table("memories").select("*").eq("user_id",uid).order("importance",desc=True).order("created_at",desc=True).limit(lim)
        if memory_type: req = req.eq("memory_type",memory_type)
        if days > 0: req = req.gte("created_at",(datetime.now(timezone.utc) - timedelta(days=days)).isoformat())
        res = req.execute()
        _cache[cache_key] = res.data or []
        _cache_time[cache_key] = datetime.now()
        return _cache[cache_key]
    except Exception as e:
        logger.error(f"Memory retrieval error: {e}")
        return []

async def cleanup_weak_memories(uid):
    if not db: return
    try:
        db.table("memories").delete().eq("user_id",uid).lt("importance",0.15).lt("created_at",(datetime.now(timezone.utc) - timedelta(days=30)).isoformat()).execute()
    except: pass

async def get_memory_context(uid: str) -> str:
    if not db: return ""
    try:
        core = await retrieve_memories(uid, memory_type="core", lim=3)
        goals = await retrieve_memories(uid, memory_type="goal", lim=3)
        emotional = await retrieve_memories(uid, memory_type="emotional", lim=2)
        preferences = await retrieve_memories(uid, memory_type="preference", lim=3)
        relationships = await retrieve_memories(uid, memory_type="relationship", lim=2)
        parts = []
        if core: parts.append("معلومات أساسية: " + " | ".join([m["content"] for m in core]))
        if goals: parts.append("أهداف: " + " | ".join([m["content"] for m in goals]))
        if preferences: parts.append("تفضيلات: " + " | ".join([m["content"] for m in preferences]))
        if relationships: parts.append("علاقات: " + " | ".join([m["content"] for m in relationships]))
        if emotional: parts.append("لحظات عاطفية: " + " | ".join([m["content"] for m in emotional]))
        try:
            from consciousness_core import consciousness_core
            state = consciousness_core.user_states.get(uid, {})
            reflections = state.get("internal_state", {}).get("reflection_log", [])
            if reflections:
                last = reflections[-1].get("data", {})
                if last.get("what_i_learned"): parts.append(f"ما تعلمه التوأم عنك مؤخراً: {last['what_i_learned']}")
        except: pass
        return "\n".join(parts) if parts else ""
    except Exception as e:
        logger.error(f"Memory context error: {e}")
        return ""

async def extract_entities(user_id, message, lang="ar"):
    if not db or not message.strip() or len(message) < 40: return
    client = _get_ai_client()
    if not client: return
    try:
        r = await client.get_best_reply(f"""استخرج الكيانات وأعد ONLY JSON: {{"people":[],"preferences":[],"goals":[],"habits":[],"facts":[]}}\nالرسالة: "{message}"\nJSON:""", task="deep_reasoning")
        if r:
            match = re.search(r'\{[^}]+\}', r)
            if match:
                entities = json.loads(match.group())
                for etype, items in entities.items():
                    for item in items:
                        db.table("knowledge_entities").insert({"user_id":user_id,"entity_type":etype,"entity_name":str(item),"created_at":datetime.now(timezone.utc).isoformat()}).execute()
    except: pass

class DeepMemorySystem:
    def retrieve(self, uid, query, days=30, lim=5, emotion_filter=None) -> List[Dict]:
        if not db: return []
        try:
            req = db.table("memories").select("*").eq("user_id",uid).order("created_at",desc=True).limit(lim)
            if emotion_filter: req = req.eq("emotion",emotion_filter)
            return (req.execute()).data or []
        except: return []

print("✅ Unified Memory System v5.3 (محسّن مع كاش)")
