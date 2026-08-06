"""Phase-B Engines (SCS-001): SemanticCompressor + ReflectionScore — بلا Over-Architecture."""
import logging, re, time
from collections import Counter
from .contract import EngineState, EngineMetrics, KernelContext, SoulEvent
logger = logging.getLogger("soul_core.engines_b")

class BaseEngine:
    def __init__(self):
        self.state = EngineState.CREATED; self._m = EngineMetrics(version=self.version); self._t0 = time.time()
    async def initialize(self, ctx: KernelContext): self.ctx = ctx; self.state = EngineState.READY
    async def start(self): self.state = EngineState.RUNNING; self._m.last_heartbeat = time.time()
    async def stop(self): self.state = EngineState.STOPPED
    async def pause(self): self.state = EngineState.PAUSED
    async def resume(self): self.state = EngineState.RUNNING
    def heartbeat(self): self._m.uptime_s = time.time() - self._t0; return self._m
    def serialize(self): return None
    def restore(self, snap): pass

class SemanticCompressorEngine(BaseEngine):
    """يضغط عشرات الذكريات إلى حقائق قليلة قابلة للاسترجاع (يخفض تكلفة AI)."""
    id, name, version = "semantic_compressor", "SemanticCompressor", "1.0.0"
    handles = ["compress_daily"]
    async def handle(self, event: SoulEvent):
        self._m.handle_count += 1; self._m.last_heartbeat = time.time()
        if event.name == "kernel_ping": return {"pong": self.id}
        uid = event.user_id or event.payload.get("user_id", "")
        mem = await self.ctx.memory_retrieve(uid, "", limit=50)
        facts = self._compress(mem.get("memories", []))
        for f in facts:
            await self.ctx.store_engine_output(uid, "semantic_fact", f)
        logger.info(f"[compressor] {uid}: {len(facts)} facts")
        return {"facts": len(facts)}
    def _compress(self, memories):
        facts = []
        emo = Counter(m.get("emotion", "neutral") for m in memories)
        words = Counter()
        for m in memories:
            for w in re.findall(r"[\u0600-\u06FF]{3,}", m.get("content", "")):
                words[w] += 1
        for w, c in words.most_common(5):
            if c >= 2: facts.append({"type": "topic", "fact": f"يتحدث المستخدم كثيرًا عن: {w}", "count": c})
        for e, c in emo.items():
            if c >= 3 and e != "neutral": facts.append({"type": "emotion", "fact": f"يشعر المستخدم كثيرًا بـ {e}", "count": c})
        return facts[:10]

class ReflectionScoreEngine(BaseEngine):
    """بعد كل محادثة: هل ساعدت؟ هل فهمت؟ هل تعاطفت؟ — يتعلم منها الـ DNA."""
    id, name, version = "reflection_score", "ReflectionScore", "1.0.0"
    handles = ["interaction_complete"]
    async def handle(self, event: SoulEvent):
        self._m.handle_count += 1; self._m.last_heartbeat = time.time()
        if event.name == "kernel_ping": return {"pong": self.id}
        p = event.payload; uid = event.user_id or p.get("user_id", "")
        msg = p.get("message", "")
        gratitude = any(k in msg for k in ["شكرا", "شكرًا", "ممتاز", "رائع", "جميل", "أفدتني"])
        negative = any(k in msg for k in ["لا تفهم", "ما فهمت", "فهمت خطأ", "سيء"])
        cl = lambda v: round(max(0.0, min(1.0, v)), 2)
        score = {"helped": cl(0.6 + (0.3 if gratitude else 0) - (0.25 if negative else 0)),
                 "understood": cl(0.7 + (0.2 if gratitude else 0) - (0.35 if negative else 0)),
                 "empathetic": cl(0.8 if p.get("emotion") in ("sadness", "fear") else 0.6)}
        await self.ctx.store_engine_output(uid, "reflection_score", score)
        if negative:
            try:
                from app.twin_state.internal_state import twin_internal_state
                dna = await twin_internal_state.get_personality_dna(uid)
                dna["reflection"] = min(1.0, dna.get("reflection", 0.9) + 0.01)
                await twin_internal_state.update_personality_dna(uid, dna)
            except Exception: pass
        return {"reflection": score}
