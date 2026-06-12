"""
MyTwin – Model Registry (سجل النماذج)
يفصل أسماء النماذج عن الكود لتسهيل التحديث
"""
from typing import Dict, List

# مزودي الخدمة
PROVIDERS = {
    "groq": "Groq",
    "openrouter": "OpenRouter", 
    "gemini": "Google Gemini"
}

# النماذج المتاحة
MODELS: Dict[str, Dict[str, List[str]]] = {
    "groq": {
        "primary": ["llama-3.3-70b-versatile"],
        "fallback": ["gemma2-9b-it"],
        "all": ["llama-3.3-70b-versatile", "gemma2-9b-it"]
    },
    "openrouter": {
        "primary": ["meta-llama/llama-4-maverick"],
        "fallback": [
            "deepseek/deepseek-v4-flash",
            "moonshotai/kimi-k2.6:free",
            "google/gemma-2-9b-it:free",
            "mistralai/mistral-small-3.1-24b-instruct"
        ],
        "all": [
            "meta-llama/llama-4-maverick",
            "deepseek/deepseek-v4-flash",
            "moonshotai/kimi-k2.6:free",
            "google/gemma-2-9b-it:free",
            "mistralai/mistral-small-3.1-24b-instruct"
        ]
    },
    "gemini": {
        "primary": ["gemini-2.0-flash"],
        "all": ["gemini-2.0-flash"]
    }
}

# توزيع المهام على النماذج
TASK_CHAINS: Dict[str, List[str]] = {
    "general":        ["groq/llama-3.3-70b-versatile", "openrouter/meta-llama/llama-4-maverick", "openrouter/moonshotai/kimi-k2.6:free", "gemini/gemini-2.0-flash"],
    "emotional":      ["openrouter/meta-llama/llama-4-maverick", "groq/llama-3.3-70b-versatile", "openrouter/moonshotai/kimi-k2.6:free", "gemini/gemini-2.0-flash"],
    "coding":         ["openrouter/deepseek/deepseek-v4-flash", "groq/llama-3.3-70b-versatile", "gemini/gemini-2.0-flash"],
    "deep_reasoning": ["openrouter/deepseek/deepseek-v4-flash", "openrouter/moonshotai/kimi-k2.6:free", "groq/llama-3.3-70b-versatile", "gemini/gemini-2.0-flash"],
    "multilingual":   ["openrouter/moonshotai/kimi-k2.6:free", "openrouter/meta-llama/llama-4-maverick", "groq/llama-3.3-70b-versatile", "gemini/gemini-2.0-flash"],
    "planning":       ["openrouter/moonshotai/kimi-k2.6:free", "openrouter/meta-llama/llama-4-maverick", "groq/llama-3.3-70b-versatile", "gemini/gemini-2.0-flash"],
    "coaching":       ["groq/llama-3.3-70b-versatile", "openrouter/meta-llama/llama-4-maverick", "openrouter/moonshotai/kimi-k2.6:free", "gemini/gemini-2.0-flash"],
    "dream":          ["openrouter/meta-llama/llama-4-maverick", "groq/llama-3.3-70b-versatile", "openrouter/mistralai/mistral-small-3.1-24b-instruct", "gemini/gemini-2.0-flash"],
    "search":         ["openrouter/deepseek/deepseek-v4-flash", "groq/llama-3.3-70b-versatile", "gemini/gemini-2.0-flash"],
    "agent":          ["groq/gemma2-9b-it", "groq/llama-3.3-70b-versatile", "gemini/gemini-2.0-flash"],
}

# تكاليف تقديرية (لكل 1000 توكن)
MODEL_COSTS: Dict[str, float] = {
    "groq/llama-3.3-70b-versatile": 0.0,
    "groq/gemma2-9b-it": 0.0,
    "openrouter/meta-llama/llama-4-maverick": 0.0,
    "openrouter/deepseek/deepseek-v4-flash": 0.0,
    "openrouter/moonshotai/kimi-k2.6:free": 0.0,
    "openrouter/google/gemma-2-9b-it:free": 0.0,
    "openrouter/mistralai/mistral-small-3.1-24b-instruct": 0.0,
    "gemini/gemini-2.0-flash": 0.0,
}

# أوقات استجابة متوقعة (تقديرية بالثواني)
MODEL_LATENCY_ESTIMATE: Dict[str, float] = {
    "groq": 1.5,
    "openrouter": 3.0,
    "gemini": 2.0,
}

# رسائل احتياطية (تظهر عند فشل جميع النماذج)
FALLBACK_MESSAGES = [
    "أنا هنا معاك 💜",
    "أسمعك... كمّل حديثك 🫶",
    "معاك، ما تتوقفش ✨",
    "أفهم ما تمر به... أنا بجانبك 💜",
    "روحك حلوة... أخبرني المزيد 🌸",
]

# رسالة الضغط التقني (للتوافق)
TECHNICAL_ERROR_MESSAGE = "أواجه ضغطاً تقنياً 💜"

print("✅ Model Registry جاهز")
