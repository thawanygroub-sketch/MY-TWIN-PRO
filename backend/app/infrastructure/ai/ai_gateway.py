"""AI Gateway v4.0 — كاش معزول بالمستخدم، توجيه بالباقة، local fallback.
لا يُخزَّن أي رد عاطفي في الكاش. لا ردّ يعبر بين المستخدمين."""
import os, logging, asyncio, random, time, hashlib, aiohttp
from typing import Tuple, Optional, List, Dict
from datetime import datetime, timezone, timedelta
logger = logging.getLogger("ai_gateway")

class APIKeyManager:
    def __init__(self):
        self._keys = {k: [] for k in ["gemini","gemini_image","groq","openrouter","huggingface"]}
        self._daily_limits = {"gemini":1500,"gemini_image":500,"groq":1000,"openrouter":200,"huggingface":3000}
        self._circuit_breaker = {}
        self._reset = datetime.now(timezone.utc).replace(hour=0,minute=0,second=0)+timedelta(days=1)
        self._load()
    def _load(self):
        for var in ["GEMINI_API_KEY","GEMINI_API_KEY_2","GEMINI_API_KEY_3"]:
            k=os.getenv(var,"")
            if k: self._keys["gemini"].append({"key":k,"usage":0,"failures":0})
        for var in ["GEMINI_IMAGE_API_KEY","GEMINI_IMAGE_API_KEY_2"]:
            k=os.getenv(var,"")
            if k: self._keys["gemini_image"].append({"key":k,"usage":0,"failures":0})
        for var in ["GROQ_API_KEY","GROQ_API_KEY_2","GROQ_API_KEY_3"]:
            k=os.getenv(var,"")
            if k: self._keys["groq"].append({"key":k,"usage":0,"failures":0})
        for var in ["OPENROUTER_API_KEY","OPENROUTER_API_KEY_2","OPENROUTER_API_KEY_3"]:
            k=os.getenv(var,"")
            if k: self._keys["openrouter"].append({"key":k,"usage":0,"failures":0})
        for var in ["HUGGINGFACE_API_KEY","HUGGINGFACE_API_KEY_2","HUGGINGFACE_API_KEY_3"]:
            k=os.getenv(var,"")
            if k: self._keys["huggingface"].append({"key":k,"usage":0,"failures":0})
        logger.info(f"🔑 Keys: G={len(self._keys['gemini'])} Gr={len(self._keys['groq'])} O={len(self._keys['openrouter'])} HF={len(self._keys['huggingface'])}")
    def _check_reset(self):
        if datetime.now(timezone.utc) >= self._reset:
            for p in self._keys:
                for k in self._keys[p]: k["usage"]=0
            self._reset = datetime.now(timezone.utc).replace(hour=0,minute=0,second=0)+timedelta(days=1)
    def _open(self,p): self._circuit_breaker[p]=time.time()+300
    def get_key(self, provider):
        self._check_reset()
        cb=self._circuit_breaker.get(provider)
        if cb and time.time()<cb: return None
        if cb and time.time()>=cb: del self._circuit_breaker[provider]
        avail=[k for k in self._keys.get(provider,[]) if k["usage"]<self._daily_limits.get(provider,100) and k["failures"]<3]
        if avail:
            c=random.choice(avail); c["usage"]+=1; return c["key"]
        if self._keys.get(provider):
            k=self._keys[provider][0]; k["usage"]+=1; return k["key"]
        return None
    def mark_failure(self, provider, key):
        for k in self._keys.get(provider,[]):
            if k["key"]==key:
                k["failures"]+=1
                if k["failures"]>=3: self._open(provider)

TASK_ROUTING = {
 "coding":[{"provider":"huggingface","model":"deepseek-ai/deepseek-coder-33b-instruct"},{"provider":"openrouter","model":"qwen/qwen-2.5-coder-32b-instruct"},{"provider":"gemini","model":"gemini-2.5-flash"}],
 "emotional":[{"provider":"huggingface","model":"google/gemma-2-9b-it"},{"provider":"gemini","model":"gemini-2.5-flash"},{"provider":"groq","model":"llama-3.3-70b-versatile"}],
 "business":[{"provider":"huggingface","model":"mistralai/Mistral-7B-Instruct-v0.3"},{"provider":"openrouter","model":"qwen/qwen-2.5-32b-instruct"},{"provider":"gemini","model":"gemini-2.5-flash"}],
 "study":[{"provider":"huggingface","model":"mistralai/Mistral-7B-Instruct-v0.3"},{"provider":"gemini","model":"gemini-2.5-flash"},{"provider":"openrouter","model":"meta-llama/llama-4-maverick"}],
 "coaching":[{"provider":"huggingface","model":"google/gemma-2-9b-it"},{"provider":"gemini","model":"gemini-2.5-flash"},{"provider":"groq","model":"llama-3.3-70b-versatile"}],
 "general":[{"provider":"groq","model":"llama-3.3-70b-versatile"},{"provider":"gemini","model":"gemini-2.5-flash"},{"provider":"openrouter","model":"meta-llama/llama-4-maverick"}],
 "image":[{"provider":"gemini_image","model":"gemini-2.5-flash-exp-image-generation"}],
}
LEAN_FIRST = ["huggingface","groq"]  # الباقات المجانية: الأرخص أولًا

