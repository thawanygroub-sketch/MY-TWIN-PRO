"""Release Flags v3 — ads وadmin مفعّلان في الإنتاج لكن محكومان
(ads بحدود الخادم، admin بمفتاح داخلي/دور)."""
import json, os
CORE_ROUTERS = ("auth","chat","memories","profile","account","onboarding","economy","billing")
ALWAYS_OFF_PROD = {"dev","ai_trainer_routes","unified_chat"}
FEATURE_ROUTERS = ("study_routes","dream_routes","task_manager_routes","business_routes",
 "life_coach_routes","creator_routes","code_lab_routes","image_lab_routes",
 "smart_home_routes","relationship","twin_state_routes","awareness_routes",
 "consciousness_routes","fingerprint_routes","passport_routes","graph_routes",
 "avatar_routes","stt_routes","tts","sync_routes","push","projects","goals",
 "feedback","reports","stats","recommendations","referral","ads","admin","admin_routes")
class ReleaseFlags:
    def __init__(self, profile, overrides): self.profile=profile; self._ov=overrides
    def enabled(self, name):
        if name in CORE_ROUTERS: return True
        if self.profile=="production":
            if name in ALWAYS_OFF_PROD: return False
            return bool(self._ov.get(name, True))
        if self.profile=="dev": return True
        return bool(self._ov.get(name, name not in ALWAYS_OFF_PROD))
def load_release_flags():
    profile=os.getenv("MYTWIN_RELEASE_PROFILE","production").strip().lower()
    if profile not in ("production","beta","dev"): profile="production"
    raw=os.getenv("MYTWIN_FEATURE_OVERRIDES","").strip(); ov={}
    if raw:
        try: ov={str(k):bool(v) for k,v in json.loads(raw).items()}
        except json.JSONDecodeError: ov={}
    return ReleaseFlags(profile, ov)
