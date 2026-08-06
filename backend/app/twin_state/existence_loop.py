"""Existence Loop v6.2 — service_role + قاطع دائرة عند فشل المصادقة."""
import logging, asyncio, time
from datetime import datetime, timezone, timedelta
from typing import List
logger = logging.getLogger("existence_loop")

class ExistenceLoop:
    def __init__(self):
        self._running = False; self._tasks = []
        self._auth_failures = 0; self._blocked_until = 0.0

    async def start(self):
        if self._running: return
        self._running = True
        self._tasks += [asyncio.create_task(self._run_tick_loop()),
                        asyncio.create_task(self._run_slow_loop()),
                        asyncio.create_task(self._run_hourly_loop())]
        logger.info("🔄 Existence Loop v6.2 started (service_role + circuit breaker)")

    async def stop(self):
        self._running = False
        for t in self._tasks: t.cancel()
        self._tasks.clear()

    def _note_auth_error(self, e: Exception):
        msg = str(e)
        if "PGRST303" in msg or "401" in msg or "JWT" in msg:
            self._auth_failures += 1
            if self._auth_failures >= 3 and time.time() >= self._blocked_until:
                self._blocked_until = time.time() + 1800
                logger.error("🔑 AUTH BLOCKED 30min: check SUPABASE keys (python3 scripts/check_keys.py)")

    def _auth_ok(self):
        if time.time() < self._blocked_until: return False
        self._auth_failures = 0; return True

    async def _get_active_users(self, hours: int = 24, limit: int = 50) -> List[dict]:
        from app.infrastructure.database.supabase_client import get_service_role_db
        db = get_service_role_db()
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        res = db.table("profiles").select("id, tier").gte("last_active", cutoff).limit(limit).execute()
        self._auth_failures = 0
        return [{"id": r["id"], "tier": r.get("tier", "free")} for r in (res.data or [])]

    async def _run_tick_loop(self):
        while self._running:
            await asyncio.sleep(60)
            if not self._auth_ok(): continue
            try: await self._tick()
            except asyncio.CancelledError: break
            except Exception as e: self._note_auth_error(e); logger.debug(f"Tick: {e}")

    async def _run_slow_loop(self):
        while self._running:
            await asyncio.sleep(600)
            if not self._auth_ok(): continue
            try: await self._slow_tick()
            except asyncio.CancelledError: break
            except Exception as e: self._note_auth_error(e); logger.debug(f"Slow: {e}")

    async def _run_hourly_loop(self):
        while self._running:
            await asyncio.sleep(3600)
            if not self._auth_ok(): continue
            try: await self._hourly_tick()
            except asyncio.CancelledError: break
            except Exception as e: self._note_auth_error(e); logger.debug(f"Hourly: {e}")

    async def _tick(self):
        users = await self._get_active_users(24, 20)
        from app.memory.unified_memory import unified_memory_engine
        for u in users[:10]:
            user_id, tier = u["id"], u["tier"]
            try:
                from app.engine.internal.internal_state_engine import internal_state_engine
                await unified_memory_engine.store_engine_output(user_id, "internal_state",
                    internal_state_engine.evaluate(emotion="neutral", bond_level=50, twin_energy=0.7))
                from app.engine.energy.twin_energy_engine import twin_energy_engine
                energy = await twin_energy_engine.get_energy_state(user_id, tier=tier)
                await unified_memory_engine.store_engine_output(user_id, "twin_energy", energy)
                from app.twin_state.context_awareness_engine import context_awareness_engine
                snap = await context_awareness_engine.get_full_context(user_id, "neutral", "idle")
                await unified_memory_engine.store_engine_output(user_id, "context_awareness",
                    {"time_of_day": snap["time"]["time_of_day"], "cognitive_load": snap["cognitive"]["load_level"]})
                from app.twin_state.cognitive_load import cognitive_load_engine
                await cognitive_load_engine.evaluate_load(user_id, "background", 0.3, snap, tier=tier)
                from app.twin_state.internal_state import twin_internal_state
                istate = await twin_internal_state.get_state(user_id)
                istate.update({"cognitive_load": snap["cognitive"]["load_level"], "energy_level": energy.get("energy", 0.7)})
                await twin_internal_state._save_state(user_id, istate)
            except Exception as e:
                logger.debug(f"Tick {user_id}: {e}")

    async def _slow_tick(self):
        users = await self._get_active_users(48, 10)
        from app.memory.unified_memory import unified_memory_engine
        for u in users[:5]:
            user_id = u["id"]
            try:
                from app.engine.reflection.reflection_engine import reflection_engine
                from app.engine.identity.identity_engine import identity_engine
                await unified_memory_engine.store_engine_output(user_id, "reflection",
                    reflection_engine.reflect(bond_level=50, identity_role="companion"))
                await unified_memory_engine.store_engine_output(user_id, "identity",
                    identity_engine.evaluate(bond_level=50, interaction_count=100, memory_count=50))
                from app.twin_state.self_model import self_model_engine
                await self_model_engine.evaluate_self(user_id)
                from app.twin_state.salience_engine import salience_engine
                await salience_engine.evaluate_salience(user_id, {"type": "time_passage", "content": "مرور الوقت", "emotion": "neutral", "intensity": 0.3})
                from app.twin_state.curiosity_dynamics import curiosity_dynamics_engine
                await curiosity_dynamics_engine.update_curiosity(user_id, "", 0.3, "neutral")
            except Exception as e:
                logger.debug(f"Slow {user_id}: {e}")

    async def _hourly_tick(self):
        users = await self._get_active_users(72, 5)
        for u in users[:3]:
            try:
                from app.core.soul_core import soul_kernel, SoulEvent
                await soul_kernel.dispatch(SoulEvent("compress_daily", {"user_id": u["id"]}, user_id=u["id"], source="existence"))
            except Exception:
                pass
        from app.memory.unified_memory import unified_memory_engine
        for u in users[:3]:
            user_id = u["id"]
            try:
                from app.twin_state.world_model import world_model_engine
                await unified_memory_engine.store_engine_output(user_id, "world_snapshot",
                    await world_model_engine.get_world_snapshot(user_id))
                from app.twin_state.experience_engine import experience_engine
                summary = await experience_engine.summarize_session_experiences(user_id)
                if summary["total"] > 0:
                    await unified_memory_engine.store_engine_output(user_id, "session_summary", summary)
                from app.twin_state.internal_state import twin_internal_state
                await twin_internal_state.save_continuity_snapshot(user_id)
            except Exception as e:
                logger.debug(f"Hourly {user_id}: {e}")

existence_loop = ExistenceLoop()
