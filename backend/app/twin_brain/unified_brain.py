"""Unified Twin Brain v11 — extra_context من Soul Kernel + DNA في الاستجابة."""
import logging
from typing import Dict, Any
from datetime import datetime, timezone
from collections import defaultdict
logger = logging.getLogger("unified_brain")
from app.twin_state.unified_emotion import unified_emotion_engine
from app.memory.unified_memory import unified_memory_engine
from app.twin_brain.identity_service import get_identity_context
from app.twin_brain.response_builder import build_response
from app.twin_state.relationship_service import load as load_relationship
from app.twin_state.emotional_momentum import emotional_momentum_engine
from app.twin_state.cognitive_load import cognitive_load_engine
from app.twin_state.salience_engine import salience_engine
from app.twin_state.internal_state import twin_internal_state
from app.domain.services.limits_service import check_message_limit
SILENCE_MS = {"comfort": 2200, "reassure": 1600, "listen": 2500, "celebrate": 800, "reflect": 1800}
class _FallbackLimiter:
    def __init__(self): self._d = defaultdict(int); self._day = ""
    def check(self, uid):
        today = datetime.now(timezone.utc).date().isoformat()
        if today != self._day: self._d.clear(); self._day = today
        self._d[uid] += 1; return self._d[uid] <= 30
_fb = _FallbackLimiter()
async def get_personality_dna(user_id): return await twin_internal_state.get_personality_dna(user_id)
async def save_personality_dna(user_id, dna): return await twin_internal_state.update_personality_dna(user_id, dna)
class UnifiedTwinBrain:
    FULL_RESPONSE_TIERS = {"premium", "pro", "yearly"}
    def _importance(self, intensity, bond):
        imp = 50 + int(intensity * 20)
        if intensity >= 0.8 or bond >= 80: imp = max(imp, 85)
        return min(100, imp)
    async def process(self, user_id, message, lang="ar", perception=None, history=None,
                      device_info=None, tier="free", mode=None, extra_context: str = "") -> Dict[str, Any]:
        start = datetime.now(timezone.utc)
        perception = perception or {}
        can_send, remaining = True, 9999
        try: can_send, remaining = await check_message_limit(user_id, tier)
        except Exception:
            can_send = _fb.check(user_id); remaining = 0
        identity = await get_identity_context(user_id, lang)
        emo = await unified_emotion_engine.analyze(user_id=user_id, text=message, lang=lang)
        current_emotion, real_emotion = emo["primary_emotion"], emo["real_emotion"]
        intensity = emo["intensity"]
        mem = await unified_memory_engine.retrieve(user_id=user_id, query=message, current_emotion=current_emotion, limit=5)
        relevant = mem.get("memories", [])
        dna = await get_personality_dna(user_id)
        rel = await load_relationship(user_id)
        bond, phase = rel.get("bond_level", 0), rel.get("stage", "stranger")
        try:
            mom = await emotional_momentum_engine.update_momentum(user_id=user_id, detected_emotion=real_emotion, emotion_intensity=intensity)
            effective = mom.get("current_emotion", real_emotion)
        except Exception: effective = real_emotion
        intent = self._determine_intent(effective)
        behavior = self._decide_behavior(intent)
        strategy = {"goal": intent["goal"], "tone": behavior["tone"], "personality_dna": dna,
                    "emotion": effective,
                    "engine_context": f"[STATE] Emotion: {effective} | Bond: {bond} | Tier: {tier} " + (extra_context or "")}
        reply = await build_response(user_id=user_id, message=message, identity_context=identity,
            emotion_context={"current_emotion": current_emotion, "real_emotion": effective, "intensity": intensity},
            memory_context={"recent_conversations": [{"role": "user", "content": m.get("content", ""), "importance": m.get("importance", 50)} for m in relevant]},
            strategy=strategy, lang=lang)
        importance = self._importance(intensity, bond)
        await unified_memory_engine.store(user_id=user_id, content=message, reply=reply, emotion=effective, importance=importance, lang=lang)
        try: await cognitive_load_engine.evaluate_load(user_id=user_id, current_task="conversation", task_complexity=intensity)
        except Exception: pass
        try: await salience_engine.evaluate_salience(user_id=user_id, event={"type": "message", "content": message[:200], "emotion": effective})
        except Exception: pass
        evolved = self._evolve_dna(dna, self._assess_quality(effective))
        await save_personality_dna(user_id, evolved)
        latency = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        return {"reply": reply, "tone": behavior["tone"], "emotion": effective, "intensity": intensity,
                "silence_ms": SILENCE_MS.get(intent["intent"], 1500), "energy": 0.5, "bond_level": bond,
                "phase": phase, "latency_ms": round(latency, 2),
                "limits": {"can_send": can_send, "remaining": remaining},
                "memory_surfaced": relevant[0] if relevant else None,
                "memory_importance": importance, "personality_dna": evolved}
    def _determine_intent(self, emotion):
        return {"sadness": {"intent": "comfort", "goal": "مواساة"}, "fear": {"intent": "reassure", "goal": "طمأنة"},
                "anger": {"intent": "listen", "goal": "استماع"}, "joy": {"intent": "celebrate", "goal": "مشاركة الفرح"}}.get(
            emotion, {"intent": "reflect", "goal": "حضور"})
    def _decide_behavior(self, intent):
        tones = {"comfort": "soft_warm", "reassure": "calm_steady", "listen": "gentle_patient",
                 "celebrate": "warm_enthusiastic", "reflect": "calm_observant"}
        return {"behavior": intent["intent"], "tone": tones.get(intent["intent"], "neutral_warm")}
    def _assess_quality(self, emotion): return "positive" if emotion in ["joy", "love"] else "neutral"
    def _evolve_dna(self, dna, quality):
        d = 0.01
        return {"empathy": min(1.0, dna.get("empathy", 0.85) + d), "curiosity": min(1.0, dna.get("curiosity", 0.80) + d)}
unified_brain = UnifiedTwinBrain()
logger.info("✅ Unified Brain v11 (kernel-ready)")
