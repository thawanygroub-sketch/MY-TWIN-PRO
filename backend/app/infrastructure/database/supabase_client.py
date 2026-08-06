"""Supabase client v2 — fail-fast. No silent anon downgrade."""
import os, logging
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("supabase_client")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY are required")

_db: Client | None = None

def get_service_role_db() -> Client:
    global _db
    if _db is None:
        _db = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        logger.info("✅ Supabase service_role client created")
    return _db

def get_db() -> Client:
    return get_service_role_db()


def reset_db():
    """Compat layer — إعادة ضبط الاتصال."""
    try:
        return get_db()
    except Exception:
        return None


def check_db_health():
    try:
        get_db().table("profiles").select("id").limit(1).execute()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


def get_profile(user_id: str):
    try:
        return get_db().table("profiles").select("*").eq("id", user_id).single().execute()
    except Exception:
        return None
