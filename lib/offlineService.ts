/** offlineService v2 — الحضور لا يموت offline (الفصل 31/64).
 * لا يُرسل user_id في الأجسام أبدًا؛ الهوية عبر التوكن فقط. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiPost } from './httpClient';
import { stateBus } from '../src/core/StateBus';
import { LIVING_ERRORS } from './livingErrors';

const OFFLINE_QUEUE_KEY = 'mytwin_offline_queue';
const RESPONSE_CACHE_KEY = 'mytwin_response_cache';
const MAX_CACHED = 100; const MAX_RETRIES = 3;
interface QueuedMessage { id: string; message: string; timestamp: number; retries: number; lang?: string; }

export async function cacheResponse(query: string, reply: string): Promise<void> {
  try {
    const map = await getMap();
    map[hash(query)] = { reply, timestamp: Date.now() };
    const entries = Object.entries(map);
    if (entries.length > MAX_CACHED) delete map[entries.sort((a,b)=>a[1].timestamp-b[1].timestamp)[0][0]];
    await AsyncStorage.setItem(RESPONSE_CACHE_KEY, JSON.stringify(map));
  } catch {}
}
export async function getCachedResponse(message: string): Promise<string | null> {
  try {
    const e = (await getMap())[hash(message)];
    return e && Date.now() - e.timestamp < 3600_000 ? e.reply : null;
  } catch { return null; }
}
/** رد offline حي: كاش أولًا، ثم لغة حضور — لا خطأ تقني. */
export async function getOfflineReply(message: string): Promise<string> {
  const cached = await getCachedResponse(message);
  if (cached) return cached;
  return LIVING_ERRORS.NETWORK;
}
async function getMap(): Promise<Record<string, { reply: string; timestamp: number }>> {
  try { const raw = await AsyncStorage.getItem(RESPONSE_CACHE_KEY); return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}
function hash(s: string): string {
  let h = 0; for (let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; }
  return Math.abs(h).toString(36);
}
export async function addToOfflineQueue(message: string, lang?: string): Promise<void> {
  try {
    const q = await getOfflineQueue();
    q.push({ id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`, message, timestamp: Date.now(), retries: 0, lang });
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
  } catch {}
}
export async function getOfflineQueue(): Promise<QueuedMessage[]> {
  try { const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
export async function processOfflineQueue(): Promise<number> {
  const q = await getOfflineQueue(); if (!q.length) return 0;
  let done = 0; const rest: QueuedMessage[] = [];
  for (const item of q) {
    try { await apiPost('/api/chat', { message: item.message, lang: item.lang || 'ar' }); done++; }
    catch { if (item.retries < MAX_RETRIES) rest.push({ ...item, retries: item.retries + 1 }); }
  }
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(rest));
  return done;
}
type NetCb = (online: boolean) => void;
const listeners: NetCb[] = []; let online = true;
export function onNetworkChange(cb: NetCb): () => void { listeners.push(cb); return () => { const i = listeners.indexOf(cb); if (i>-1) listeners.splice(i,1); }; }
export function setNetworkStatus(connected: boolean): void {
  if (online !== connected) {
    online = connected;
    stateBus.update({ isOnline: connected, isDegraded: !connected });
    listeners.forEach(cb => cb(connected));
    if (connected) processOfflineQueue().catch(() => {});
  }
}
export function getNetworkStatus(): boolean { return online; }
