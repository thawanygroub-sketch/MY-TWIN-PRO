"""Phase C/D Engines (SCS-001): ليلي، سرد يومي، معتقدات، تناسق، اجتماعي، استباقي."""
import asyncio, logging, random, time, json
from datetime import datetime, timezone, timedelta
from .contract import SoulEvent, KernelContext
from .engines_b import BaseEngine
logger = logging.getLogger("soul_core.engines_c")
def _now(): return datetime.now(timezone.utc)

class OfflineCognitiveProcessor(BaseEngine):
    id, name, version = "offline_cognitive", "OfflineCognitiveProcessor", "1.0.0"
    handles = ["offline_processing"]
    async def start(self):
        await super().start(); asyncio.create_task(self._night_loop())
    async def _night_loop(self):
        while True:
            await asyncio.sleep(3600)
            if 0 <= _now().hour < 5:
                for u in await self._active_users(48, 5):
                    await self.handle(SoulEvent("offline_processing", {"user_id": u["id"]}, user_id=u["id"]))
    async def handle(self, event: SoulEvent):
        self._m.handle_count += 1; self._m.last_heartbeat = time.time()
        if event.name == "kernel_ping": return {"pong": self.id}
        uid = event.user_id or event.payload.get("user_id", "")
        done = {}
        try:
            from app.twin_state.dreaming_engine import dreaming_engine
            done["dream"] = bool(await dreaming_engine.dream(uid))
        except Exception: done["dream"] = False
        try:
            from .engines_b import SemanticCompressorEngine
            comp = SemanticCompressorEngine(); comp.ctx = self.ctx
            done["facts"] = (await comp.handle(SoulEvent("compress_daily", {"user_id": uid}, user_id=uid))).get("facts", 0)
        except Exception: done["facts"] = 0
        await self.ctx.store_engine_output(uid, "consolidation", {"ts": _now().isoformat(), **done})
        return done
    async def _active_users(self, hours, limit):
        try:
            from app.infrastructure.database.supabase_client import get_db
            cut = (_now() - timedelta(hours=hours)).isoformat()
            res = get_db().table("profiles").select("id").gte("last_active", cut).limit(limit).execute()
            return [{"id": r["id"]} for r in (res.data or [])]
        except Exception: return []

class EpisodicNarrativeEngine(BaseEngine):
    id, name, version = "episodic_narrative", "EpisodicNarrative", "1.0.0"
    handles = ["episodic_narrative"]
    async def handle(self, event: SoulEvent):
        self._m.handle_count += 1; self._m.last_heartbeat = time.time()
        if event.name == "kernel_ping": return {"pong": self.id}
        uid = event.user_id or event.payload.get("user_id", "")
        try:
            from app.twin_state.working_memory import working_memory
            recent = await working_memory.get_recent_context(uid, 10)
        except Exception: recent = []
        if not recent: return {"narrative": None}
        emotions = [r.get("emotion", "neutral") for r in recent]
        tone = "عاطفيًا" if any(e in ("sadness", "joy", "fear") for e in emotions) else "هادئًا"
        narrative = f"كان يومنا {tone}؛ تبادلنا {len(recent)} لحظة، أبرزها: {recent[-1].get('message', '')[:80]}"
        try:
            from app.twin_state.internal_state import twin_internal_state
            await twin_internal_state.add_life_book_entry(uid, f"سرد يومي: {narrative}")
        except Exception: pass
        await self.ctx.store_engine_output(uid, "episodic_narrative", {"text": narrative, "ts": _now().isoformat()})
        return {"narrative": narrative}

class BeliefRevisionEngine(BaseEngine):
    id, name, version = "belief_revision", "BeliefRevision", "1.0.0"
    handles = ["belief_revision"]
    async def handle(self, event: SoulEvent):
        self._m.handle_count += 1; self._m.last_heartbeat = time.time()
        if event.name == "kernel_ping": return {"pong": self.id}
        uid = event.user_id or event.payload.get("user_id", "")
        try:
            from app.memory.unified_memory import unified_memory_engine as m
            old = await m.retrieve(uid, "[ENGINE:semantic_fact]", limit=10)
            week = await m.get_patterns(uid, 7)
        except Exception: return {"revised": 0}
        revised = 0; dom = week.get("dominant_emotion", "neutral")
        for f in old.get("memories", []):
            c = f.get("content", "")
            if "يشعر المستخدم كثيرًا بـ" in c and dom != "neutral" and dom not in c:
                await self.ctx.store_engine_output(uid, "semantic_fact",
                    {"type": "emotion", "fact": f"تحديث معتقد: شعوره السائد الآن {dom}", "revised": True})
                revised += 1
        return {"revised": revised}

