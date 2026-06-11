import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { supabase } from './supabase';
import { useTwinStore } from '../store/useTwinStore';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

const APP_VERSION = Application.nativeApplicationVersion ?? '1.0.0';
const PLATFORM = Platform.OS;

let requestCounter = 0;
function generateRequestId(): string {
  requestCounter++;
  return `${Date.now().toString(36)}-${requestCounter.toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
}

export const API = axios.create({
  baseURL: BASE_URL,
  timeout: 25000,
  headers: { 'Content-Type': 'application/json' },
});

let _token = '';
export function setToken(token: string) { _token = token; }
export function getToken() { return _token; }

async function getFreshToken(): Promise<string> {
  if (_token) return _token;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      _token = session.access_token;
      return _token;
    }
  } catch (e) { console.error('getSession error:', e); }
  return '';
}

// ─ـ معترض الطلب ──────────────────────────────────
API.interceptors.request.use(async (config) => {
  if (!config.headers['X-Request-ID']) {
    config.headers['X-Request-ID'] = generateRequestId();
  }
  config.headers['X-App-Version'] = APP_VERSION;
  config.headers['X-Platform'] = PLATFORM;

  const token = await getFreshToken();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ─ـ معترض الاستجابة (تجديد التوكن + إعادة محاولة) ──
interface RetryConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _retryCount?: number;
}

API.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    if (!config) return Promise.reject(error);

    if (error.response?.status === 401 && !config._retry) {
      config._retry = true;
      try {
        const { data: { session } } = await supabase.auth.refreshSession();
        if (session?.access_token) {
          _token = session.access_token;
          if (config.headers) config.headers['Authorization'] = `Bearer ${_token}`;
          return API(config);
        }
      } catch (refreshError) { console.error('Token refresh failed:', refreshError); }
    }

    const shouldRetry = !error.response || error.response.status >= 502;
    if (shouldRetry) {
      config._retryCount = config._retryCount ?? 0;
      if (config._retryCount < 3) {
        config._retryCount++;
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, config._retryCount!) * 1000));
        return API(config);
      }
    }

    return Promise.reject(error);
  }
);

// ─ـ أنواع البيانات الجديدة ─────────────────────────
export interface TwinResponse {
  reply: string;
  new_bond?: number;
  emotion?: {
    primary: string;
    secondary: string;
    intensity: number;
    valence: number;
    arousal: number;
    trend?: string;
    riskLevel?: string;
  };
  relationship_dims?: Record<string, number>;
  relationship_stage?: string;
  journey_phase?: string;
  journey_day?: number;
  attachment_style?: string;
  consciousness?: {
    last_thought?: string;
    active_goals?: string[];
  };
  memory_used?: boolean;
  thinking_stage?: string;
  dialect?: string;
  latency_ms?: number;
  energy?: number;
  provider?: string;
}

export interface TwinRequest {
  message: string;
  twinName: string;
  bondLevel: number;
  relationshipDims: Record<string, number>;
  chatHistory?: Array<{ role: string; content: string }>;
  journeyPhase?: string;
  attachmentStyle?: string;
  twinStyle?: string;
  replyStyle?: string;
  lang?: string;
  image?: string;
  calmMode?: boolean;
}

// ─ـ دالة المحادثة الرئيسية (ترسل المتجر كاملاً) ────
export const askTwin = async (req: TwinRequest): Promise<TwinResponse> => {
  const payload = {
    message: req.message,
    twin_name: req.twinName || 'توأمك',
    bond_level: req.bondLevel || 0,
    relationship_dims: req.relationshipDims || {},
    history: req.chatHistory?.slice(-10) || [],
    journey_phase: req.journeyPhase || 'introduction',
    attachment_style: req.attachmentStyle || 'unknown',
    twin_style: req.twinStyle || 'supportive',
    reply_style: req.replyStyle || 'medium',
    lang: req.lang || 'ar',
    image: req.image || undefined,
    calm_mode: req.calmMode || false,
  };

  const { data } = await API.post('/api/chat', payload, {
    headers: { 'X-Calm-Mode': String(req.calmMode || false) },
  });

  // بناء الاستجابة الكاملة
  return {
    reply: data.reply,
    new_bond: data.new_bond,
    emotion: data.emotion,
    relationship_dims: data.relationship_dims,
    relationship_stage: data.relationship_stage,
    journey_phase: data.journey_phase,
    journey_day: data.journey_day,
    attachment_style: data.attachment_style,
    consciousness: data.consciousness,
    memory_used: data.memory_used,
    thinking_stage: data.thinking_stage,
    dialect: data.dialect,
    latency_ms: data.latency_ms,
    energy: data.energy,
    provider: data.provider,
  };
};

// ─ـ دالة البث المباشر (Streaming) ─────────────────
export const askTwinStream = async function* (req: TwinRequest): AsyncGenerator<string, void, unknown> {
  const payload = {
    message: req.message,
    twin_name: req.twinName || 'توأمك',
    bond_level: req.bondLevel || 0,
    relationship_dims: req.relationshipDims || {},
    history: req.chatHistory?.slice(-10) || [],
    journey_phase: req.journeyPhase || 'introduction',
    attachment_style: req.attachmentStyle || 'unknown',
    twin_style: req.twinStyle || 'supportive',
    reply_style: req.replyStyle || 'medium',
    lang: req.lang || 'ar',
    image: req.image || undefined,
    calm_mode: req.calmMode || false,
  };

  const response = await API.post('/api/chat/stream', payload, {
    responseType: 'stream',
    headers: { 'X-Calm-Mode': String(req.calmMode || false) },
  });

  const stream = response.data;
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield decoder.decode(value, { stream: true });
  }
};

// ─ـ دوال مساعدة للتكامل مع المتجر ─────────────────
export const sendChatFromStore = async (message: string, image?: string): Promise<TwinResponse> => {
  const store = useTwinStore.getState();
  return askTwin({
    message,
    twinName: store.twinName,
    bondLevel: store.bondLevel,
    relationshipDims: store.relationshipDims,
    chatHistory: store.chatHistory.slice(-10),
    journeyPhase: store.journeyPhase,
    attachmentStyle: store.attachmentStyle,
    twinStyle: store.twinStyle,
    replyStyle: store.replyStyle,
    lang: store.lang,
    image,
    calmMode: store.calmMode,
  });
};

export const updateStoreFromResponse = (response: TwinResponse) => {
  const store = useTwinStore.getState();
  
  if (response.new_bond !== undefined) store.updateBond(response.new_bond);
  if (response.relationship_dims) store.updateRelationshipDims(response.relationship_dims);
  if (response.energy !== undefined) store.setEnergy(response.energy);
  if (response.journey_phase) store.setJourneyPhase(response.journey_phase as any);
  if (response.attachment_style) store.setAttachmentStyle(response.attachment_style as any);
  if (response.emotion) store.setEmotionState(response.emotion as any);
  if (response.thinking_stage) store.setThinking(true);
  store.setTotalMessages(store.totalMessages + 1);
};

// ─ـ حفظ الذاكرة ──────────────────────────────────
export const saveMemory = async (memory: object) => {
  try {
    return await API.post('/api/memory/save', memory);
  } catch (error) {
    console.error('saveMemory failed:', error);
    throw error;
  }
};

export default API;
