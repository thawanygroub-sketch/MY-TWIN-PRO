"""Soul Core — SCS-001 v1.1."""
from .contract import SoulEvent, EventClass, EngineState, KernelState, EngineMetrics, KernelContext, ISoulEngine
from .kernel import soul_kernel, SoulKernel
from .adapters import LegacyEngineAdapter, InteractionPipelineEngine, build_legacy_engines
from .engines_b import SemanticCompressorEngine, ReflectionScoreEngine
from .engines_c import (OfflineCognitiveProcessor, EpisodicNarrativeEngine, BeliefRevisionEngine,
                        IdentityConsistencyEngine, SocialGraphEngine, ProactiveLifeEngine)
def register_all():
    for eng in build_legacy_engines(): soul_kernel.register(eng)
    soul_kernel.register(SemanticCompressorEngine())
    soul_kernel.register(ReflectionScoreEngine())
    for cls in (OfflineCognitiveProcessor, EpisodicNarrativeEngine, BeliefRevisionEngine,
                IdentityConsistencyEngine, SocialGraphEngine, ProactiveLifeEngine):
        soul_kernel.register(cls())
register_all()
__all__ = ["soul_kernel", "SoulKernel", "SoulEvent", "EventClass", "EngineState", "KernelState",
           "EngineMetrics", "KernelContext", "ISoulEngine", "LegacyEngineAdapter",
           "InteractionPipelineEngine", "register_all"]
