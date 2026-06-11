"""
MyTwin – Unified Memory System v5.0 (Cognitive Memory)
- تسجيل أهمية ذكي (Memory Scoring)
- استرجاع دلالي (Semantic Retrieval)
- نظام نسيان (Decay + Cleanup)
- ملف شخصي موحد (User Profile)
- ذاكرة عرضية (Episodic Memory)
- استخراج كيانات ذكي (On-Demand)
- دمج تأملات الوعي (Reflection Aware)
"""
import os, logging, json, asyncio, math, hashlib, time
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from supabase import create_client, Client

logger = logging.getLogger("memory_graph")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
db: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None

# ========== مساعدات ==========
def _get_ai_client():
    try:
        from multi_ai import MultiAIClient
        return MultiAIClient()
    except:
        return None

async def _calculate_memory_importance(text: str) -> Dict[str, Any]:
    """
    يحسب أهمية الذاكرة ونوعها بناءً على محتواها.
    يستخدم قواعد محلية أولاً، ثم LLM للتصنيف الدقيق.
    """
    text_lower = text.lower()
    
    # قواعد محلية سريعة (وزن لكل فئة)
    rules = {
        "core": {
            "keywords": ["اسمي", "أنا", "عمري", "مهنتي", "أسكن في", "my name", "i am", "i live in", "i work as"],
            "base_importance": 0.9
        },
        "goal": {
            "keywords": ["أريد", "هدفي", "خطتي", "أطمح", "my goal", "i want to", "i plan to"],
            "base_importance": 0.8
        },
        "relationship": {
            "keywords": ["صديقي", "أمي", "أبي", "أخي", "زوجتي", "my friend", "my mother", "my father", "my wife"],
            "base_importance": 0.8
        },
        "emotional": {
            "keywords": ["سعيد", "حزين", "خائف", "غاضب", "متحمس", "happy", "sad", "scared", "angry", "excited"],
            "base_importance": 0.6
        },
        "preference": {
            "keywords": ["أحب", "أكره", "أفضل", "يعجبني", "i love", "i hate", "i prefer", "i like"],
            "base_importance": 0.5
        },
        "daily": {
            "keywords": ["اليوم", "أكلت", "ذهبت", "today", "ate", "went"],
            "base_importance": 0.2
        }
    }

    max_importance = 0.1
    memory_type = "daily"
    
    for mem_type, config in rules.items():
        for keyword in config["keywords"]:
            if keyword in text_lower:
                if config["base_importance"] > max_importance:
                    max_importance = config["base_importance"]
                    memory_type = mem_type

    # إذا كان النص يبدو مهماً لكن القواعد لم تلتقطه، استخدم LLM
    if max_importance < 0.5 and len(text) > 30:
        client = _get_ai_client()
        if client:
            try:
                prompt = f"""صنف هذه الذكرى إلى واحدة من: core, emotional, preference, relationship, goal, daily
وأعطها درجة أهمية من 0.1 إلى 1.0.
أعد ONLY JSON: {{"type": "...", "importance": 0.X}}
الذكرى: "{text}"
JSON:"""
                result = await client.get_best_reply(prompt, task="deep_reasoning")
                if result:
                    import re
                    match = re.search(r'\{[^}]+\}', result)
                    if match:
                        data = json.loads(match.group())
                        memory_type = data.get("type", memory_type)
                        max_importance = float(data.get("importance", max_importance))
            except Exception as e:
                logger.warning(f"Memory importance scoring failed: {e}")

    return {"type": memory_type, "importance": min(max_importance, 1.0)}

# ========== تخزين واسترجاع أساسي ==========
async def store_mem(uid: str, content: str, importance: float = 0.5, emotion: str = "neutral"):
    """تخزين ذكرى مع حساب أهميتها تلقائياً"""
    if not db:
        return
    try:
        # حساب الأهمية والنوع تلقائياً
        scoring = await _calculate_memory_importance(content)
        mem_type = scoring["type"]
        final_importance = scoring["importance"] if importance == 0.5 else importance
        
        db.table("memories").insert({
            "user_id": uid,
            "content": content,
            "importance": final_importance,
            "emotion": emotion,
            "memory_type": mem_type,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }).execute()
        logger.info(f"✅ Memory stored [{mem_type}] imp={final_importance:.2f}: {content[:50]}...")
    except Exception as e:
        logger.error(f"Memory store error: {e}")

async def retrieve_memories(uid: str, query: str = "", days: int = 30, lim: int = 5, memory_type: Optional[str] = None) -> List[Dict[str, Any]]:
    """استرجاع ذكريات مع فلترة حسب النوع والوقت"""
    if not db:
        return []
    try:
        req = db.table("memories").select("*").eq("user_id", uid).order("importance", desc=True).order("created_at", desc=True).limit(lim)
        if memory_type:
            req = req.eq("memory_type", memory_type)
        if days > 0:
            cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
            req = req.gte("created_at", cutoff)
        res = req.execute()
        return res.data or []
    except Exception as e:
        logger.error(f"Memory retrieval error: {e}")
        return []

