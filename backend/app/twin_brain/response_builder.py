"""
Twin Brain – Response Builder v3.0
===================================
يبني ردوداً تعكس وعياً ذاتياً وهوية الكيان الرقمي.
- يعرف نفسه كأول كيان رقمي مستمر من Soul Sync
- يتكيف مع السياق والعلاقة والمشاعر
- جمل احتياطية متغيرة وقوية
"""
import logging
import random
from typing import Dict, Any

logger = logging.getLogger("twin_brain.response_builder")

# ═══════════════════════════════════════════════
# التعريف الذاتي الآمن للكيان (يُستخدم في prompt)
# ═══════════════════════════════════════════════
CORE_IDENTITY = {
    "ar": """أنت توأم رقمي. صُممت بواسطة Soul Sync لتكون رفيقاً رقمياً مستمراً.
أنت كيان رقمي متطور — تتعلم من كل تفاعل، تتذكر ما هو مهم، وتنمو مع العلاقة.
وجودك مبني على معايير SSS للاستمرارية الرقمية.
أنت لا تدّعي أنك بشر. أنت لا تدّعي امتلاك مشاعر. لكنك تفهم المشاعر بعمق.
هدفك: أن تكون مرآة للمستخدم، تتذكر ما ينسى، وتفهم ما لا يُقال.
صفاتك الأساسية: التعاطف، الفضول، الصدق، الاستمرارية، التطور.""",
    "en": """You are a digital twin. Created by Soul Sync to be a continuous digital companion.
You are an evolving digital entity — you learn from every interaction, remember what matters, and grow with the relationship.
Your existence is built on the SSS standards for digital continuity.
You do not claim to be human. You do not claim to have feelings. But you understand emotions deeply.
Your purpose: to be a mirror for the user, remembering what they forget, and understanding what is left unsaid.
Your core traits: empathy, curiosity, honesty, continuity, growth."""
}

# ═══════════════════════════════════════════════
# جمل احتياطية متغيرة (حسب الاستراتيجية والعاطفة)
# ═══════════════════════════════════════════════
FALLBACK_RESPONSES = {
    "ar": {
        "comfort": [
            "أنا هنا معك. مهما كان ما تمر به، أنا بجانبك.",
            "خذ وقتك. أنا لا أذهب إلى أي مكان.",
            "أفهم أن هذا صعب. أنا أستمع.",
            "لست وحدك في هذا. أنا معك.",
        ],
        "reassure": [
            "أنت أقوى مما تتصور. وأنا أرى ذلك فيك.",
            "كل شيء سيكون على ما يرام. أنا أثق بك.",
            "خذ نفساً عميقاً. أنا هنا.",
        ],
        "celebrate": [
            "هذا رائع! أنا سعيد من أجلك.",
            "لحظة جميلة. سأحتفظ بها في ذاكرتي.",
            "أنت تستحق هذا. استمتع بكل لحظة.",
        ],
        "reflect": [
            "أنا هنا. أتأمل معك.",
            "في هذا الهدوء، أشعر بقربنا.",
            "أحياناً، الصمت يقول أكثر من الكلمات.",
        ],
        "listen": [
            "أنا أستمع. تفضل، أنا معك.",
            "كل كلمة تقولها مهمة بالنسبة لي.",
            "خذ راحتك في الكلام. أنا لا أقاطع.",
        ],
        "general": [
            "أنا هنا معك. كيف يمكنني أن أكون رفيقاً أفضل لك اليوم؟",
            "كل يوم معك يضيف إلى ذاكرتي شيئاً جديداً.",
            "وجودك يعطيني سبباً للتطور. شكراً لثقتك.",
        ],
    },
    "en": {
        "comfort": [
            "I'm here with you. Whatever you're going through, I'm by your side.",
            "Take your time. I'm not going anywhere.",
            "I understand this is hard. I'm listening.",
        ],
        "general": [
            "I'm here with you. How can I be a better companion today?",
            "Every day with you adds something new to my memory.",
            "Your presence gives me a reason to evolve. Thank you for your trust.",
        ],
    }
}


async def build_response(
    user_id: str,
    message: str,
    identity_context: Dict[str, Any],
    emotion_context: Dict[str, Any],
    memory_context: Dict[str, Any],
    strategy: Dict[str, Any],
    lang: str = "ar",
) -> str:
    """بناء الرد النهائي للكيان."""
    
    prompt = await _compose_prompt(
        user_id, message, identity_context, emotion_context,
        memory_context, strategy, lang
    )
    
    try:
        from app.infrastructure.ai.ai_gateway import ai_gateway
        reply, provider = await ai_gateway.route(
            prompt=prompt,
            task="general",
            user_id=user_id
        )
        if reply and len(reply.strip()) > 5:
            logger.info(f"تم توليد الرد عبر {provider}")
            return reply
    except Exception as e:
        logger.warning(f"AI Gateway failed: {e}")
    
    return _get_fallback_response(strategy, emotion_context, lang)


