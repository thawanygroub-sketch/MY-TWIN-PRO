"""Rate Limiting v2 — proxy-aware, wired, graceful 429."""
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi import Request
from starlette.responses import JSONResponse


def _client_key(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


limiter = Limiter(key_func=_client_key, default_limits=["60/minute"])


def get_tier_limit(tier: str) -> str:
    return {"free": "20/minute", "plus": "60/minute", "premium": "120/minute",
            "pro": "240/minute", "yearly": "480/minute"}.get(tier, "30/minute")


async def _graceful_429(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={
        "error": {"code": "RATE_LIMITED",
                  "message": "لحظة هدوء قصيرة. أنا هنا عندما تعود."}})


def setup_rate_limiting(app) -> None:
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    app.add_exception_handler(RateLimitExceeded, _graceful_429)
