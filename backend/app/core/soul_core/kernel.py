"""Soul Kernel v1.0 — يُدير ولا يُفكر: boot، دورة حياة، توجيه FIFO، صحة، تعافٍ، استمرارية."""
import asyncio, logging, time
from collections import defaultdict
from typing import Any, Dict, List
from .contract import EngineState, KernelState, KernelContext, SoulEvent, EventClass
logger = logging.getLogger("soul_kernel")

class SoulKernel:
    def __init__(self):
        self.state = KernelState.OFFLINE
        self.ctx = KernelContext(self)
        self._engines: Dict[str, Any] = {}
        self._states: Dict[str, EngineState] = {}
        self._routes: Dict[str, List[str]] = defaultdict(list)
        self._queue: asyncio.Queue = None
        self._futs: Dict[str, asyncio.Future] = {}
        self._tasks: List[asyncio.Task] = []
        self._miss: Dict[str, int] = defaultdict(int)
        self._snapshots: Dict[str, Dict] = {}
        self._disabled: set = set()

    def _log(self, msg): logger.info(f"[kernel] {msg}")

    def register(self, engine):
        self._engines[engine.id] = engine
        self._states[engine.id] = EngineState.CREATED
        for h in getattr(engine, "handles", []): self._routes[h].append(engine.id)
        logger.info(f"[kernel] registered {engine.id} v{engine.version} handles={engine.handles}")

    async def boot(self):
        if self.state not in (KernelState.OFFLINE, KernelState.SHUTDOWN): return
        self.state = KernelState.BOOTING
        for eid, eng in self._engines.items():
            try:
                self._states[eid] = EngineState.INITIALIZING
                await eng.initialize(self.ctx)
                await eng.start()
                self._states[eid] = EngineState.RUNNING
            except Exception as e:
                self._states[eid] = EngineState.FAILED
                logger.error(f"[kernel] boot failed {eid}: {e}")
        self._queue = asyncio.Queue()
        self._tasks = [asyncio.create_task(self._dispatcher()), asyncio.create_task(self._health())]
        self.state = KernelState.ACTIVE
        logger.info(f"[kernel] ACTIVE with {len(self._engines)} engines")

    async def shutdown(self):
        self.state = KernelState.SHUTDOWN
        for t in self._tasks: t.cancel()
        for eid, eng in self._engines.items():
            try: await eng.stop()
            except Exception: pass
            self._states[eid] = EngineState.STOPPED
        self.state = KernelState.OFFLINE

    async def sleep(self):
        for eid, eng in self._engines.items():
            try:
                snap = eng.serialize()
                if snap: self._snapshots[eid] = snap
                await eng.pause(); self._states[eid] = EngineState.PAUSED
            except Exception: pass
        self.state = KernelState.SLEEP

    async def wake(self):
        for eid, eng in self._engines.items():
            try:
                if eid in self._snapshots: eng.restore(self._snapshots[eid])
                await eng.resume(); self._states[eid] = EngineState.RUNNING
            except Exception: pass
        self.state = KernelState.ACTIVE

    async def dispatch(self, event: SoulEvent, timeout: float = 25.0) -> Dict[str, Any]:
        if event.event_class == EventClass.PRESENCE:
            raise ValueError("presence events bypass the kernel")
        if self.state != KernelState.ACTIVE: return {"error": "kernel_not_active"}
        fut = asyncio.get_event_loop().create_future()
        self._futs[event.id] = fut
        await self._queue.put(event)
        try: return await asyncio.wait_for(fut, timeout)
        except asyncio.TimeoutError: return {"error": "dispatch_timeout"}
        finally: self._futs.pop(event.id, None)

    async def _dispatcher(self):
        while self.state in (KernelState.ACTIVE, KernelState.IDLE, KernelState.RECOVERY):
            event = await self._queue.get()
            targets = [i for i in self._routes.get(event.name, []) if i not in self._disabled]
            results: Dict[str, Any] = {}
            for eid in targets:
                eng = self._engines[eid]
                try: results[eid] = await eng.handle(event)
                except Exception as e: results[eid] = {"error": str(e)}
            merged: Dict[str, Any] = {}
            for r in results.values():
                if isinstance(r, dict): merged.update(r)
            if len(targets) == 1: merged = results.get(targets[0], {})
            fut = self._futs.get(event.id)
            if fut and not fut.done(): fut.set_result(merged)

    async def _health(self):
        while True:
            await asyncio.sleep(60)
            for eid, eng in list(self._engines.items()):
                if eid in self._disabled or self._states.get(eid) != EngineState.RUNNING: continue
                try:
                    await asyncio.wait_for(eng.handle(SoulEvent("kernel_ping", {"target": eid})), 5)
                    self._miss[eid] = 0
                except Exception:
                    self._miss[eid] += 1
                    if self._miss[eid] == 2:
                        self._states[eid] = EngineState.RECOVERING
                        try:
                            await eng.stop(); await eng.start()
                            self._states[eid] = EngineState.RUNNING
                            logger.warning(f"[kernel] restarted {eid}")
                        except Exception: pass
                    elif self._miss[eid] >= 4:
                        self._disabled.add(eid); self._states[eid] = EngineState.FAILED
                        logger.error(f"[kernel] DISABLED {eid} after repeated failures")

    def status(self) -> Dict[str, Any]:
        return {"kernel": self.state.value, "engines": {
            eid: {"state": self._states[eid].value, "disabled": eid in self._disabled,
                  "metrics": self._engines[eid].heartbeat().__dict__}
            for eid in self._engines}}

soul_kernel = SoulKernel()
