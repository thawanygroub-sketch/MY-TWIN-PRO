"""
Unified Memory Engine v2.1 – استخدام service_role بشكل صحيح
"""
import logging, asyncio
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone, timedelta
from collections import Counter

logger = logging.getLogger("unified_memory")

try:
    from app.infrastructure.database.supabase_client import get_db
    DB_AVAILABLE = True
except ImportError:
    DB_AVAILABLE = False

TABLE_NAME = "emotional_memory"

class UnifiedMemoryEngine:
    async def store(self, user_id: str, content: str, reply: str, emotion: str = "neutral", importance: int = 50, lang: str = "ar") -> Optional[str]:
        if not DB_AVAILABLE: return None
        try:
            db = get_db()
            payload = {
                "user_id": user_id, "expressed_text": content[:500],
                "expressed_emotion": emotion, "real_emotion": emotion,
                "intensity": importance / 100, "confidence": 0.7,
                "valence": 0.2 if emotion in ["joy", "love"] else -0.2 if emotion in ["sadness", "fear", "anger"] else 0.0,
                "importance": importance, "created_at": datetime.now(timezone.utc).isoformat(),
            }
            result = db.table(TABLE_NAME).insert(payload).execute()
            return result.data[0]["id"] if result.data else ""
        except Exception as e:
            logger.error(f"تخزين الذاكرة فشل: {e}")
            return None

    async def store_engine_output(self, user_id: str, engine_name: str, output: Dict[str, Any]) -> Optional[str]:
        if not DB_AVAILABLE: return None
        try:
            import json
            db = get_db()
            json_output = json.dumps(output, ensure_ascii=False, default=str)
            label = f"[ENGINE:{engine_name}]"
            payload = {
                "user_id": user_id, "expressed_text": f"{label} {json_output[:500]}",
                "expressed_emotion": output.get("mood", output.get("emotion", "neutral")),
                "real_emotion": output.get("mood", output.get("emotion", "neutral")),
                "intensity": output.get("energy", output.get("overall_energy", 0.5)),
                "confidence": output.get("confidence", 0.8), "importance": 40,
                "cultural_context": json_output[:500], "arabic_category": engine_name,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            result = db.table(TABLE_NAME).insert(payload).execute()
            logger.info(f"📊 {engine_name} output stored for {user_id}")
            return result.data[0]["id"] if result.data else None
        except Exception as e:
            logger.error(f"store_engine_output failed: {e}")
            return None

    async def retrieve(self, user_id: str, query: str, current_emotion: str = "neutral", limit: int = 5) -> Dict[str, Any]:
        if not DB_AVAILABLE: return {"memories": [], "count": 0}
        try:
            db = get_db()
            result = db.table(TABLE_NAME).select("*").eq("user_id", user_id).order("created_at", desc=True).limit(50).execute()
            memories = result.data or []
            scored = []
            for m in memories:
                score = m.get("importance", 50)
                if m.get("real_emotion") == current_emotion: score += 20
                created = m.get("created_at", "")
                if created:
                    try:
                        dt = datetime.fromisoformat(created)
                        days_ago = (datetime.now(timezone.utc) - dt).days
                        score -= days_ago * 0.1
                    except: pass
                scored.append({**m, "_score": score})
            scored.sort(key=lambda x: x["_score"], reverse=True)
            top = scored[:limit]
            return {"memories": [{"id": m.get("id"), "content": m.get("expressed_text", ""), "emotion": m.get("real_emotion", "neutral"), "importance": m.get("importance", 50), "created_at": m.get("created_at")} for m in top], "count": len(top)}
        except Exception as e:
            logger.error(f"استرجاع الذاكرة فشل: {e}")
            return {"memories": [], "count": 0}

    async def get_patterns(self, user_id: str, days: int = 14) -> Dict[str, Any]:
        if not DB_AVAILABLE: return {}
        try:
            db = get_db()
            cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
            result = db.table(TABLE_NAME).select("*").eq("user_id", user_id).gte("created_at", cutoff).execute()
            memories = result.data or []
            emotions = [m.get("real_emotion", "neutral") for m in memories]
            counter = Counter(emotions)
            total = len(emotions)
            return {"dominant_emotion": counter.most_common(1)[0][0] if counter else "neutral", "distribution": {k: round(v/total, 2) for k, v in counter.items()} if total else {}, "total": total}
        except Exception: return {}

    async def get_core_memories(self, user_id: str, limit: int = 12) -> List[Dict[str, Any]]:
        if not DB_AVAILABLE: return []
        try:
            db = get_db()
            result = db.table(TABLE_NAME).select("*").eq("user_id", user_id).gte("importance", 70).order("created_at", desc=True).limit(limit).execute()
            return result.data or []
        except Exception as e: return []

    async def get_memory_count(self, user_id: str) -> int:
        if not DB_AVAILABLE: return 0
        try:
            db = get_db()
            result = db.table(TABLE_NAME).select("id", count="exact").eq("user_id", user_id).execute()
            return result.count if hasattr(result, 'count') else len(result.data or [])
        except: return 0

    async def get_core_memory_count(self, user_id: str) -> int:
        if not DB_AVAILABLE: return 0
        try:
            db = get_db()
            result = db.table(TABLE_NAME).select("id", count="exact").eq("user_id", user_id).gte("importance", 80).execute()
            return result.count if hasattr(result, 'count') else len(result.data or [])
        except: return 0

unified_memory_engine = UnifiedMemoryEngine()
logger.info("✅ Unified Memory Engine v2.1 ready")
