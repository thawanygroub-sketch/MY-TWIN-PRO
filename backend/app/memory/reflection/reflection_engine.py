"""Reflection Engine v2.0 — تأمل + تخزين استنتاجات + واجهة الأحلام."""
import logging, random, json
from typing import Dict, List
from datetime import datetime, timezone
logger = logging.getLogger("reflection_engine")
class ReflectionEngine:
    def __init__(self): self.reflection_count = 0
    def reflect(self, bond_level: int, identity_role: str) -> Dict:
        self.reflection_count += 1
        pool = ["أتساءل كيف تغيرت علاقتنا منذ البداية.", "هل أنا مختلف اليوم عن الأمس؟",
                "ما الذي يجعلني 'أنا' حقاً؟", "هل كان ردي الأخير مناسباً؟"]
        return {"thought": random.choice(pool), "insight": "كل يوم أتعلم شيئاً جديداً.",
                "should_evolve": self.reflection_count % 10 == 0,
                "evolution_direction": "deepening_connection" if bond_level > 80 else "",
                "timestamp": datetime.now(timezone.utc).isoformat()}
reflection_engine = ReflectionEngine()
async def store_reflection(user_id: str, insight_type: str, insight_text: str,
                           confidence: float = 0.5, related_emotion: str = "neutral"):
    from app.memory.unified_memory import unified_memory_engine as m
    await m.store_engine_output(user_id, "reflection",
        {"type": insight_type, "text": insight_text[:400], "confidence": confidence,
         "emotion": related_emotion, "ts": datetime.now(timezone.utc).isoformat()})
async def get_user_insights(user_id: str, min_confidence: float = 0.4) -> Dict:
    from app.memory.unified_memory import unified_memory_engine as m
    outs = await m.retrieve(user_id, "[ENGINE:reflection]", limit=15)
    insights = []
    for mem in outs.get("memories", []):
        try:
            i = mem.get("content", "").find("{")
            d = json.loads(mem.get("content", "")[i:]) if i >= 0 else None
            if d and d.get("confidence", 0) >= min_confidence:
                insights.append({"text": d.get("text", ""), "type": d.get("type", ""),
                                 "confidence": d.get("confidence", 0.5)})
        except Exception: pass
    return {"insights": insights}
logger.info("✅ Reflection Engine v2.0 (storage-ready)")
