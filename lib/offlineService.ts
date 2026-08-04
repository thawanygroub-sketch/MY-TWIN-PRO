/** offlineService v2.1 — حضور لا يموت offline، أنواع سليمة، لا user_id في الأجسام. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiPost } from './httpClient';
import { stateBus } from '../src/core/StateBus';
import { LIVING_ERRORS } from './livingErrors';

const Q = 'mytwin_offline_queue', C = 'mytwin_response_cache', MAX = 100, RETRIES = 3;
interface Queued { id: string; message: string; timestamp: number; retries: number; lang?: string; }
type CacheMap = Record<string, { reply: string; timestamp: number }>;

export async function cacheResponse(q: string, reply: string): Promise<void> {
  try {
    const m = await map();
    m[hash(q)] = { reply, timestamp: Date.now() };
    const entries = Object.entries(m);
    if (entries.length > MAX) delete m[entries.sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0]];
    await AsyncStorage.setItem(C, JSON.stringify(m));
  } catch {}
}
export async function getCachedResponse(msg: string): Promise<string | null> {
  try {
    const e = (await map())[hash(msg)];
    return e && Date.now() - e.timestamp < 3600_000 ? e.reply : null;
  } catch { return null; }
}
async function map(): Promise<CacheMap> {
  try { const r = await AsyncStorage.getItem(C); return r ? (JSON.parse(r) as CacheMap) : {}; }
  catch { return {}; }
}
function hash(s: string): string {
  let h = 0; for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(36);
}
export async function getOfflineReply(msg: string): Promise<string> {
  return (await getCachedResponse(msg)) || LIVING_ERRORS.NETWORK;
}
export async function addToOfflineQueue(message: string, lang?: string): Promise<void> {
  try {
    const q = await getOfflineQueue();
    q.push({ id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, message, timestamp: Date.now(), retries: 0, lang });
    await AsyncStorage.setItem(Q, JSON.stringify(q));
  } catch {}
}
export async function getOfflineQueue(): Promise<Queued[]> {
  try { const r = await AsyncStorage.getItem(Q); return r ? (JSON.parse(r) as Queued[]) : []; }
  catch { return []; }
}
export async function processOfflineQueue(): Promise<number> {
  const q = await getOfflineQueue(); if (!q.length) return 0;
  let done = 0; const rest: Queued[] = [];
  for (const it of q) {
    try { await apiPost('/api/chat', { message: it.message, lang: it.lang || 'ar' }); done++; }
    catch { if (it.retries < RETRIES) rest.push({ ...it, retries: it.retries + 1 }); }
  }
  await AsyncStorage.setItem(Q, JSON.stringify(rest));
  return done;
}
type Cb = (o: boolean) => void;
const listeners: Cb[] = []; let online = true;
export function onNetworkChange(cb: Cb): () => void {
  listeners.push(cb);
  return () => { const i = listeners.indexOf(cb); if (i > -1) listeners.splice(i, 1); };
}
export function setNetworkStatus(c: boolean): void {
  if (online !== c) {
    online = c;
    stateBus.update({ isOnline: c, isDegraded: !c });
    listeners.forEach(cb => cb(c));
    if (c) processOfflineQueue().catch(() => {});
  }
}
export function getNetworkStatus(): boolean { return online; }
