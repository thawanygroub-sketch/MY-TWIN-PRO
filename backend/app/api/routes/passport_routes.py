from fastapi import APIRouter, Depends, HTTPException
from app.api.dependencies.auth import get_current_user
import logging, json

logger = logging.getLogger("passport_routes")
router = APIRouter(prefix="/api/v1", tags=["passport"])

@router.get("/passport")
async def get_digital_passport(user_id: str = Depends(get_current_user)):
    try:
        from app.twin_state.internal_state import twin_internal_state
        from app.memory.unified_memory import unified_memory_engine

        state = await twin_internal_state.get_state(user_id)
        memory_count = await unified_memory_engine.get_memory_count(user_id)

        return {
            "passport_id": f"SSS-DP-{str(user_id)[:8]}",
            "entity_name": "My Twin",
            "lifecycle": {"phase": "active", "evolution_stage": 1},
            "memory": {"total": memory_count},
            "relationship": {"bond_level": state.get("bond_depth", 0) if state else 0},
            "governance": {"constitution_version": "1.0.0"},
            "version": {"passport_version": "1.0.0"}
        }
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
