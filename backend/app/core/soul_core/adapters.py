"""Adapters للمحركات الموجودة + InteractionPipelineEngine (القرارات هنا، لا في النواة)."""
import logging, re, time
from typing import Any, Dict, Optional
from .contract import EngineState, EngineMetrics, KernelContext, SoulEvent
logger = logging.getLogger("soul_core.adapters")

class LegacyEngineAdapter:
    """يلف أي محرك قديم بعقد ISoulEngine بدون إعادة كتابة."""
    def __init__(self, id: str, name: str, version: str, handles: list, fn):
        self.id, self.name, self.version, self.handles, self._fn = id, name, version, handles, fn
        self.state = EngineState.CREATED
        self._m = EngineMetrics(version=version); self._t0 = time.time()
    async def initialize(self, ctx: KernelContext): self.ctx = ctx; self.state = EngineState.READY
    async def start(self): self.state = EngineState.RUNNING; self._m.last_heartbeat = time.time()
    async def stop(self): self.state = EngineState.STOPPED
    async def pause(self): self.state = EngineState.PAUSED
    async def resume(self): self.state = EngineState.RUNNING
    async def handle(self, event: SoulEvent) -> Dict[str, Any]:
        self._m.handle_count += 1; self._m.last_heartbeat = time.time()
        if event.name == "kernel_ping": return {"pong": self.id}
        try: return await self._fn(event, self.ctx)
        except Exception as e:
            self._m.error_count += 1; return {"error": f"{self.id}: {e}"}
    def heartbeat(self): self._m.uptime_s = time.time() - self._t0; return self._m
    def serialize(self): return None
    def restore(self, snap): pass

BODY_WORDS = ["رجل", "قدم", "ظهر", "كتف", "رأس", "صداع", "تعب", "إرهاق", "نوم", "مشي", "خطوات", "رياضة"]

