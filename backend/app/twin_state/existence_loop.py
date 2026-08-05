"""
Existence Loop v6.1 – يستخدم service_role مباشرة لتجنب JWT expired
"""
import logging, asyncio
from datetime import datetime, timezone, timedelta
from typing import List

logger = logging.getLogger("existence_loop")

class ExistenceLoop:
    def __init__(self):
        self._running = False
        self._tasks = []

    async def start(self):
        if self._running: return
        self._running = True
        self._tasks.append(asyncio.create_task(self._run_tick_loop()))
        self._tasks.append(asyncio.create_task(self._run_slow_loop()))
        self._tasks.append(asyncio.create_task(self._run_hourly_loop()))
        logger.info("🔄 Existence Loop v6.1 started with service_role auth")

    async def stop(self):
        self._running = False
        for t in self._tasks: t.cancel()
        self._tasks.clear()

    async def _get_active_users(self, hours: int = 24, limit: int = 50) -> List[dict]:
        """جلب المستخدمين النشطين باستخدام service_role"""
        try:
            from app.infrastructure.database.supabase_client import get_service_role_db
            db = get_service_role_db()
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
            res = db.table("profiles").select("id, tier").gte("last_active", cutoff).limit(limit).execute()
            users = []
            for row in (res.data or []):
                users.append({"id": row["id"], "tier": row.get("tier", "free")})
            return users
        except Exception as e:
            logger.warning(f"Failed to get active users: {e}")
            return []

    async def _get_user_tier(self, user_id: str) -> str:
        """جلب tier باستخدام service_role"""
        try:
            from app.infrastructure.database.supabase_client import get_service_role_db
            db = get_service_role_db()
            res = db.table("profiles").select("tier").eq("id", user_id).single().execute()
            return res.data.get("tier", "free") if res.data else "free"
        except:
            return "free"

    async def _run_tick_loop(self):
        while self._running:
            await asyncio.sleep(60)
            try: await self._tick()
            except asyncio.CancelledError: break
            except Exception as e: logger.error(f"Tick: {e}")

    async def _run_slow_loop(self):
        while self._running:
            await asyncio.sleep(600)
            try: await self._slow_tick()
            except asyncio.CancelledError: break
            except Exception as e: logger.error(f"Slow: {e}")

    async def _run_hourly_loop(self):
        while self._running:
            await asyncio.sleep(3600)
            try: await self._hourly_tick()
            except asyncio.CancelledError: break
            except Exception as e: logger.error(f"Hourly: {e}")

    async def _tick(self):
        users = await self._get_active_users(24, 20)
        if not users: return
        from app.memory.unified_memory import unified_memory_engine
        for u in users[:10]:
            user_id = u["id"]
            tier = u["tier"]
            try:
                from app.engine.internal.internal_state_engine import internal_state_engine
                state = internal_state_engine.evaluate(emotion="neutral", bond_level=50, twin_energy=0.7)
                await unified_memory_engine.store_engine_output(user_id, "internal_state", state)
                
                from app.engine.energy.twin_energy_engine import twin_energy_engine
                energy = await twin_energy_engine.get_energy_state(user_id, tier=tier)
                await unified_memory_engine.store_engine_output(user_id, "twin_energy", energy)
                
                from app.twin_state.context_awareness_engine import context_awareness_engine
                snapshot = await context_awareness_engine.get_full_context(user_id, "neutral", "idle")
                await unified_memory_engine.store_engine_output(user_id, "context_awareness", {
                    "time_of_day": snapshot["time"]["time_of_day"],
                    "cognitive_load": snapshot["cognitive"]["load_level"]
                })
                
                from app.twin_state.cognitive_load import cognitive_load_engine
                await cognitive_load_engine.evaluate_load(user_id, "background", 0.3, snapshot, tier=tier)
                
                from app.twin_state.internal_state import twin_internal_state
                istate = await twin_internal_state.get_state(user_id)
                istate["cognitive_load"] = snapshot["cognitive"]["load_level"]
                istate["energy_level"] = energy.get("energy", 0.7)
                await twin_internal_state._save_state(user_id, istate)
            except Exception as e:
                logger.debug(f"Tick {user_id}: {e}")

    async def _slow_tick(self):
        users = await self._get_active_users(48, 10)
        if not users: return
        from app.memory.unified_memory import unified_memory_engine
        for u in users[:5]:
            user_id = u["id"]
            try:
                from app.engine.reflection.reflection_engine import reflection_engine
                from app.engine.identity.identity_engine import identity_engine
                reflection = reflection_engine.reflect(bond_level=50, identity_role="companion")
                identity = identity_engine.evaluate(bond_level=50, interaction_count=100, memory_count=50)
                await unified_memory_engine.store_engine_output(user_id, "reflection", reflection)
                await unified_memory_engine.store_engine_output(user_id, "identity", identity)
                
                from app.twin_state.self_model import self_model_engine
                await self_model_engine.evaluate_self(user_id)
                
                from app.twin_state.salience_engine import salience_engine
                await salience_engine.evaluate_salience(user_id, {
                    "type": "time_passage",
                    "content": "مرور الوقت",
                    "emotion": "neutral",
                    "intensity": 0.3
                })
                
                from app.twin_state.curiosity_dynamics import curiosity_dynamics_engine
                await curiosity_dynamics_engine.update_curiosity(user_id, "", 0.3, "neutral")
            except Exception as e:
                logger.debug(f"Slow {user_id}: {e}")

    async def _hourly_tick(self):
        users = await self._get_active_users(72, 5)
        if not users: return
        from app.memory.unified_memory import unified_memory_engine
        for u in users[:3]:
            user_id = u["id"]
            try:
                from app.twin_state.world_model import world_model_engine
                snapshot = await world_model_engine.get_world_snapshot(user_id)
                await unified_memory_engine.store_engine_output(user_id, "world_snapshot", snapshot)
                
                from app.twin_state.experience_engine import experience_engine
                summary = await experience_engine.summarize_session_experiences(user_id)
                if summary["total"] > 0:
                    await unified_memory_engine.store_engine_output(user_id, "session_summary", summary)
                
                from app.twin_state.internal_state import twin_internal_state
                await twin_internal_state.save_continuity_snapshot(user_id)
            except Exception as e:
                logger.debug(f"Hourly {user_id}: {e}")

existence_loop = ExistenceLoop()
logger.info("✅ Existence Loop v6.1 ready with service_role auth")
