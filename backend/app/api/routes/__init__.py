"""Router registration v5 — مصدر حقيقة واحد + حراسة استيراد."""
import importlib, logging
from fastapi import APIRouter
from app.core.release_flags import load_release_flags
logger = logging.getLogger("routes")
flags = load_release_flags()
api_router = APIRouter()

_CORE = ["auth","chat","memories","profile","account","onboarding","economy_routes","billing"]
_FEATURES = ["study_routes","dream_routes","task_manager_routes","business_routes",
 "life_coach_routes","creator_routes","code_lab_routes","image_lab_routes",
 "smart_home_routes","relationship","twin_state_routes","awareness_routes",
 "consciousness_routes","fingerprint_routes","passport_routes","graph_routes",
 "avatar_routes","stt_routes","tts","sync_routes","push","projects","goals",
 "feedback","reports","stats","recommendations","referral","ads","admin","admin_routes"]

for name in _CORE + _FEATURES:
    if not flags.enabled(name):
        continue
    try:
        mod = importlib.import_module(f"app.api.routes.{name}")
        api_router.include_router(mod.router)
    except Exception as e:
        logger.warning(f"⚠️ router '{name}' skipped: {e}")
