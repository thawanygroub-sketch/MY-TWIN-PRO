"""Governance v2.1 — قفل admin بأي بادئة + حوكمة القدرات."""
import json, os, time, logging
from collections import defaultdict, deque
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
logger = logging.getLogger("governance")

GOVERNED = ("/api/study","/api/business","/api/life-coach","/api/smart-home",
 "/api/image-lab","/api/content","/api/tasks","/api/code-lab","/api/dreams",
 "/api/stats","/api/recommendations","/api/relationship","/api/twin-state",
 "/api/awareness","/api/consciousness","/api/fingerprint","/api/passport",
 "/api/graph","/api/avatar","/api/stt","/api/tts","/api/sync","/api/push",
 "/api/projects","/api/goals","/api/feedback","/api/reports","/api/referral")
TIER_NEED = {"/api/business":1,"/api/life-coach":1,"/api/content":1,
 "/api/code-lab":2,"/api/image-lab":2,"/api/smart-home":2}
LEVEL = {"free":0,"plus":1,"premium":2,"pro":3,"yearly":4}
RATE = {"free":20,"plus":60,"premium":120,"pro":240,"yearly":480}

class GovernanceMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app); self._hits = defaultdict(deque)
    async def dispatch(self, request, call_next):
        path = request.url.path
        # ── قفل Admin: أي مسار يحتوي admin يتطلب مفتاحًا داخليًا أو دور admin ──
        if "/admin" in path:
            key = request.headers.get("x-internal-key","")
            expected = os.getenv("SOUL_SYNC_INTERNAL_KEY","")
            ok = bool(expected) and key == expected
            if not ok:
                auth = request.headers.get("authorization","")
                if auth.startswith("Bearer "):
                    try:
                        from app.core.security import decode_access_token, extract_role
                        p = decode_access_token(auth[7:])
                        ok = bool(p) and extract_role(p) == "admin"
                    except Exception:
                        pass
            if not ok:
                return JSONResponse({"error":{"code":"ADMIN_LOCKED"}},403)
            return await call_next(request)
        # ── حوكمة القدرات ──
        if not (path.startswith("/api/") and path.startswith(GOVERNED)):
            return await call_next(request)
        auth = request.headers.get("authorization","")
        if not auth.startswith("Bearer "):
            return JSONResponse({"error":{"code":"AUTH_REQUIRED"}},401)
        token = auth[7:]; uid = None; tier = "free"
        try:
            from app.core.security import decode_access_token, extract_user_id, extract_tier
            payload = decode_access_token(token)
            if payload: uid = extract_user_id(payload); tier = extract_tier(payload)
        except Exception:
            pass
        if not uid:
            try:
                from app.infrastructure.database.supabase_client import get_db
                ur = get_db().auth.get_user(token)
                if ur and ur.user: uid = ur.user.id
            except Exception:
                pass
        if not uid:
            return JSONResponse({"error":{"code":"AUTH_INVALID"}},401)
        claimed = request.query_params.get("user_id"); body_uid = None
        if request.method in ("POST","PUT","PATCH"):
            try:
                body = await request.body(); request._body = body
                if body: body_uid = (json.loads(body) or {}).get("user_id")
            except Exception:
                pass
        for c in (claimed, body_uid):
            if c and c != uid:
                return JSONResponse({"error":{"code":"IDENTITY_MISMATCH"}},403)
        need = 0
        for p,n in TIER_NEED.items():
            if path.startswith(p): need = n; break
        if LEVEL.get(tier,0) < need:
            return JSONResponse({"error":{"code":"TIER_LOCKED",
                "message":"هذه القدرة تنفتح تدريجيًا مع علاقتنا وباقتك الحالية."}},403)
        dq = self._hits[uid]; now = time.time()
        while dq and now - dq[0] > 60: dq.popleft()
        if len(dq) >= RATE.get(tier,30):
            return JSONResponse({"error":{"code":"RATE_LIMITED",
                "message":"لحظة هدوء قصيرة. أنا هنا عندما تعود."}},429)
        dq.append(now)
        return await call_next(request)
