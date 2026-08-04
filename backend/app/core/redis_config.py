"""Redis config v2 — مصدر واحد للوصول إلى Redis. Fail-soft."""
import os, logging
logger = logging.getLogger("redis_config")

REDIS_URL = os.getenv("REDIS_URL", "")
REDIS_AVAILABLE = False
_redis = None

try:
    import redis
    if REDIS_URL:
        _redis = redis.from_url(REDIS_URL, decode_responses=True)
        _redis.ping()
        REDIS_AVAILABLE = True
        logger.info("✅ Redis connected")
    else:
        logger.warning("REDIS_URL not set — cache disabled")
except Exception as e:
    REDIS_AVAILABLE = False
    _redis = None
    logger.warning(f"Redis unavailable: {e}")

def get_redis():
    return _redis

def redis_get(key):
    try:
        return _redis.get(key) if _redis else None
    except Exception:
        return None

def redis_set(key, value, ttl=None):
    try:
        if _redis:
            _redis.set(key, value, ex=ttl)
        return True
    except Exception:
        return False
