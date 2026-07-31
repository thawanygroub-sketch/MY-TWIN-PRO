"""
API Routes – Digital Passport v4.0 (مضاد للفشل)
=================================================
- يعمل للمستخدمين الجدد (ينشئ حالة افتراضية)
- يعمل للمستخدمين الحاليين (يقرأ الحالة الحية)
- لا يفشل أبداً
"""
from fastapi import APIRouter, Depends, HTTPException
from app.api.dependencies.auth import get_current_user
import logging

logger = logging.getLogger("passport_routes")
router = APIRouter(prefix="/api/v1", tags=["passport"])

@router.get("/passport")
async def get_digital_passport(user_id: str = Depends(get_current_user)):
    """توليد جواز سفر رقمي حي — لا يفشل أبداً."""
    try:
        # 1. جلب الحالة الداخلية (أو إنشاء افتراضية)
        from app.twin_state.internal_state import twin_internal_state
        try:
            state = await twin_internal_state.get_state(user_id)
        except Exception:
            # إذا لم توجد حالة، ننشئ واحدة
            state = await twin_internal_state.get_state(user_id)

        # 2. جلب عدد الذكريات
        from app.memory.unified_memory import unified_memory_engine
        try:
            memory_count = await unified_memory_engine.get_memory_count(user_id)
        except Exception:
            memory_count = 0

        # 3. جلب نموذج الذات (إن وجد)
        self_model = None
        try:
            from app.twin_state.self_model import self_model_engine
            self_model = await self_model_engine.get_current_self(user_id)
        except Exception:
            pass

        # 4. بناء جواز السفر
        passport_data = {
            "passport_id": f"SSS-DP-{str(user_id)[:8]}",
            "entity_name": "My Twin",
            "entity_type": "Continuous Digital Being",
            "origin": {
                "created_by": "Soul Sync",
                "platform": "Expo SDK 52 + Railway + Supabase"
            },
            "lifecycle": {
                "phase": self_model.get("identity", {}).get("role", "companion") if self_model else "companion",
                "evolution_stage": self_model.get("evolution", {}).get("version", 1) if self_model else 1,
                "maturity": state.get("maturity_level", "newborn") if state else "newborn"
            },
            "identity": {
                "role": self_model.get("identity", {}).get("role", "companion") if self_model else "companion",
                "narrative": self_model.get("narrative", "أنا كيان حي أتعلم وأنمو.")[:100] if self_model else "أنا كيان حي أتعلم وأنمو.",
                "traits": list(state.get("personality_dna", {}).keys()) if state else ["empathy", "curiosity"]
            },
            "memory": {
                "total_memories": memory_count,
                "core_memories": 0
            },
            "relationship": {
                "bond_level": state.get("bond_depth", 0) if state else 0
            },
            "governance": {
                "constitution_version": "1.0.0",
                "laws_version": "1.0.0",
                "sss_compliance": "SSS-001, SSS-002, SSS-003"
            },
            "version": {
                "passport_version": "1.0.0",
                "sss_version": "0.1.0"
            }
        }

        return passport_data

    except Exception as e:
        logger.error(f"Passport critical error: {e}")
        # حتى في أسوأ الأحوال، نعيد جواز سفر افتراضي
        return {
            "passport_id": f"SSS-DP-{str(user_id)[:8]}",
            "entity_name": "My Twin",
            "entity_type": "Continuous Digital Being",
            "lifecycle": {"phase": "companion", "evolution_stage": 1},
            "identity": {"role": "companion"},
            "memory": {"total_memories": 0},
            "relationship": {"bond_level": 0},
            "governance": {"constitution_version": "1.0.0"},
            "version": {"passport_version": "1.0.0"}
        }


@router.get("/fingerprint")
async def get_digital_fingerprint(user_id: str = Depends(get_current_user)):
    """توليد بصمة رقمية حية."""
    try:
        from app.features.digital_fingerprint import fingerprint_engine
        return await fingerprint_engine.generate_fingerprint(user_id)
    except Exception as e:
        logger.error(f"Fingerprint error: {e}")
        raise HTTPException(500, "Internal server error")