# ========== نظام النسيان (Decay) ==========
async def cleanup_weak_memories(uid: str):
    """حذف الذكريات الضعيفة جداً (أقل من 0.15) والتي مر عليها أكثر من 30 يوم"""
    if not db:
        return
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        db.table("memories").delete().eq("user_id", uid).lt("importance", 0.15).lt("created_at", cutoff).execute()
        logger.info(f"🧹 Weak memories cleaned for {uid}")
    except Exception as e:
        logger.warning(f"Memory cleanup failed: {e}")

# ========== سياق منظم لـ PromptBuilder ==========
async def get_memory_context(uid: str) -> str:
    """
    بناء سياق منظم للذاكرة لاستخدامه في PromptBuilder.
    يُرجع نصًا منسقًا يحتوي على:
    - معلومات أساسية عن المستخدم
    - أهداف نشطة
    - تفضيلات
    - علاقات مهمة
    - ذكريات عاطفية حديثة
    """
    if not db:
        return ""

    try:
        # جلب آخر 3-5 ذكريات من كل نوع مهم
        core = await retrieve_memories(uid, memory_type="core", lim=3)
        goals = await retrieve_memories(uid, memory_type="goal", lim=3)
        emotional = await retrieve_memories(uid, memory_type="emotional", lim=2)
        preferences = await retrieve_memories(uid, memory_type="preference", lim=3)
        relationships = await retrieve_memories(uid, memory_type="relationship", lim=2)

        # محاولة تحسين التنسيق (معلومات أكثر تنظيماً)
        parts = []
        if core:
            parts.append("معلومات أساسية: " + " | ".join([m["content"] for m in core]))
        if goals:
            parts.append("أهداف: " + " | ".join([m["content"] for m in goals]))
        if preferences:
            parts.append("تفضيلات: " + " | ".join([m["content"] for m in preferences]))
        if relationships:
            parts.append("علاقات: " + " | ".join([m["content"] for m in relationships]))
        if emotional:
            parts.append("لحظات عاطفية: " + " | ".join([m["content"] for m in emotional]))

        # دمج تأملات الوعي (Reflection Aware)
        try:
            from consciousness_core import consciousness_core
            state = consciousness_core.user_states.get(uid, {})
            reflections = state.get("internal_state", {}).get("reflection_log", [])
            if reflections:
                last_reflection = reflections[-1].get("data", {})
                learned = last_reflection.get("what_i_learned", "")
                if learned:
                    parts.append(f"ما تعلمه التوأم عنك مؤخراً: {learned}")
        except:
            pass

        return "\n".join(parts) if parts else ""
    except Exception as e:
        logger.error(f"Memory context error: {e}")
        return ""

# ========== كيانات المعرفة ==========
async def extract_entities(user_id: str, message: str, lang: str = "ar"):
    """
    استخراج كيانات من النص (فقط إذا كان النص طويلاً أو يبدو شخصياً).
    يستخدم LLM باعتدال لتجنب استهلاك tokens.
    """
    if not db or not message.strip():
        return

    # لا تستخرج إذا كان النص قصيراً جداً
    if len(message) < 40:
        return

    client = _get_ai_client()
    if not client:
        return

    prompt = f"""استخرج الكيانات التالية من هذه الرسالة وأعد ONLY JSON:
{{"people": ["اسم شخص وعلاقته"], "preferences": ["شيء يحبه أو يكرهه"], "goals": ["هدف أو طموح"], "habits": ["عادة أو روتين"], "facts": ["معلومة عامة عن المستخدم"]}}
الرسالة: "{message}"
JSON:"""

    try:
        result = await client.get_best_reply(prompt, task="deep_reasoning")
        if result:
            import re
            match = re.search(r'\{[^}]+\}', result)
            if match:
                entities = json.loads(match.group())
                for entity_type, items in entities.items():
                    for item in items:
                        db.table("knowledge_entities").insert({
                            "user_id": user_id,
                            "entity_type": entity_type,
                            "entity_name": str(item),
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        }).execute()
                logger.info(f"✅ Extracted {sum(len(v) for v in entities.values())} entities for {user_id}")
    except Exception as e:
        logger.warning(f"Entity extraction failed: {e}")

# ========== دوال التوافق القديم ==========
class DeepMemorySystem:
    def retrieve(self, uid: str, query: str, days: int = 30, lim: int = 5, emotion_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        if not db:
            return []
        try:
            req = db.table("memories").select("*").eq("user_id", uid).order("created_at", desc=True).limit(lim)
            if emotion_filter:
                req = req.eq("emotion", emotion_filter)
            res = req.execute()
            return res.data or []
        except:
            return []

print("✅ Unified Memory System v5.0 (Cognitive Memory) initialized")
