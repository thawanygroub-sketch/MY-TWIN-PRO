"""
MyTwin – User Model v1.0 (Unified User Profile)
- يجمع بيانات المستخدم من Supabase + Consciousness Core
- يوفر واجهة موحدة لكل المحركات
"""
import os, logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone

logger = logging.getLogger("user_model")

class UserModel:
    def __init__(self):
        self._db = None

    def _get_db(self):
        if not self._db:
            try:
                from supabase import create_client
                self._db = create_client(
                    os.getenv("SUPABASE_URL", ""),
                    os.getenv("SUPABASE_SERVICE_KEY", "")
                )
            except:
                pass
        return self._db

    async def get_user(self, user_id: str) -> Dict[str, Any]:
        """الحصول على نموذج المستخدم الكامل"""
        db = self._get_db()
        if not db:
            return {}

        # 1. الملف الشخصي من Supabase
        profile = {}
        try:
            res = db.table("profiles").select("*").eq("id", user_id).maybeSingle().execute()
            if res.data:
                profile = res.data
        except:
            pass

        # 2. حالة الوعي من Consciousness Core
        consciousness = {}
        try:
            from consciousness_core import consciousness_core
            state = consciousness_core.user_states.get(user_id, {})
            consciousness = {
                "identity": state.get("identity", {}),
                "active_objectives": state.get("active_objectives", []),
                "last_thought": state.get("internal_state", {}).get("last_thought", ""),
            }
        except:
            pass

        # 3. إحصائيات الأدوات من Agent Metrics
        tool_stats = {}
        try:
            from agent_metrics import agent_metrics
            tool_stats = await agent_metrics.get_tool_stats(user_id)
        except:
            pass

        return {
            "profile": profile,
            "consciousness": consciousness,
            "tool_stats": tool_stats,
            "preferences": self._extract_preferences(profile),
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
        }

    def _extract_preferences(self, profile: Dict[str, Any]) -> Dict[str, Any]:
        """استخراج تفضيلات المستخدم من الملف الشخصي"""
        return {
            "language": profile.get("lang", "ar"),
            "twin_style": profile.get("twin_style", "supportive"),
            "reply_style": profile.get("reply_style", "medium"),
            "voice_personality": profile.get("voice_personality", "friend"),
            "voice_speed": profile.get("voice_speed", 0.9),
            "voice_pitch": profile.get("voice_pitch", 1.0),
            "twin_gender": profile.get("twin_gender", "female"),
        }


user_model = UserModel()
print("✅ User Model v1.0 initialized")
