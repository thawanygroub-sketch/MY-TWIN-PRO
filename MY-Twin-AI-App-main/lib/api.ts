import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { supabase } from './supabase';
import { useTwinStore, RelationshipDims } from '../store/useTwinStore';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');
const APP_VERSION = Application.nativeApplicationVersion ?? '1.0.0';
const PLATFORM = Platform.OS;

let requestCounter = 0;
function generateRequestId(): string { requestCounter++; return `${Date.now().toString(36)}-${requestCounter.toString(36)}-${Math.random().toString(36).substring(2, 7)}`; }

export const API = axios.create({ baseURL: BASE_URL, timeout: 25000, headers: { 'Content-Type': 'application/json' } });

let _token = '';
let _tokenRefreshing = false;
let _tokenPromise: Promise<string> | null = null;

export function setToken(token: string) { _token = token; }
export function getToken() { return _token; }

async function getFreshToken(): Promise<string> {
  if (_token) return _token;
  if (_tokenRefreshing && _tokenPromise) return _tokenPromise;
  _tokenRefreshing = true;
  _tokenPromise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) { _token = session.access_token; return _token; }
    } catch (e) { console.error('getSession error:', e); }
    return '';
  })();
  _tokenPromise.finally(() => { _tokenRefreshing = false; _tokenPromise = null; });
  return _tokenPromise;
}

