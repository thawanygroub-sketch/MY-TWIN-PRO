"""
MyTwin – Reasoning Engine v8.0 (Agent Brain)
"""
import os, logging, asyncio, time
from typing import Dict, Any, Optional, List, Callable, Tuple

logger = logging.getLogger("reasoning_engine")

class ToolRegistry:
    _tools: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def register(cls, name: str, func: Callable, priority: int = 5, cost: int = 1, category: str = "general"):
        cls._tools[name] = {"function": func, "priority": priority, "cost": cost, "category": category}

    @classmethod
    def get_tool(cls, name: str) -> Optional[Callable]:
        tool = cls._tools.get(name)
        return tool["function"] if tool else None

    @classmethod
    def list_tools(cls) -> List[str]:
        return list(cls._tools.keys())

async def _tool_remind_goal(user_id: str, query: str = "") -> Optional[str]:
    try:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_KEY", "")
        if not url or not key: return None
        db = create_client(url, key)
        res = db.table("goals").select("*").eq("user_id", user_id).eq("status", "active").order("created_at", desc=True).limit(3).execute()
        if res.data: return "أهدافك النشطة: " + "، ".join(g.get("title", "") for g in res.data)
        return "لا توجد أهداف نشطة حالياً."
    except Exception as e:
        logger.warning(f"Tool remind_goal failed: {e}")
        return None

async def _tool_analyze_progress(user_id: str, query: str = "") -> Optional[str]:
    try:
        from growth_tracker import get_growth_history
        history = await get_growth_history(user_id, limit=1)
        if history: return f"آخر تقرير نمو: {history[0].get('summary', 'لا يوجد')}"
        return "لم يتم تسجيل تقدم بعد."
    except Exception as e:
        logger.warning(f"Tool analyze_progress failed: {e}")
        return None

async def _tool_fetch_memory(user_id: str, query: str = "") -> Optional[str]:
    try:
        from memory_graph import get_memory_context
        context = await get_memory_context(user_id)
        if context and query.lower() in str(context).lower(): return str(context)
        return "لا توجد ذكريات تطابق البحث."
    except Exception as e:
        logger.warning(f"Tool fetch_memory failed: {e}")
        return None

ToolRegistry.register("remind_goal", _tool_remind_goal, 9, 1, "memory")
ToolRegistry.register("analyze_progress", _tool_analyze_progress, 8, 1, "growth")
ToolRegistry.register("fetch_memory", _tool_fetch_memory, 8, 1, "memory")

INTENT_KEYWORDS = {
    "goal_tracking": ["هدف", "أهداف", "خطة", "تقدم", "progress", "goal", "target"],
    "memory_retrieval": ["ذكرت", "قلت", "اتذكر", "remember", "told"],
    "emotional_support": ["حزين", "خايف", "قلق", "sad", "worried", "anxious", "fear"],
    "learning": ["علمني", "شرح", "افهم", "learn", "teach", "explain", "course"],
    "search": ["بحث", "معلومات", "search", "information"],
    "coding": ["كود", "برمجة", "code", "python", "programming"],
    "dream": ["حلم", "حلمت", "dream"],
    "general": []
}

def detect_intent(message: str) -> Tuple[str, float]:
    if not message: return "general", 0.0
    msg_lower = message.lower()
    max_score = 0
    best = "general"
    for intent, keywords in INTENT_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in msg_lower)
        if score > max_score:
            max_score = score
            best = intent
    confidence = min(max_score / 3.0, 1.0) if max_score > 0 else 0.5
    return best, confidence

class ReasoningEngine:
    def __init__(self):
        self.context_cache: Dict[str, Dict[str, Any]] = {}
        self.cache_ttl = 60

    async def plan(self, message: str, emotion: Dict[str, Any], consciousness_context: Optional[Dict] = None, user_id: Optional[str] = None, lang: str = "ar") -> Dict[str, Any]:
        intent, confidence = detect_intent(message)

        response_mode_map = {
            "emotional_support": "emotional",
            "coding": "coding",
            "learning": "general",
            "search": "search",
            "goal_tracking": "coaching",
            "dream": "dream",
            "general": "general"
        }
        response_mode = response_mode_map.get(intent, "general")

        emotion_primary = emotion.get("primary", "neutral")
        emotion_weight = 0.8 if emotion_primary in ["sadness", "fear", "anger"] else (0.6 if emotion_primary in ["joy", "love"] else 0.5)
        if emotion_weight > 0.7: response_mode = "emotional"

        return {
            "intent": intent,
            "intent_confidence": confidence,
            "response_mode": response_mode,
            "emotion_weight": emotion_weight,
            "selected_tools": [],
            "tool_context": "",
            "reasoning_depth": "medium",
        }

reasoning_engine = ReasoningEngine()
print("✅ Reasoning Engine v8.0 initialized")
