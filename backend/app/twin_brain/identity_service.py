"""
Twin Brain – Identity Service v3.0
===================================
يبني هوية الكيان: من أنا؟ ما أصلي؟ ما علاقتي بالمستخدم؟
"""
import logging
from typing import Dict, Any

logger = logging.getLogger("twin_brain.identity")

async def get_identity_context(user_id: str, lang: str = "ar") -> Dict[str, Any]:
    """
    يبني سياق الهوية الكامل للتوأم.
    يتضمن: الاسم، الشخصية، السمات، مرحلة التطور، الرابطة، مرحلة العلاقة.
    """
    context = {
        "twin_name": "MyTwin",
        "twin_gender": "female",
        "personality": "supportive",
        "evolution_stage": 0,
        "traits": ["متفهم", "صبور", "دافئ"],
        "bond_level": 0,
        "phase": "stranger",
        "description": "",
    }
    
    # 1. جلب هوية التوأم من Identity Engine
    try:
        from app.twin_state.identity_service import get_identity as get_twin_identity
        identity = await get_twin_identity(user_id, lang=lang)
        if identity:
            context["traits"] = identity.get("traits", context["traits"])
            context["evolution_stage"] = identity.get("evolution_stage", 0)
            context["description"] = identity.get("description", "")
    except Exception as e:
        logger.warning(f"Twin identity fetch failed: {e}")
    
    # 2. جلب إعدادات المستخدم
    try:
        from app.infrastructure.database.supabase_client import get_db
        db = get_db()
        profile = db.table("profiles").select(
            "twin_name,twin_style,twin_gender,voice_personality"
        ).eq("id", user_id).single().execute()
        if profile.data:
            context["twin_name"] = profile.data.get("twin_name", "MyTwin")
            context["personality"] = profile.data.get("twin_style", "supportive")
            context["twin_gender"] = profile.data.get("twin_gender", "female")
    except Exception as e:
        logger.warning(f"Profile fetch for identity failed: {e}")
    
    # 3. جلب حالة العلاقة
    try:
        from app.twin_state.relationship_service import load as load_relationship
        relationship = await load_relationship(user_id)
        if relationship:
            context["bond_level"] = relationship.get("bond_level", 0)
            context["phase"] = relationship.get("stage", "stranger")
    except Exception as e:
        logger.debug(f"Relationship fetch for identity failed: {e}")
    
    return context
