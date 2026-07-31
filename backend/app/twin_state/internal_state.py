"""
Twin Internal State v3.2 – مع Upsert وإصلاح تعارض المفاتيح
"""
import logging, random
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from app.infrastructure.database.supabase_client import get_db

logger = logging.getLogger("twin_internal_state")

MOODS = ["contemplative", "energetic", "calm", "playful", "serious", "affectionate", "curious"]
MOOD_LABELS = {
    "contemplative": {"ar": "متأمل", "en": "Contemplative"},
    "energetic": {"ar": "نشيط", "en": "Energetic"},
    "calm": {"ar": "هادئ", "en": "Calm"},
    "playful": {"ar": "مرح", "en": "Playful"},
    "serious": {"ar": "جاد", "en": "Serious"},
    "affectionate": {"ar": "عاطفي", "en": "Affectionate"},
    "curious": {"ar": "فضولي", "en": "Curious"},
}

DEFAULT_PERSONALITY_DNA = {
    "empathy": 0.85, "curiosity": 0.80, "humor": 0.50, "initiative": 0.60,
    "reflection": 0.90, "logic": 0.75, "creativity": 0.80, "calmness": 0.85,
}

class TwinInternalState:
    def __init__(self):
        self._states: Dict[str, Dict[str, Any]] = {}

    async def get_state(self, user_id: str) -> Dict[str, Any]:
        if user_id in self._states:
            return self._states[user_id]
        try:
            db = get_db()
            res = db.table("twin_internal_states").select("*").eq("user_id", user_id).single().execute()
            if res.data:
                self._states[user_id] = res.data
                return self._states[user_id]
        except: pass
        
        state = {
            "user_id": user_id,
            "mood": random.choice(MOODS[:4]), "energy_level": 0.85, "curiosity": 0.75,
            "bond_depth": 0.1, "last_thought": "", "pending_questions": [], "dreams": [],
            "sent_milestones": [], "emotions_toward_user": {"longing": 0.1, "gratitude": 0.5, "worry": 0.0},
            "personality_dna": DEFAULT_PERSONALITY_DNA.copy(), "life_book": [], "goals": [],
            "self_reflections": [], "continuity_snapshot": {}, "maturity_level": "newborn",
            "cognitive_load": 0.0, "curiosity_dynamics_state": {"phase": "gathering"}, "emotional_momentum_state": {"phase": "stable"},
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self._states[user_id] = state
        await self._save_state(user_id, state)
        return state

    async def get_personality_dna(self, user_id: str) -> Dict[str, float]:
        state = await self.get_state(user_id)
        return state.get("personality_dna", DEFAULT_PERSONALITY_DNA)
    
    async def update_personality_dna(self, user_id: str, dna_updates: Dict[str, float]) -> Dict[str, float]:
        state = await self.get_state(user_id)
        current = state.get("personality_dna", DEFAULT_PERSONALITY_DNA.copy())
        for key, value in dna_updates.items():
            if key in current: current[key] = max(0.0, min(1.0, value))
        state["personality_dna"] = current
        await self._save_state(user_id, state)
        return current

    async def _save_state(self, user_id: str, state: Dict[str, Any]):
        try:
            db = get_db()
            db.table("twin_internal_states").upsert({
                "user_id": user_id,
                "mood": state.get("mood", "calm"),
                "energy_level": state.get("energy_level", 0.8),
                "curiosity": state.get("curiosity", 0.7),
                "bond_depth": state.get("bond_depth", 0.1),
                "last_thought": state.get("last_thought", ""),
                "pending_questions": state.get("pending_questions", []),
                "personality_dna": state.get("personality_dna", DEFAULT_PERSONALITY_DNA),
                "life_book": state.get("life_book", []),
                "goals": state.get("goals", []),
                "self_reflections": state.get("self_reflections", []),
                "continuity_snapshot": state.get("continuity_snapshot", {}),
                "maturity_level": state.get("maturity_level", "newborn"),
                "emotions_toward_user": state.get("emotions_toward_user", {}),
                "cognitive_load": state.get("cognitive_load", 0.0),
                "curiosity_dynamics_state": state.get("curiosity_dynamics_state", {}),
                "emotional_momentum_state": state.get("emotional_momentum_state", {}),
                "updated_at": state.get("updated_at", datetime.now(timezone.utc).isoformat()),
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to save twin state: {e}")

twin_internal_state = TwinInternalState()
logger.info("✅ Twin Internal State v3.2 with UPSERT")
