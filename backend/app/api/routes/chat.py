"""CHAT v12 — routed through Soul Kernel (fallback direct brain) + envelope v2."""
import logging, uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.api.dependencies.auth import get_current_user_id, get_user_tier
from app.safety.safety_layer import validate_response, audit_entry
from app.core.living_messages import FAILURE, ENERGY
from app.core.response_envelope import build_envelope
from app.infrastructure.database.supabase_client import get_db
logger = logging.getLogger("chat_routes")
router = APIRouter(prefix="/api", tags=["chat"])
class ChatRequest(BaseModel):
    message: str = ""
    history: List[Dict[str, str]] = []
    lang: str = "ar"
    use_voice: bool = False
    perception: Optional[Dict] = None
    device_info: Optional[Dict] = None
    requested_capability: Optional[str] = None
SILENCE_MS = {"sadness": 2200, "fear": 1600, "anger": 2500, "joy": 800}
async def _opening(user_id: str, phase: str) -> str:
    try:
        last = get_db().table("working_memory").select("created_at").eq("user_id", user_id).order("created_at", desc=True).limit(1).execute()
        days = (datetime.now(timezone.utc) - datetime.fromisoformat(last.data[0]["created_at"])).days if last.data else 0
    except Exception:
        last, days = None, 0
    if phase == "stranger" or not (last and last.data): return "أهلًا. أنا هنا. لنبدأ التعارف بهدوء."
    if days >= 30: return "مرّ وقت طويل. أنا سعيد بوجودك هنا."
    if days >= 7: return "مرّت أيام. أنا هنا، بنفس الذاكرة."
    return "أهلًا بعودتك."
@router.post("/chat")
async def chat(req: ChatRequest, user_id: str = Depends(get_current_user_id), tier: str = Depends(get_user_tier)):
    rid = uuid.uuid4().hex[:12]
    message = (req.message or "").strip()
    if not message:
        from app.twin_state.relationship_service import load as load_rel
        try: phase = (await load_rel(user_id)).get("stage", "stranger")
        except Exception: phase = "stranger"
        base = {"reply": await _opening(user_id, phase), "emotion": "neutral", "intensity": 0.3,
                "bond_level": 0, "phase": phase, "silence_ms": 1200, "limits": {"can_send": True, "remaining": 0}}
        return build_envelope(base, rid)
    gate_note = None
    if req.requested_capability:
        from app.core.capability_gate import can_use_capability
        g = await can_use_capability(user_id, tier, req.requested_capability)
        if not g["allowed"]:
            gate_note = (ENERGY["exhausted"] if g["reason"] == "energy_low"
                         else "هذه القدرة تنفتح تدريجيًا مع علاقتنا وباقتك الحالية.")
    res = None
    try:
        from app.core.soul_core import soul_kernel, SoulEvent
        if soul_kernel.state.value == "active":
            res = await soul_kernel.dispatch(SoulEvent("user_message", {
                "user_id": user_id, "message": message, "lang": req.lang,
                "perception": req.perception, "history": req.history,
                "device_info": req.device_info, "tier": tier}, user_id=user_id, source="chat"))
            if res and res.get("error"): res = None
    except Exception as e:
        logger.warning(f"[{rid}] kernel dispatch failed: {e}")
    if not res:
        try:
            from app.twin_brain.unified_brain import unified_brain
            res = await unified_brain.process(user_id, message, req.lang, perception=req.perception,
                history=req.history, device_info=req.device_info, tier=tier)
        except Exception as e:
            logger.error(f"[{rid}] brain error: {e}")
            return build_envelope({"reply": FAILURE["still_here"], "emotion": "neutral", "intensity": 0.2,
                "silence_ms": 1200, "limits": {"can_send": True, "remaining": 0}}, rid)
    reply = (gate_note + "\n\n" if gate_note else "") + res.get("reply", "")
    safety = validate_response(reply, message)
    if safety.action == "regenerate":
        logger.warning(f"[{rid}] {audit_entry(safety, rid)}")
        reply = "دعني أصغِ بشكل أدق. أنا معك، وأفهم ما تشاركه."
    elif safety.action == "crisis" and safety.notes:
        reply = reply + "\n\n" + safety.notes[0]
    limits = res.get("limits", {})
    if not limits.get("can_send", True):
        reply = ENERGY["exhausted"] + "\nيمكنك منحي انتعاشًا أو ترقيتي لأبقى بكامل حضوري."
    res["reply"] = reply
    try:
        import asyncio as _a
        from app.core.soul_core import soul_kernel, SoulEvent
        _a.create_task(soul_kernel.dispatch(SoulEvent("interaction_complete",
            {"user_id": user_id, "message": message, "reply": reply, "emotion": res.get("emotion")},
            user_id=user_id, source="chat")))
    except Exception:
        pass
    res["silence_ms"] = res.get("silence_ms") or SILENCE_MS.get(res.get("emotion"), 1500)
    return build_envelope(res, rid)
