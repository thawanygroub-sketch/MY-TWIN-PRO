import logging, random
from typing import Dict, Any
from datetime import datetime, timezone
from app.infrastructure.database.supabase_client import get_db

logger = logging.getLogger("twin_internal_state")

MOODS = ["contemplative", "energetic", "calm", "playful", "serious", "affectionate", "curious"]

class TwinInternalState:
    async def get_state(self, user_id: str) -> Dict[str, Any]:
        try:
            db = get_db()
            res = db.table("twin_internal_states").select("*").eq("user_id", user_id).single().execute()
            if res.data: return res.data
        except: pass
        return {
            "user_id": user_id, "mood": random.choice(MOODS[:4]), "energy_level": 0.85,
            "curiosity": 0.75, "bond_depth": 0.1, "last_thought": "",
            "cognitive_load": 0.0, "updated_at": datetime.now(timezone.utc).isoformat(),
        }

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
                "cognitive_load": state.get("cognitive_load", 0.0),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
        except Exception as e:
            logger.warning(f"Failed to save twin state: {e}")

twin_internal_state = TwinInternalState()
logger.info("✅ Twin Internal State v3.1 with UPSERT")