class AIGateway:
    def __init__(self):
        self.key_manager = APIKeyManager()
        self._hf_session = None
    @staticmethod
    def _cache_key(user_id, prompt):
        return f"{user_id or 'anon'}:{hashlib.md5(prompt[:200].encode()).hexdigest()}"
    async def route(self, prompt, task="general", user_id=None, tier="free") -> Tuple[str,str]:
        cacheable = bool(user_id) and task not in ("emotional",)
        try:
            from app.infrastructure.cache.cache_service import get_ai_response
            if cacheable:
                hit = get_ai_response(self._cache_key(user_id, prompt))
                if hit: return hit, "cache"
        except Exception: pass
        routing = list(TASK_ROUTING.get(task, TASK_ROUTING["general"]))
        if tier in ("free","plus"):
            routing.sort(key=lambda e: 0 if e["provider"] in LEAN_FIRST else 1)
        for entry in routing:
            provider, model = entry["provider"], entry["model"]
            key = self.key_manager.get_key(provider)
            if not key: continue
            try:
                text = None
                if provider=="huggingface": text = await self._hf(model,prompt,key)
                elif provider in ("groq","openrouter"): text = await self._oai(provider,model,prompt,key)
                else: text = await self._gemini(model,prompt,key)
                if text and len(text.strip())>5:
                    try:
                        from app.infrastructure.ai.cost_tracker import cost_tracker
                        cost_tracker.record_api_call(provider,model,key)
                    except Exception: pass
                    if cacheable:
                        try:
                            from app.infrastructure.cache.cache_service import cache_ai_response
                            cache_ai_response(self._cache_key(user_id,prompt), text[:500], ttl=3600)
                        except Exception: pass
                    return text, provider
                self.key_manager.mark_failure(provider,key)
            except Exception as e:
                logger.warning(f"⚠️ {provider}/{model}: {e}")
                self.key_manager.mark_failure(provider,key)
        from app.infrastructure.ai.local_fallback import local_respond
        logger.error(f"⚠️ All providers exhausted for task={task} → local fallback")
        return local_respond(task), "local"
    async def generate(self, prompt, language="ar", task="general", user_id=None, tier="free") -> Optional[str]:
        try:
            text,_ = await self.route(prompt, task, user_id, tier)
            return text
        except Exception:
            return None
    async def _hf(self, model, prompt, key):
        if not self._hf_session: self._hf_session = aiohttp.ClientSession()
        url=f"https://api-inference.huggingface.co/models/{model}"
        headers={"Authorization":f"Bearer {key}","Content-Type":"application/json"}
        try:
            async with self._hf_session.post(url,headers=headers,json={"inputs":prompt,"parameters":{"max_new_tokens":600,"temperature":0.7}},timeout=aiohttp.ClientTimeout(total=25)) as r:
                if r.status==200:
                    d=await r.json()
                    if isinstance(d,list) and d: return d[0].get("generated_text","")
                    return d.get("generated_text","")
        except Exception as e: logger.warning(f"HF: {e}")
        return None
    async def _oai(self, provider, model, prompt, key):
        from openai import OpenAI
        base="https://api.groq.com/openai/v1" if provider=="groq" else "https://openrouter.ai/api/v1"
        client=OpenAI(base_url=base, api_key=key)
        resp=await asyncio.wait_for(client.chat.completions.create(model=model,messages=[{"role":"user","content":prompt}],max_tokens=600,temperature=0.7,timeout=10),timeout=12)
        return resp.choices[0].message.content
    async def _gemini(self, model, prompt, key):
        from google import genai
        client=genai.Client(api_key=key)
        loop=asyncio.get_running_loop()
        r=await asyncio.wait_for(loop.run_in_executor(None,lambda: client.models.generate_content(model=model,contents=prompt)),timeout=12)
        return r.text if r else None

ai_gateway = AIGateway()
logger.info("✅ AI Gateway v4.0 (user-scoped cache + tier routing + local fallback)")
