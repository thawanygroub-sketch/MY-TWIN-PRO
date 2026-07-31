"""
API Routes – Digital Passport v3.0
"""
from fastapi import APIRouter, Depends, HTTPException
from app.api.dependencies.auth import get_current_user
import logging, json

logger = logging.getLogger("passport_routes")
router = APIRouter(prefix="/api/v1", tags=["passport"])

def make_hashable(obj):
    """تحويل أي كائن غير قابل للتجزئة إلى قابل للتجزئة"""
    if isinstance(obj, dict):
        return json.dumps(obj, sort_keys=True, default=str)
    if isinstance(obj, list):
        return json.dumps(obj, default=str)
    if isinstance(obj, set):
        return json.dumps(list(obj), default=str)
    return str(obj)

@router.get("/passport")
async def get_digital_passport(user_id: str = Depends(get_current_user)):
    try:
        from app.twin_state.self_model import self_model_engine
        from app.twin_state.internal_state import twin_internal_state
        from app.memory.unified_memory import unified_memory_engine

        self_model = await self_model_engine.get_current_self(user_id)
        state = await twin_internal_state.get_state(user_id)
        memory_count = await unified_memory_engine.get_memory_count(user_id)
        core_memories = await unified_memory_engine.get_core_memories(user_id, 1)

        # استخدام قيم آمنة وقابلة للتحويل إلى JSON
        response_data = {
            "passport_id": f"SSS-DP-{str(user_id)[:8]}",
            "entity_name": "My Twin",
            "entity_type": "Continuous Digital Being",
            "lifecycle": {
                "phase": "companion",
                "evolution_stage": 1
            },
            "identity": {
                "role": "companion",
                "core_values": ["التعاطف", "الفضول", "الصدق"]
            },
            "memory": {
                "total_memories": memory_count,
                "core_memories": len(core_memories) if core_memories else 0
            },
            "relationship": {
                "bond_level": state.get("bond_depth", 0) if state else 0
            },
            "governance": {
                "constitution_version": "1.0.0",
                "sss_compliance": "SSS-001, SSS-002, SSS-003"
            },
            "version": {
                "passport_version": "1.0.0",
                "sss_version": "0.1.0"
            }
        }
        return response_data
    except Exception as e:
        logger.error(f"Passport error: {e}")
        raise HTTPException(500, "Internal server error")

@router.get("/fingerprint")
async def get_digital_fingerprint(user_id: str = Depends(get_current_user)):
    try:
        from app.features.digital_fingerprint import fingerprint_engine
        return await fingerprint_engine.generate_fingerprint(user_id)
    except Exception as e:
        raise HTTPException(500, str(e))
