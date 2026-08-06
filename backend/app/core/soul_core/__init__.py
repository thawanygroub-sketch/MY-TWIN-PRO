"""Soul Core — SCS-001 v1.1."""
from .contract import SoulEvent, EventClass, EngineState, KernelState, EngineMetrics, KernelContext, ISoulEngine
from .kernel import soul_kernel, SoulKernel
from .adapters import LegacyEngineAdapter, InteractionPipelineEngine, build_legacy_engines
from .engines_b import SemanticCompressorEngine, ReflectionScoreEngine
def register_all():
    for eng in build_legacy_engines(): soul_kernel.register(eng)
    soul_kernel.register(SemanticCompressorEngine())
    soul_kernel.register(ReflectionScoreEngine())
register_all()
__all__ = ["soul_kernel", "SoulKernel", "SoulEvent", "EventClass", "EngineState", "KernelState",
           "EngineMetrics", "KernelContext", "ISoulEngine", "LegacyEngineAdapter",
           "InteractionPipelineEngine", "SemanticCompressorEngine", "ReflectionScoreEngine", "register_all"]
