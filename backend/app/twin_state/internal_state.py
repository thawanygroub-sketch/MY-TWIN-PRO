"""Twin Internal State v4.0 — الحالة الداخلية الكاملة: حياة، تأملات، DNA، أهداف، استمرارية."""
import logging, random, json
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from app.infrastructure.database.supabase_client import get_db
logger = logging.getLogger("twin_internal_state")
MOODS = ["contemplative", "energetic", "calm", "playful", "serious", "affectionate", "curious"]
DEFAULT_DNA = {"empathy": 0.85, "curiosity": 0.8, "humor": 0.5, "initiative": 0.6,
               "reflection": 0.9, "logic": 0.75, "creativity": 0.8, "calmness": 0.85}
class TwinInternalState:
    async def get_state(self, user_id: str) -> Dict[str, Any]:
        try:
            db = get_db()
            res = db.table("twin_internal_states").select("*").eq("user_id", user_id).single().execute()
            if res.data: return res.data
        except Exception: pass
        return {"user_id": user_id, "mood": random.choice(MOODS[:4]), "energy_level": 0.85,
                "curiosity": 0.75, "bond_depth": 0.1, "last_thought": "",
                "cognitive_load": 0.0, "updated_at": datetime.now(timezone.utc).isoformat()}
    async def _save_state(self, user_id: str, state: Dict[str, Any]):
        try:
            db = get_db()
            db.table("twin_internal_states").upsert({
                "user_id": user_id, "mood": state.get("mood", "calm"),
                "energy_level": state.get("energy_level", 0.8),
                "curiosity": state.get("curiosity", 0.7),
                "bond_depth": state.get("bond_depth", 0.1),
                "last_thought": state.get("last_thought", ""),
                "cognitive_load": state.get("cognitive_load", 0.0),
                "updated_at": datetime.now(timezone.utc).isoformat()}).execute()
        except Exception as e:
            logger.warning(f"Failed to save twin state: {e}")
    async def update_field(self, user_id: str, key: str, value: Any):
        st = await self.get_state(user_id); st[key] = value; await self._save_state(user_id, st)
    # ── DNA ──
    async def get_personality_dna(self, user_id: str) -> Dict[str, float]:
        try:
            from app.memory.unified_memory import unified_memory_engine as m
            outs = await m.retrieve(user_id, "[ENGINE:personality_dna]", limit=1)
            for mem in outs.get("memories", []):
                s = re_search(mem.get("content", ""))
                if s: return s
        except Exception: pass
        return dict(DEFAULT_DNA)
    async def update_personality_dna(self, user_id: str, dna: Dict[str, float]):
        from app.memory.unified_memory import unified_memory_engine as m
        await m.store_engine_output(user_id, "personality_dna", dna)
    # ── كتاب الحياة ──
    async def add_life_book_entry(self, user_id: str, text: str, metadata: Optional[Dict] = None):
        from app.memory.unified_memory import unified_memory_engine as m
        await m.store_engine_output(user_id, "life_book",
            {"text": text[:300], "metadata": metadata or {}, "ts": datetime.now(timezone.utc).isoformat()})
    async def get_life_book(self, user_id: str, limit: int = 20) -> List[Dict]:
        return await self._get_outputs(user_id, "life_book", limit)
    # ── التأملات ──
    async def add_self_reflection(self, user_id: str, observation: str, confidence: float = 0.5):
        from app.memory.unified_memory import unified_memory_engine as m
        await m.store_engine_output(user_id, "self_reflection",
            {"observation": observation[:300], "confidence": confidence, "ts": datetime.now(timezone.utc).isoformat()})
    async def get_self_reflections(self, user_id: str, limit: int = 5) -> List[Dict]:
        return await self._get_outputs(user_id, "self_reflection", limit)
    # ── الأهداف ─
    async def get_active_goals(self, user_id: str) -> List[Dict]:
        return await self._get_outputs(user_id, "goal", 5)
    # ── الاستمرارية ──
    async def save_continuity_snapshot(self, user_id: str):
        st = await self.get_state(user_id)
        from app.memory.unified_memory import unified_memory_engine as m
        await m.store_engine_output(user_id, "continuity",
            {"mood": st.get("mood"), "bond_depth": st.get("bond_depth"),
             "curiosity": st.get("curiosity"), "ts": datetime.now(timezone.utc).isoformat()})
    async def _get_outputs(self, user_id: str, engine: str, limit: int) -> List[Dict]:
        try:
            from app.memory.unified_memory import unified_memory_engine as m
            outs = await m.retrieve(user_id, f"[ENGINE:{engine}]", limit=limit)
            results = []
            for mem in outs.get("memories", []):
                parsed = re_search(mem.get("content", ""))
                if parsed: results.append(parsed)
            return results
        except Exception:
            return []
def re_search(content: str) -> Optional[Dict]:
    try:
        start = content.find("{")
        if start < 0: return None
        return json.loads(content[start:])
    except Exception:
        return None
twin_internal_state = TwinInternalState()
logger.info("✅ Twin Internal State v4.0 (full lifecycle)")
