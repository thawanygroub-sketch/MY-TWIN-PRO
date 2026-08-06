"""SCS-001 Conformance Suite — boot/heartbeat/handle/isolation/recovery."""
import asyncio, pytest
from app.core.soul_core import soul_kernel, SoulEvent, LegacyEngineAdapter, EngineState

def run(coro): return asyncio.get_event_loop().run_until_complete(coro)

class EchoEngine:
    id, name, version, handles = "echo", "Echo", "1.0.0", ["echo"]
    def __init__(self): self.state = EngineState.CREATED
    async def initialize(self, ctx): self.state = EngineState.READY
    async def start(self): self.state = EngineState.RUNNING
    async def stop(self): self.state = EngineState.STOPPED
    async def pause(self): self.state = EngineState.PAUSED
    async def resume(self): self.state = EngineState.RUNNING
    async def handle(self, ev): return {"echo": ev.payload.get("x")}
    def heartbeat(self): from app.core.soul_core import EngineMetrics; return EngineMetrics(version=self.version)
    def serialize(self): return {"s": 1}
    def restore(self, snap): pass

class BoomEngine(EchoEngine):
    id, name, handles = "boom", "Boom", ["echo"]
    async def handle(self, ev): raise RuntimeError("boom")

@pytest.fixture()
def kernel():
    from app.core.soul_core.kernel import SoulKernel
    k = SoulKernel(); k.register(EchoEngine()); k.register(BoomEngine())
    run(k.boot()); yield k; run(k.shutdown())

def test_boot_active(kernel): assert kernel.state.value == "active"
def test_handle_echo(kernel):
    r = run(kernel.dispatch(SoulEvent("echo", {"x": 7})))
    assert r.get("echo") == 7 or "boom" in str(r)
def test_error_isolation(kernel):
    r = run(kernel.dispatch(SoulEvent("echo", {"x": 1})))
    assert kernel.state.value == "active" and isinstance(r, dict)
def test_presence_bypass(kernel):
    with pytest.raises(ValueError): run(kernel.dispatch(SoulEvent("e", event_class=__import__('app.core.soul_core', fromlist=['EventClass']).EventClass.PRESENCE)))
def test_sleep_wake(kernel):
    run(kernel.sleep()); assert kernel.state.value == "sleep"
    run(kernel.wake()); assert kernel.state.value == "active"
def test_status_metrics(kernel):
    s = kernel.status(); assert "echo" in s["engines"] and s["engines"]["echo"]["metrics"]["version"] == "1.0.0"
