"""تشخيص مفاتيح Supabase: يكشف المفتاح المنتهي (جذر PGRST303)."""
import os, base64, json, time
from dotenv import load_dotenv
load_dotenv()
def decode_exp(tok: str):
    try:
        p = tok.split('.')[1]; p += '=' * (-len(p) % 4)
        return json.loads(base64.urlsafe_b64decode(p)).get('exp')
    except Exception:
        return None
now = time.time()
for name in ("SUPABASE_SERVICE_KEY", "SUPABASE_ANON_KEY"):
    v = os.getenv(name)
    if not v: print(f"{name}: MISSING"); continue
    exp = decode_exp(v)
    if exp is None: print(f"{name}: NOT_A_JWT")
    elif exp < now: print(f"{name}: EXPIRED before {(now-exp)/86400:.0f} days  <-- ROOT CAUSE")
    else: print(f"{name}: OK (expires in {(exp-now)/86400:.0f} days)")