class InteractionPipelineEngine:
    """Perception→Grounding→Brain→Expression. محرك مسجّل؛ النواة لا تقرر."""
    id, name, version = "interaction_pipeline", "InteractionPipeline", "1.0.0"
    handles = ["user_message"]
    def __init__(self):
        self.state = EngineState.CREATED; self._m = EngineMetrics(version=self.version); self._t0 = time.time()
    async def initialize(self, ctx): self.ctx = ctx; self.state = EngineState.READY
    async def start(self): self.state = EngineState.RUNNING; self._m.last_heartbeat = time.time()
    async def stop(self): self.state = EngineState.STOPPED
    async def pause(self): self.state = EngineState.PAUSED
    async def resume(self): self.state = EngineState.RUNNING
    def heartbeat(self): self._m.uptime_s = time.time() - self._t0; return self._m
    def serialize(self): return None
    def restore(self, snap): pass

    async def handle(self, event: SoulEvent) -> Dict[str, Any]:
        self._m.handle_count += 1; self._m.last_heartbeat = time.time()
        if event.name == "kernel_ping": return {"pong": self.id}
        p = event.payload
        user_id, message = p.get("user_id", ""), p.get("message", "")
        device_info = p.get("device_info") or {}
        # 1) ملاحظة حياة مُسنَدة (خطوات اليوم + الأمس) بلا اختلاق
        steps_today = self._steps(device_info.get("contextual_prompt", ""))
        obs = await self._life_observation(user_id, steps_today, message)
        # 2) كتابة سجل الحياة اليومي
        if steps_today:
            try: await self.ctx.store_engine_output(user_id, "life_log",
                {"date": time.strftime("%Y-%m-%d"), "steps": steps_today, "source": "pedometer"})
            except Exception: pass
        # 3) الدماغ مع سياق التأريض
        from app.twin_brain.unified_brain import unified_brain
        extra = f"[OBSERVATION] {device_info.get('contextual_prompt','')[:400]} [LIFE_LOG] {obs} " \
                f"[RULE] استخدم الملاحظات الشخصية أعلاه فقط إن كانت ذات صلة؛ لا تخترع أرقامًا."
        res = await unified_brain.process(user_id, message, p.get("lang", "ar"),
            perception=p.get("perception"), history=p.get("history"),
            device_info=device_info, tier=p.get("tier", "free"), extra_context=extra)
        # 4) نية التعبير للجسد والصوت
        emo, inten = res.get("emotion", "neutral"), float(res.get("intensity", 0.5))
        expr = {"breath": "normal", "smile": 0.0, "pause": 0.0, "concern": 0.0}
        if emo in ("sadness", "fear"): expr.update(breath="deep", pause=1.2, concern=0.7)
        if emo == "joy": expr.update(smile=0.7, breath="bright")
        # 5) تجربة + أهمية عبر المحركات المسجلة
        try:
            from app.twin_state.experience_engine import experience_engine
            await experience_engine.process_event(user_id, {"type": "message",
                "content": message[:200], "emotion": emo, "importance": res.get("memory_importance", 50)})
        except Exception: pass
        # 6) لحام السلاسل: ذاكرة عاملة + أرشيف خام + نموذج عالم
        try:
            from app.twin_state.working_memory import working_memory
            await working_memory.add_interaction(user_id, message, res.get("reply", ""), emo)
        except Exception: pass
        try:
            from app.memory.archive.raw_archive import archive_message
            await archive_message(user_id, message, "user", {"primary": emo, "intensity": inten})
            await archive_message(user_id, res.get("reply", ""), "twin", {"primary": emo, "intensity": inten})
        except Exception: pass
        try:
            from app.twin_state.world_model import world_model_engine as w
            await w.update_world(user_id, message, res.get("reply", ""))
        except Exception: pass
        res.update({"expression_intent": expr, "life_observation": obs})
        return res

    def _steps(self, contextual: str) -> int:
        m = re.search(r"(\d[\d,]*)\s*خطوة", contextual or "")
        return int(m.group(1).replace(",", "")) if m else 0

    async def _life_observation(self, user_id, steps_today, message) -> str:
        yesterday = 0
        try:
            mem = await self.ctx.memory_retrieve(user_id, "[ENGINE:life_log]", limit=3)
            for m in mem.get("memories", []):
                s = re.search(r'"steps":\s*(\d+)', m.get("content", ""))
                if s: yesterday = max(yesterday, int(s.group(1)))
        except Exception: pass
        if not any(w in (message or "") for w in BODY_WORDS):
            return f"steps_today={steps_today or 'unknown'} steps_yesterday={yesterday or 'unknown'}"
        if steps_today and steps_today > 8000:
            return (f"لاحظت أنك مشيت {steps_today} خطوة اليوم"
                    + (f" و{yesterday} بالأمس" if yesterday else "")
                    + " — أكثر من معتادك وقد يفسر الإرهاق. جرّب الاسترخاء أو كمادات باردة، وإن استمر فتسمع رأي مختص.")
        if steps_today: return f"خطواتك اليوم {steps_today} ضمن معتادك، فلا أربطها بتعب غير عادي."
        return "ليس لدي ملاحظة كافية عن نشاطك اليوم لأربطها بما تشعر به."

def build_legacy_engines():
    async def mem_fn(ev, ctx):
        from app.memory.unified_memory import unified_memory_engine as m
        return await m.store_engine_output(ev.user_id, ev.payload.get("engine", "custom"), ev.payload.get("output", {}))
    async def emo_fn(ev, ctx):
        from app.twin_state.unified_emotion import unified_emotion_engine as e
        return await e.analyze(user_id=ev.user_id, text=ev.payload.get("text", ""), lang=ev.payload.get("lang", "ar"))
    async def sal_fn(ev, ctx):
        from app.twin_state.salience_engine import salience_engine as s
        await s.evaluate_salience(ev.user_id, ev.payload.get("event", {})); return {"salience": "ok"}
    async def exp_fn(ev, ctx):
        from app.twin_state.experience_engine import experience_engine as x
        return await x.process_event(ev.user_id, ev.payload.get("event", {}), ev.payload.get("context"))
    async def id_fn(ev, ctx):
        from app.twin_brain.identity_service import get_identity_context as g
        return await g(ev.user_id, ev.payload.get("lang", "ar"))
    return [
        LegacyEngineAdapter("memory", "UnifiedMemory", "2.1.0", ["memory_store"], mem_fn),
        LegacyEngineAdapter("emotion", "UnifiedEmotion", "2.0.0", ["emotion_analyze"], emo_fn),
        LegacyEngineAdapter("salience", "SalienceEngine", "1.0.0", ["salience_evaluate"], sal_fn),
        LegacyEngineAdapter("experience", "ExperienceEngine", "1.0.0", ["experience_process"], exp_fn),
        LegacyEngineAdapter("identity", "IdentityService", "2.0.0", ["identity_context"], id_fn),
        InteractionPipelineEngine(),
    ]
