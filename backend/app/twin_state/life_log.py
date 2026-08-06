"""Life Log v1 — سجل يومي للخطوات/النشاط يُكتب من device_info ويُقرأ للملاحظات المسنّدة."""
import logging, re
from datetime import datetime, timezone
logger = logging.getLogger("life_log")
async def write_daily_life_log(user_id: str, device_info: dict) -> None:
    try:
        contextual = str((device_info or {}).get("contextual_prompt") or "")
        m = re.search(r"(\d[\d,]*)\s*خطوة", contextual)
        if not m: return
        steps = int(m.group(1).replace(",", ""))
        today = datetime.now(timezone.utc).date().isoformat()
        from app.memory.unified_memory import unified_memory_engine
        await unified_memory_engine.store_engine_output(user_id, "life_log",
            {"date": today, "steps": steps, "source": "pedometer"})
    except Exception as e:
        logger.debug(f"life_log write: {e}")
life_log_writer = write_daily_life_log
