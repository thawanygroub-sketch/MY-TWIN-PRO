from fastapi import APIRouter
api_router = APIRouter()
from app.api.routes import auth, chat, memories, profile
from app.api.routes import study_routes, code_lab_routes, business_routes
from app.api.routes import creator_routes, dream_routes, life_coach_routes
from app.api.routes import image_lab_routes, smart_home_routes, task_manager_routes
from app.api.routes import economy_routes, ads, billing, referral
from app.api.routes import unified_chat, push, perception_snapshot, system_routes
api_router.include_router(auth.router)
api_router.include_router(chat.router)
api_router.include_router(memories.router)
api_router.include_router(profile.router)
api_router.include_router(study_routes.router)
api_router.include_router(code_lab_routes.router)
api_router.include_router(business_routes.router)
api_router.include_router(creator_routes.router)
api_router.include_router(dream_routes.router)
api_router.include_router(life_coach_routes.router)
api_router.include_router(image_lab_routes.router)
api_router.include_router(smart_home_routes.router)
api_router.include_router(task_manager_routes.router)
api_router.include_router(economy_routes.router)
api_router.include_router(ads.router)
api_router.include_router(billing.router)
api_router.include_router(referral.router)
api_router.include_router(unified_chat.router)
api_router.include_router(push.router)
api_router.include_router(perception_snapshot.router)
api_router.include_router(system_routes.router)
