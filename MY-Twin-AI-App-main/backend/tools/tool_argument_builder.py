import re
from typing import Dict, Any, Optional

class ToolArgumentBuilder:
    def __init__(self):
        self.city_keywords = [
            "القاهرة", "الإسكندرية", "الرياض", "جدة", "دبي", "أبوظبي", "الدوحة", "مسقط",
            "المنامة", "بغداد", "دمشق", "عمان", "بيروت", "الخرطوم", "طرابلس", "تونس",
            "الجزائر", "الرباط", "الكويت", "صنعاء", "مكة", "المدينة", "القدس",
            "اسطنبول", "لندن", "نيويورك", "باريس", "برلين", "طوكيو", "سيدني"
        ]

    def build_args(self, tool_name: str, message: str, user_id: str, tier: str = "free",
                   user_profile: Optional[Dict] = None) -> Dict[str, Any]:
        args = {"user_id": user_id, "tier": tier}

        if tool_name == "get_weather":
            args["city"] = self._extract_city(message) or "Cairo"
        elif tool_name in ["search_google", "search_youtube", "search_spotify"]:
            args["query"] = self._extract_query(message, tool_name)
            if tool_name == "search_youtube":
                args["lang"] = "ar"
        elif tool_name == "get_news":
            args["country"] = "sa"
        elif tool_name == "get_currency":
            args["base"] = "USD"
        elif tool_name == "send_email":
            args["to"] = self._extract_email(message) or ""
            args["subject"] = "MyTwin Message"
            args["body"] = message
        elif tool_name == "send_telegram":
            args["chat_id"] = user_profile.get("telegram_chat_id", "") if user_profile else ""
            args["message"] = message
        elif tool_name == "home_assistant_control":
            args["command"] = message
            args["entity_id"] = user_profile.get("home_entity_id") if user_profile else None
        elif tool_name in ["remind_goal", "analyze_progress", "fetch_memory"]:
            args["query"] = message

        return args

    def _extract_city(self, text: str) -> Optional[str]:
        # محاولة استخدام القائمة الثابتة أولاً (أسرع وأدق)
        for city in self.city_keywords:
            if city in text:
                return city
        # محاولة استخراج اسم مكان باستخدام نمط بسيط
        patterns = [
            r'(?:في|ب|بمدينة|مدينة)\s+([^\s،.!]+)',
            r'(?:in|city of|city)\s+([a-zA-Z\s]+?)(?:\s|$)',
            r'weather (?:in|for) ([a-zA-Z\s]+?)(?:\s|$)',
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                city = match.group(1).strip()
                if city and len(city) > 1 and not city.isdigit():
                    return city
        return None

    def _extract_query(self, text: str, tool_name: str) -> str:
        patterns = [
            r'(ابحث عن|ابحث في جوجل عن|ابحث|search for|search|play|شغل|أريد|اعرض)\s+',
        ]
        query = text
        for pattern in patterns:
            query = re.sub(pattern, '', query, flags=re.IGNORECASE).strip()
        return query or text

    def _extract_email(self, text: str) -> Optional[str]:
        match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
        return match.group(0) if match else None


tool_argument_builder = ToolArgumentBuilder()
