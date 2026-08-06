from .supabase_client import get_db
def __getattr__(name):
    from . import supabase_client as _m
    return getattr(_m, name)
