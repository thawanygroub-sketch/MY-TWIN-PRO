"""API router registration — release-gated. SINGLE SOURCE OF TRUTH.
NOTE: no prefix here; each router defines its own."""
from fastapi import APIRouter
from app.core.release_flags import load_release_flags

flags = load_release_flags()
api_router = APIRouter()

from app.api.routes import auth, chat, memories, profile, account, onboarding
from app.api.routes import billing, economy_routes

api_router.include_router(auth.router)
api_router.include_router(chat.router)
api_router.include_router(memories.router)
api_router.include_router(profile.router)
api_router.include_router(account.router)
api_router.include_router(onboarding.router)
api_router.include_router(economy_routes.router)
api_router.include_router(billing.router)

if flags.enabled("unified_chat"):
    from app.api.routes import unified_chat
    api_router.include_router(unified_chat.router)
if flags.enabled("ads"):
    from app.api.routes import ads
    api_router.include_router(ads.router)
if flags.enabled("referral"):
    from app.api.routes import referral
    api_router.include_router(referral.router)
if flags.enabled("passport"):
    from app.api.routes import passport_routes, fingerprint_routes
    api_router.include_router(passport_routes.router)
    api_router.include_router(fingerprint_routes.router)
for name, mod in [("study","study_routes"),("code_lab","code_lab_routes"),
    ("business","business_routes"),("creator","creator_routes"),("dream","dream_routes"),
    ("life_coach","life_coach_routes"),("image_lab","image_lab_routes"),
    ("smart_home","smart_home_routes"),("task_manager","task_manager_routes")]:
    if flags.enabled(name):
        import importlib
        api_router.include_router(importlib.import_module(f"app.api.routes.{mod}").router)