API.interceptors.request.use(async (config) => {
  if (!config.headers['X-Request-ID']) config.headers['X-Request-ID'] = generateRequestId();
  config.headers['X-App-Version'] = APP_VERSION; config.headers['X-Platform'] = PLATFORM;
  try { const store = useTwinStore.getState(); if (store.twinGender) config.headers['X-Twin-Gender'] = store.twinGender; } catch (e) {}
  const token = await getFreshToken(); if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

interface RetryConfig extends InternalAxiosRequestConfig { _retry?: boolean; _retryCount?: number; }

API.interceptors.response.use((r) => r, async (error: AxiosError) => {
  const config = error.config as RetryConfig | undefined; if (!config) return Promise.reject(error);
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
});

export interface TwinResponse {
  reply: string; new_bond?: number; twin_gender?: 'male'|'female'; voice_personality?: string;
  emotion?: { primary: string; secondary: string; intensity: number; valence: number; arousal: number; trend?: string; riskLevel?: string };
  relationship_dims?: Record<string, number>; relationship_stage?: string; journey_phase?: string; journey_day?: number;
  attachment_style?: string; consciousness?: { last_thought?: string; active_goals?: string[] };
  memory_used?: boolean; thinking_stage?: string; dialect?: string; latency_ms?: number; energy?: number; provider?: string;
}

export interface TwinRequest {
  message: string; twinName: string; bondLevel: number; relationshipDims: RelationshipDims;
  chatHistory?: Array<{ role: string; content: string }>; journeyPhase?: string; attachmentStyle?: string;
  twinStyle?: string; replyStyle?: string; lang?: string; image?: string; calmMode?: boolean; twinGender?: 'male'|'female';
}

function toSafeRecord(dims: RelationshipDims | Record<string, any>): Record<string, number> {
  const out: Record<string, number> = {};
  if (dims && typeof dims === 'object') {
    for (const [k, v] of Object.entries(dims)) {
      if (typeof v === 'number') out[k] = v;
    }
  }
  return out;
}

export const askTwin = async (req: TwinRequest): Promise<TwinResponse> => {
  const store = useTwinStore.getState(); const g = req.twinGender || store.twinGender || 'female';
  const safeDims = toSafeRecord(req.relationshipDims || {});
  const payload = { message: req.message, twin_name: req.twinName||'توأمك', bond_level: req.bondLevel||0, relationship_dims: safeDims, history: req.chatHistory?.slice(-10)||[], journey_phase: req.journeyPhase||'introduction', attachment_style: req.attachmentStyle||'unknown', twin_style: req.twinStyle||'supportive', reply_style: req.replyStyle||'medium', lang: req.lang||'ar', image: req.image, calm_mode: req.calmMode||false, twin_gender: g };
  const { data } = await API.post('/api/chat', payload, { headers: { 'X-Calm-Mode': String(req.calmMode||false), 'X-Twin-Gender': g } });
  return { reply: data.reply, new_bond: data.new_bond, emotion: data.emotion, relationship_dims: data.relationship_dims, relationship_stage: data.relationship_stage, journey_phase: data.journey_phase, journey_day: data.journey_day, attachment_style: data.attachment_style, consciousness: data.consciousness, memory_used: data.memory_used, thinking_stage: data.thinking_stage, dialect: data.dialect, latency_ms: data.latency_ms, energy: data.energy, provider: data.provider, twin_gender: data.twin_gender||g, voice_personality: data.voice_personality };
};

export const askTwinStream = async function* (req: TwinRequest): AsyncGenerator<string, void, unknown> {
  const store = useTwinStore.getState(); const g = req.twinGender || store.twinGender || 'female';
  const safeDims = toSafeRecord(req.relationshipDims || {});
  const payload = { message: req.message, twin_name: req.twinName||'توأمك', bond_level: req.bondLevel||0, relationship_dims: safeDims, history: req.chatHistory?.slice(-10)||[], journey_phase: req.journeyPhase||'introduction', attachment_style: req.attachmentStyle||'unknown', twin_style: req.twinStyle||'supportive', reply_style: req.replyStyle||'medium', lang: req.lang||'ar', image: req.image, calm_mode: req.calmMode||false, twin_gender: g };
  const response = await API.post('/api/chat/stream', payload, { responseType: 'stream', headers: { 'X-Calm-Mode': String(req.calmMode||false), 'X-Twin-Gender': g } });
  const stream = response.data; const reader = stream.getReader(); const decoder = new TextDecoder();
  while (true) { const { done, value } = await reader.read(); if (done) break; yield decoder.decode(value, { stream: true }); }
};

export const sendChatFromStore = async (message: string, image?: string): Promise<TwinResponse> => {
  const s = useTwinStore.getState();
  return askTwin({ message, twinName: s.twinName, bondLevel: s.bondLevel, relationshipDims: s.relationshipDims, chatHistory: s.chatHistory.slice(-10), journeyPhase: s.journeyPhase, attachmentStyle: s.attachmentStyle, twinStyle: s.twinStyle, replyStyle: s.replyStyle, lang: s.lang, image, calmMode: s.calmMode, twinGender: s.twinGender });
};

export const updateStoreFromResponse = (r: TwinResponse) => {
  const s = useTwinStore.getState();
  if (r.new_bond !== undefined) s.updateBond(r.new_bond);
  if (r.relationship_dims) s.updateRelationshipDims(r.relationship_dims);
  if (r.energy !== undefined) s.setEnergy(r.energy);
  if (r.journey_phase) s.setJourneyPhase(r.journey_phase as any);
  if (r.attachment_style) s.setAttachmentStyle(r.attachment_style as any);
  if (r.emotion) s.setEmotionState(r.emotion as any);
  if (r.thinking_stage) { s.setThinkingStage(r.thinking_stage); s.setThinking(true); } else { s.setThinking(false); }
  if (r.twin_gender) s.setTwinGender(r.twin_gender);
  s.setTotalMessages(s.totalMessages + 1);
};

export const speakWithTwinVoice = async (text: string): Promise<void> => {
  const store = useTwinStore.getState(); const gender = store.twinGender || 'female';
  try {
    if (store.tier && ['premium','pro','yearly'].includes(store.tier)) {
      const response = await API.post('/api/voice/speak', { text, tier: store.tier, gender, emotion: store.emotionState?.primary || 'neutral' }, { responseType: 'arraybuffer' });
      if (response.data) return;
    }
    const { speakResponse } = require('../utils/voice_engine'); await speakResponse(text);
  } catch { const Speech = require('expo-speech'); Speech.speak(text, { language: 'ar', pitch: gender==='male'?0.9:1.1, rate: 0.95 }); }
};

export const saveVoicePreference = async (gender: 'male'|'female', personality?: string): Promise<void> => {
  try { await API.post('/api/voice/preferences', { gender, personality: personality||'friend' }); } catch {}
};

export const saveMemory = async (memory: object) => {
  try { return await API.post('/api/memory/save', memory); } catch (err) { throw err; }
};

export const fetchWeather = async (city: string = 'Cairo') => { const { data } = await API.get('/api/services/weather', { params: { city } }); return data; };
export const fetchYouTube = async (query: string, lang: string = 'ar') => { const { data } = await API.get('/api/services/youtube', { params: { query, lang } }); return data; };
export const fetchSpotify = async (query: string) => { const { data } = await API.get('/api/services/spotify', { params: { query } }); return data; };
export const fetchGoogleSearch = async (query: string) => { const { data } = await API.get('/api/services/google', { params: { query } }); return data; };
export const fetchCalendarEvents = async () => { const { data } = await API.get('/api/services/calendar'); return data; };
export const fetchNews = async (country: string = 'sa') => { const { data } = await API.get('/api/services/news', { params: { country } }); return data; };
export const fetchMaps = async (query: string) => { const { data } = await API.get('/api/services/maps', { params: { query } }); return data; };
export const fetchLocationInfo = async (lat: number, lon: number) => { const { data } = await API.get('/api/services/location', { params: { lat, lon } }); return data; };
export const fetchCurrency = async (base: string = 'USD') => { const { data } = await API.get('/api/services/currency', { params: { base } }); return data; };
export const sendHomeAssistantCommand = async (command: string, entity_id?: string) => { const { data } = await API.post('/api/services/homeassistant', { command, entity_id }); return data; };
export const sendEmail = async (to: string, subject: string, body: string) => { const { data } = await API.post('/api/services/email', { to, subject, body }); return data; };
export const sendTelegram = async (chatId: string, message: string) => { const { data } = await API.post('/api/services/telegram', { chat_id: chatId, message }); return data; };
export const fetchNotes = async () => { const { data } = await API.get('/api/services/notes'); return data; };
export const createNote = async (content: string) => { const { data } = await API.post('/api/services/notes', { content }); return data; };
export const fetchTasks = async () => { const { data } = await API.get('/api/services/tasks'); return data; };
export const createTask = async (title: string, due?: string) => { const { data } = await API.post('/api/services/tasks', { title, due }); return data; };

export default API;
