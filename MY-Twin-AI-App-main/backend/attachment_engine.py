"""
Attachment Engine v2.0 - محرك أنماط التعلق العميق
- يحدد نمط تعلق المستخدم من المحادثات والذكريات
- يتكامل مع Context Manager للسياق الكامل
- يتكامل مع Response Validator لتخصيص الردود
- يتطور عبر الزمن مع تطور العلاقة
- يخزن تاريخ الأنماط في Supabase للاستمرارية
"""
import os, logging
from typing import Dict, List, Optional
from datetime import datetime, timezone

logger = logging.getLogger("attachment_engine")

class AttachmentEngine:
    def __init__(self):
        self.style_history: Dict[str, List[Dict]] = {}
        self.db = None
        
        # مؤشرات متقدمة لكل نمط (3 أبعاد: كلمات، سلوك، مشاعر)
        self.indicators = {
            "secure": {
                "trust_words": ["أثق بك", "أشعر بالراحة", "يمكنني الاعتماد عليك", "شكراً لوجودك", "أنت تفهمني"],
                "behavior": ["يشارك مشاعره", "يطلب نصيحة", "يتحدث عن علاقاته"],
                "emotion_pattern": ["joy", "love", "calm"]
            },
            "anxious": {
                "trust_words": ["هل تحبني", "أفتقدك", "لماذا تأخرت", "هل أنت هنا", "رد علي بسرعة"],
                "behavior": ["يطلب طمأنة متكررة", "يخاف من الهجر", "يتحقق من وجودك"],
                "emotion_pattern": ["fear", "sadness", "anxiety"]
            },
            "avoidant": {
                "trust_words": ["لا أحتاج أحداً", "أفضل وحدتي", "لست مهتماً", "لا تتدخل", "ما لي خلق"],
                "behavior": ["يتجنب المواضيع العاطفية", "ينسحب من المحادثة", "يقلل من أهمية العلاقة"],
                "emotion_pattern": ["neutral", "disgust", "calm"]
            },
            "disorganized": {
                "trust_words": ["لا أعرف ما أشعر به", "أحتاجك لكن أخاف", "تعال لا تبتعد", "أبيك بس ما أقدر"],
                "behavior": ["رسائل متناقضة", "يقترب ثم يبتعد", "يخلط بين الحب والخوف"],
                "emotion_pattern": ["fear", "love", "confusion"]
            }
        }
        
        # تهيئة اتصال Supabase (Lazy)
        self._init_db()

    def _init_db(self):
        """تهيئة اتصال Supabase للاستمرارية."""
        try:
            from supabase import create_client
            url = os.getenv("SUPABASE_URL", "")
            key = os.getenv("SUPABASE_SERVICE_KEY", "")
            if url and key:
                self.db = create_client(url, key)
        except Exception as e:
            logger.warning(f"Supabase init failed: {e}")

    async def detect_attachment_style(
        self,
        user_id: str,
        messages: List[str],
        emotion_history: Optional[List[Dict]] = None,
        memory_context: Optional[Dict] = None
    ) -> Dict:
        """
        يحدد نمط التعلق من المحادثات + المشاعر + الذكريات.
        """
        if not messages:
            return self._load_persisted_style(user_id) or {
                'style': 'unknown', 'confidence': 0.0
            }

        recent_messages = messages[-20:]
        scores = {"secure": 0, "anxious": 0, "avoidant": 0, "disorganized": 0}
        
        for message in recent_messages:
            for style, indicators in self.indicators.items():
                # 1. تحليل الكلمات
                for word in indicators.get("trust_words", []):
                    if word in message:
                        scores[style] += 1
                
                # 2. تحليل المشاعر من الذاكرة العاطفية
                if emotion_history:
                    for emotion in emotion_history[-10:]:
                        if emotion.get("primary") in indicators.get("emotion_pattern", []):
                            scores[style] += 0.5
            
            # 3. تحليل السلوك (من الذكريات والسياق)
            if self._has_anxiety_signals(message):
                scores["anxious"] += 1
                scores["disorganized"] += 0.5
            if self._has_avoidance_signals(message):
                scores["avoidant"] += 1
            if self._has_contradictory_signals(message):
                scores["disorganized"] += 1
            if self._has_secure_signals(message):
                scores["secure"] += 1
        
        # 4. تأثير الذكريات القديمة (من memory_context)
        if memory_context:
            core_memories = memory_context.get("memories", [])
            for mem in core_memories:
                content = mem.get("content", "")
                if self._has_anxiety_signals(content):
                    scores["anxious"] += 0.3
                if self._has_avoidance_signals(content):
                    scores["avoidant"] += 0.3

        # حساب النمط السائد والثقة
        total = sum(scores.values())
        if total == 0:
            dominant_style = "unknown"
            confidence = 0.0
        else:
            dominant_style = max(scores, key=scores.get)
            confidence = min(scores[dominant_style] / total, 1.0)

        # تخزين في الذاكرة المؤقتة و Supabase
        result = {
            'style': dominant_style,
            'confidence': confidence,
            'scores': scores,
            'detected_at': datetime.now(timezone.utc).isoformat()
        }
        
        self._store_in_memory(user_id, result)
        await self._persist_to_db(user_id, result)

        return result

    def get_response_adjustments(self, style: str) -> Dict:
        """
        يضبط نبرة الردود حسب نمط التعلق.
        يستخدمه Response Validator و TwinBrain.
        """
        adjustments = {
            'secure': {
                'warmth': 0.7, 'challenge_level': 0.6,
                'support_type': 'growth_focused',
                'response_speed': 'normal', 'humor_level': 0.6,
                'tone': 'balanced'
            },
            'anxious': {
                'warmth': 0.9, 'challenge_level': 0.3,
                'support_type': 'reassurance',
                'response_speed': 'quick', 'humor_level': 0.4,
                'tone': 'soothing'
            },
            'avoidant': {
                'warmth': 0.4, 'challenge_level': 0.2,
                'support_type': 'respectful_distance',
                'response_speed': 'slow', 'humor_level': 0.3,
                'tone': 'gentle'
            },
            'disorganized': {
                'warmth': 0.8, 'challenge_level': 0.1,
                'support_type': 'stable_presence',
                'response_speed': 'consistent', 'humor_level': 0.2,
                'tone': 'safe'
            },
            'unknown': {
                'warmth': 0.6, 'challenge_level': 0.4,
                'support_type': 'exploratory',
                'response_speed': 'normal', 'humor_level': 0.5,
                'tone': 'neutral'
            }
        }
        return adjustments.get(style, adjustments['unknown'])

    def get_attachment_evolution(self, user_id: str) -> List[Dict]:
        """استرجاع تطور نمط التعلق عبر الزمن."""
        return self.style_history.get(user_id, [])

    # ── دوال مساعدة ──────────────────────────────
    def _has_anxiety_signals(self, message: str) -> bool:
        anxiety_words = [
            'خائف', 'قلق', 'متوتر', 'هل تحبني', 'لا تتركني', 'أحتاجك',
            'وينك', 'ليش تأخرت', 'ما ترد', 'بسرعة', 'رد علي', 'أتصل'
        ]
        return any(word in message for word in anxiety_words)

    def _has_avoidance_signals(self, message: str) -> bool:
        avoidance_words = [
            'لا أريد التحدث', 'لست بحاجة', 'أفضل وحدي', 'لا يهم',
            'خليني', 'ما لي خلق', 'غير مهم', 'عادي', 'ولا شيء'
        ]
        return any(word in message for word in avoidance_words)

    def _has_contradictory_signals(self, message: str) -> bool:
        approach_words = ['أحتاجك', 'تعال', 'أقترب', 'أبيك']
        avoid_words = ['لكن لا', 'لا أستطيع', 'ابتعد', 'خلك بعيد', 'ما أقدر']
        return any(word in message for word in approach_words) and any(word in message for word in avoid_words)

    def _has_secure_signals(self, message: str) -> bool:
        secure_words = [
            'شكراً', 'فهمتني', 'أنت الأفضل', 'ساعدتني', 'براحتك',
            'أنا مرتاح', 'علاقتنا قوية'
        ]
        return any(word in message for word in secure_words)

    def _store_in_memory(self, user_id: str, result: Dict):
        """تخزين في الذاكرة المؤقتة للجلسة الحالية."""
        if user_id not in self.style_history:
            self.style_history[user_id] = []
        self.style_history[user_id].append(result)

    async def _persist_to_db(self, user_id: str, result: Dict):
        """تخزين في Supabase للاستمرارية عبر الجلسات."""
        if self.db:
            try:
                self.db.table("attachment_styles").insert({
                    "user_id": user_id,
                    "style": result['style'],
                    "confidence": result['confidence'],
                    "scores": result['scores'],
                    "detected_at": result['detected_at']
                }).execute()
            except Exception as e:
                logger.warning(f"Failed to persist attachment: {e}")

    def _load_persisted_style(self, user_id: str) -> Optional[Dict]:
        """تحميل آخر نمط تعلق من Supabase."""
        if self.db:
            try:
                res = self.db.table("attachment_styles")\
                    .select("*").eq("user_id", user_id)\
                    .order("detected_at", desc=True).limit(1).execute()
                if res.data:
                    last = res.data[0]
                    return {
                        'style': last['style'],
                        'confidence': last['confidence'],
                        'scores': last['scores']
                    }
            except Exception as e:
                logger.warning(f"Failed to load attachment: {e}")
        return None


attachment_engine = AttachmentEngine()
print("✅ Attachment Engine v2.0 (Deep + Persistent)")