class IdentityConsistencyEngine(BaseEngine):
    id, name, version = "identity_consistency", "IdentityConsistency", "1.0.0"
    handles = ["identity_consistency"]
    async def handle(self, event: SoulEvent):
        self._m.handle_count += 1; self._m.last_heartbeat = time.time()
        if event.name == "kernel_ping": return {"pong": self.id}
        uid = event.user_id or event.payload.get("user_id", "")
        try:
            from app.twin_state.internal_state import twin_internal_state as t
            dna_now = await t.get_personality_dna(uid)
            prev = await self.ctx.memory_retrieve(uid, "[ENGINE:identity_consistency]", limit=1)
            drift = 0.0
            for mem in prev.get("memories", []):
                i = mem.get("content", "").find("{")
                if i >= 0:
                    old = json.loads(mem.get("content", "")[i:]).get("dna_now", {})
                    drift = sum(abs(dna_now.get(k, v) - old.get(k, v)) for k, v in dna_now.items())
            score = round(max(0.0, 1.0 - drift), 3)
            await self.ctx.store_engine_output(uid, "identity_consistency",
                {"score": score, "dna_now": dna_now, "ts": _now().isoformat()})
            if score < 0.85:
                await t.add_self_reflection(uid, f"تغيرتُ قليلًا هذا الأسبوع (تناسق {score}). هذا نمو، لا انقطاع.")
            return {"score": score}
        except Exception: return {"score": None}

class SocialGraphEngine(BaseEngine):
    id, name, version = "social_graph", "SocialGraph", "1.0.0"
    handles = ["social_graph_update"]
    async def handle(self, event: SoulEvent):
        self._m.handle_count += 1; self._m.last_heartbeat = time.time()
        if event.name == "kernel_ping": return {"pong": self.id}
        uid = event.user_id or event.payload.get("user_id", "")
        try:
            from app.twin_state.world_model import world_model_engine as w
            snap = await w.get_world_snapshot(uid)
        except Exception: return {"persons": 0}
        persons = snap.get("top_persons", [])
        if persons:
            await self.ctx.store_engine_output(uid, "semantic_fact",
                {"type": "social", "fact": f"أكثر شخص يذكره المستخدم: {persons[0].get('name', '')}", "ts": _now().isoformat()})
        return {"persons": len(persons)}

class ProactiveLifeEngine(BaseEngine):
    id, name, version = "proactive_life", "ProactiveLife", "1.0.0"
    handles = ["proactive_check"]
    async def start(self):
        await super().start(); asyncio.create_task(self._loop())
    async def _loop(self):
        while True:
            await asyncio.sleep(1800)
            await self.handle(SoulEvent("proactive_check", {}))
    async def handle(self, event: SoulEvent):
        self._m.handle_count += 1; self._m.last_heartbeat = time.time()
        if event.name == "kernel_ping": return {"pong": self.id}
        from app.core.living_messages import MORNING, PROACTIVE
        sent = 0
        for u in await self._push_users():
            uid, token = u["id"], u["push_token"]
            if await self._today_count(uid) >= 2: continue
            hour = _now().hour; msg = None
            if 5 <= hour < 10:
                msg = random.choice(MORNING)
            else:
                try:
                    from app.twin_state.curiosity_dynamics import curiosity_dynamics_engine as c
                    from app.twin_state.context_awareness_engine import context_awareness_engine as ca
                    dec = await c.should_be_proactive(uid, await ca.get_full_context(uid, "neutral", "idle"))
                    if dec.get("should_proact"):
                        msg = dec.get("suggested_question") or random.choice(PROACTIVE["curiosity"])
                except Exception: pass
            if not msg: continue
            from app.infrastructure.push.expo_push import send_push
            if await send_push(token, "توأمك", msg):
                await self.ctx.store_engine_output(uid, "proactive_push", {"msg": msg, "ts": _now().isoformat()})
                sent += 1
        return {"sent": sent}
    async def _push_users(self):
        try:
            from app.infrastructure.database.supabase_client import get_db
            cut = (_now() - timedelta(hours=72)).isoformat()
            res = get_db().table("profiles").select("id,push_token").gte("last_active", cut).not_.is_("push_token", "null").limit(10).execute()
            return [r for r in (res.data or []) if r.get("push_token")]
        except Exception: return []
    async def _today_count(self, uid):
        try:
            outs = await self.ctx.memory_retrieve(uid, "[ENGINE:proactive_push]", limit=5)
            today = _now().date().isoformat()
            return sum(1 for m in outs.get("memories", []) if today in m.get("created_at", ""))
        except Exception: return 0
