"""
Task Routing Service v3.0 — توجيه ذكي مع تحسين الجودة
"""
import random, logging
from typing import Dict, List

logger = logging.getLogger("task_router")

TASK_MODELS: Dict[str, Dict[str, List[str]]] = {
    "free": {
        "general":   ["groq/llama-3.3-70b", "gemini/gemini-2.5-flash", "internal/mytwin-llama3"],
        "emotional": ["internal/mytwin-llama3", "gemini/gemini-2.5-flash", "groq/llama-3.3-70b"],
        "coding":    ["openrouter/deepseek-v4-flash", "groq/llama-3.3-70b", "gemini/gemini-2.5-flash"],
        "reasoning": ["openrouter/llama-4-maverick", "gemini/gemini-2.5-flash", "groq/llama-3.3-70b"],
        "coaching":  ["gemini/gemini-2.5-flash", "internal/mytwin-llama3", "groq/llama-3.3-70b"],
        "quick":     ["groq/llama-3.3-70b", "internal/mytwin-llama3", "gemini/gemini-2.5-flash"],
    },
    "plus": {
        "general":   ["openrouter/llama-4-maverick", "gemini/gemini-2.5-flash", "internal/mytwin-llama3"],
        "emotional": ["internal/mytwin-llama3", "openrouter/llama-4-maverick", "gemini/gemini-2.5-flash"],
        "coding":    ["openrouter/deepseek-v4-flash", "openrouter/llama-4-maverick", "groq/llama-3.3-70b"],
        "reasoning": ["openrouter/llama-4-maverick", "gemini/gemini-2.5-flash", "groq/llama-3.3-70b"],
        "coaching":  ["openrouter/llama-4-maverick", "internal/mytwin-llama3", "gemini/gemini-2.5-flash"],
        "quick":     ["groq/llama-3.3-70b", "internal/mytwin-llama3", "gemini/gemini-2.5-flash"],
    },
    "premium": {
        "general":   ["openrouter/llama-4-maverick", "gemini/gemini-2.5-pro", "internal/mytwin-llama3"],
        "emotional": ["openrouter/llama-4-maverick", "internal/mytwin-llama3", "gemini/gemini-2.5-pro"],
        "coding":    ["openrouter/deepseek-v4-flash", "openrouter/llama-4-maverick", "gemini/gemini-2.5-flash"],
        "reasoning": ["openrouter/llama-4-maverick", "gemini/gemini-2.5-pro", "groq/llama-3.3-70b"],
        "coaching":  ["openrouter/llama-4-maverick", "gemini/gemini-2.5-pro", "internal/mytwin-llama3"],
        "quick":     ["groq/llama-3.3-70b", "openrouter/llama-4-maverick", "gemini/gemini-2.5-flash"],
    },
}

TIER_LIMITS: Dict[str, Dict] = {
    "free":    {"messages": 15,  "tokens_per_msg": 200},
    "plus":    {"messages": 50,  "tokens_per_msg": 400},
    "premium": {"messages": 150, "tokens_per_msg": 600},
    "pro":     {"messages": 500, "tokens_per_msg": 1000},
    "yearly":  {"messages": 9999, "tokens_per_msg": 1200},
}

def get_best_model(tier: str, task: str = "general") -> str:
    tier_map = TASK_MODELS.get(tier, TASK_MODELS["free"])
    models = tier_map.get(task, ["groq/llama-3.3-70b", "gemini/gemini-2.5-flash", "internal/mytwin-llama3"])
    
    rand = random.random()
    if rand < 0.5 and len(models) >= 1: return models[0]
    elif rand < 0.8 and len(models) >= 2: return models[1]
    elif len(models) >= 3: return models[2]
    return models[0]

def get_fallback_models(tier: str, task: str = "general") -> List[str]:
    tier_map = TASK_MODELS.get(tier, TASK_MODELS["free"])
    return tier_map.get(task, ["groq/llama-3.3-70b", "gemini/gemini-2.5-flash", "internal/mytwin-llama3"])

def get_tier_limits(tier: str) -> Dict:
    return TIER_LIMITS.get(tier, TIER_LIMITS["free"])

def estimate_cost(provider: str, tokens: int) -> float:
    if "internal" in provider: return 0.0
    costs = {"gemini": 0.0005, "groq": 0.0003, "openrouter": 0.0008}
    for key, rate in costs.items():
        if key in provider: return tokens * rate / 1000
    return tokens * 0.0003 / 1000

async def log_model_usage(user_id: str, provider: str, task: str, latency_ms: float, tokens_used: int = 0, success: bool = True):
    try:
        from app.infrastructure.database.supabase_client import get_db
        db = get_db()
        db.table("ai_metrics").insert({
            "user_id": user_id, "provider": provider, "task_type": task,
            "latency_ms": latency_ms, "tokens_used": tokens_used, "success": success,
            "created_at": __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()
        }).execute()
    except: pass

logger.info("✅ Task Routing Service v3.0 initialized")
