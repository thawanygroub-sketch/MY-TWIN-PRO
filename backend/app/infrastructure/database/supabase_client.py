import os
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

logger = logging.getLogger("supabase_client")
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is required")

_service_role_db: Client | None = None

def get_service_role_db() -> Client:
    global _service_role_db
    if _service_role_db is None:
        key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY
        if not key:
            key = SUPABASE_ANON_KEY
        _service_role_db = create_client(SUPABASE_URL, key)
        logger.info("✅ Supabase service_role client created successfully")
    return _service_role_db

def get_db() -> Client:
    return get_service_role_db()

logger.info("✅ Supabase client configured")
