"""SCS-001 v1.1 — عقد Soul Core: حالات، أحداث بفئتين، عقد محرك موحّد، سياق آمن."""
import time, uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Optional, Protocol, runtime_checkable

class EngineState(str, Enum):
    CREATED = "created"; INITIALIZING = "initializing"; READY = "ready"; RUNNING = "running"
    PAUSED = "paused"; RECOVERING = "recovering"; FAILED = "failed"; STOPPED = "stopped"

class KernelState(str, Enum):
    OFFLINE = "offline"; BOOTING = "booting"; STARTING = "starting"; READY = "ready"
    ACTIVE = "active"; IDLE = "idle"; SLEEP = "sleep"; RECOVERY = "recovery"; SHUTDOWN = "shutdown"

class EventClass(str, Enum):
    SEMANTIC = "semantic"    # يمر عبر النواة
    PRESENCE = "presence"    # pub/sub مباشر خارج النواة (تردد عالٍ)

@dataclass
class SoulEvent:
    name: str
    payload: Dict[str, Any] = field(default_factory=dict)
    event_class: EventClass = EventClass.SEMANTIC
    source: str = "system"
    user_id: Optional[str] = None
    priority: int = 5
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    ts: float = field(default_factory=time.time)

@dataclass
class EngineMetrics:
    version: str = "0.0.0"
    uptime_s: float = 0.0
    handle_count: int = 0
    error_count: int = 0
    last_heartbeat: float = field(default_factory=time.time)

class KernelContext:
    """مقابض آمنة: لا يستورد محركٌ محركًا مباشرة — كل شيء عبر النواة."""
    def __init__(self, kernel): self._kernel = kernel
    async def store_engine_output(self, user_id, engine_name, output):
        from app.memory.unified_memory import unified_memory_engine
        return await unified_memory_engine.store_engine_output(user_id, engine_name, output)
    async def memory_retrieve(self, user_id, query, limit=5):
        from app.memory.unified_memory import unified_memory_engine
        return await unified_memory_engine.retrieve(user_id, query, limit=limit)
    def log(self, msg): self._kernel._log(msg)

@runtime_checkable
class ISoulEngine(Protocol):
    id: str; name: str; version: str; handles: list
    async def initialize(self, ctx: KernelContext) -> None: ...
    async def start(self) -> None: ...
    async def stop(self) -> None: ...
    async def pause(self) -> None: ...
    async def resume(self) -> None: ...
    async def handle(self, event: SoulEvent) -> Dict[str, Any]: ...
    def heartbeat(self) -> EngineMetrics: ...
    def serialize(self) -> Optional[Dict[str, Any]]: ...
    def restore(self, snap: Dict[str, Any]) -> None: ...