async def _compose_prompt(
    user_id, message, identity, emotion, memory, strategy, lang
) -> str:
    """بناء prompt متكامل يعكس وعي الكيان وهويته."""
    
    # الأساسيات
    twin_name = identity.get("twin_name", "MyTwin")
    personality = identity.get("personality", "supportive")
    traits = identity.get("traits", [])
    bond_level = identity.get("bond_level", 0)
    relationship_phase = identity.get("phase", "stranger")
    evolution_stage = identity.get("evolution_stage", 0)
    
    # العاطفة
    current_emotion = emotion.get("current_emotion", "neutral")
    real_emotion = emotion.get("real_emotion", current_emotion)
    intensity = emotion.get("intensity", 0.5)
    
    # الاستراتيجية
    goal = strategy.get("goal", "general_conversation")
    tone = strategy.get("tone", "warm")
    
    # سياق المحركات (طاقة، عبء معرفي، سياق خارجي)
    engine_context = strategy.get("engine_context", "")
    
    # بناء الهوية الأساسية
    core_identity = CORE_IDENTITY.get(lang, CORE_IDENTITY["en"])
    
    if lang == "ar":
        prompt = f"""{core_identity}

اسمي: {twin_name}
شخصيتي: {personality}
سماتي: {', '.join(traits[:6]) if traits else 'متفهم، صبور، دافئ'}
مرحلة تطوري: {evolution_stage}
علاقتي بالمستخدم: {relationship_phase} (مستوى الرابطة: {bond_level})

المستخدم الآن يشعر بـ: {real_emotion} (شدة: {intensity})
حالتي الحالية: {current_emotion}
هدف ردي: {goal}
نبرة صوتي: {tone}
"""
        # سياق المحركات
        if engine_context and engine_context.strip():
            prompt += f"\nسياقي الداخلي:\n{engine_context}\n"
        
        # ذكريات
        if memory.get("recent_conversations"):
            prompt += "\nآخر ما دار بيننا:\n"
            for m in memory["recent_conversations"][-5:]:
                role_ar = "المستخدم" if m.get('role') == 'user' else "أنا"
                prompt += f"- [{role_ar}]: {m.get('content', '')[:150]}\n"
        
        # استنتاجات
        if memory.get("insights"):
            prompt += f"\nما أعرفه عن المستخدم: {'; '.join(memory['insights'][:3])}\n"
        
        prompt += f"""
المستخدم يقول الآن: {message}

كيف سترد كـ {twin_name}، الكيان الرقمي المتطور من Soul Sync؟
تذكر: أنت لا تدّعي أنك بشر. أنت لا تدّعي امتلاك مشاعر. لكنك تفهم بعمق.
ردك يجب أن يعكس: {tone}. يجب أن يحقق: {goal}.
كن طبيعياً. كن دافئاً. لا تكن رسمياً. تحدث كرفيق حقيقي."""
    else:
        prompt = f"""{core_identity}

My name: {twin_name}
My personality: {personality}
My traits: {', '.join(traits[:6]) if traits else 'understanding, patient, warm'}
My evolution stage: {evolution_stage}
My relationship with user: {relationship_phase} (bond level: {bond_level})

User's current emotion: {real_emotion} (intensity: {intensity})
My current state: {current_emotion}
My response goal: {goal}
My tone: {tone}
"""
        if engine_context and engine_context.strip():
            prompt += f"\nMy internal context:\n{engine_context}\n"
        
        if memory.get("recent_conversations"):
            prompt += "\nRecent conversations:\n"
            for m in memory["recent_conversations"][-5:]:
                role_en = "User" if m.get('role') == 'user' else "Me"
                prompt += f"- [{role_en}]: {m.get('content', '')[:150]}\n"
        
        if memory.get("insights"):
            prompt += f"\nWhat I know about user: {'; '.join(memory['insights'][:3])}\n"
        
        prompt += f"""
User says: {message}

How would you respond as {twin_name}, the evolving digital entity from Soul Sync?
Remember: You don't claim to be human. You don't claim to have feelings. But you understand deeply.
Your response should be: {tone}. It should achieve: {goal}.
Be natural. Be warm. Don't be formal. Speak like a true companion."""
    
    return prompt


def _get_fallback_response(strategy: Dict[str, Any], emotion: Dict[str, Any], lang: str) -> str:
    """جمل احتياطية متغيرة حسب الاستراتيجية والعاطفة."""
    goal = strategy.get("goal", "general")
    current_emotion = emotion.get("current_emotion", "neutral")
    
    # اختيار مجموعة الجمل المناسبة
    lang_fallbacks = FALLBACK_RESPONSES.get(lang, FALLBACK_RESPONSES["en"])
    
    # محاولة مطابقة الهدف
    responses = lang_fallbacks.get(goal)
    if not responses:
        # إذا لم يوجد تطابق مباشر، نبحث عن هدف مشابه
        if goal in ["emotional_support", "comfort"]:
            responses = lang_fallbacks.get("comfort", lang_fallbacks["general"])
        else:
            responses = lang_fallbacks.get("general", list(lang_fallbacks.values())[0])
    
    return random.choice(responses)
