import type { ConsciousnessSource, ConsciousnessState, PresenceEmotion, PresenceState, RGB } from './PresenceTypes';
import { stateBus } from '../../src/core/StateBus';
type Listener = (state: PresenceState) => void;
const clamp01 = (n: number, fb = 0) => { const v = Number.isFinite(n) ? n : fb; return Math.max(0, Math.min(1, v)); };
const signed = (n: number) => Math.max(-1, Math.min(1, Number.isFinite(n) ? n : 0));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (c: number, t: number, f: number) => lerp(c, t, 1 - Math.pow(1 - clamp01(f), 2));
const rgb = (r: number, g: number, b: number): RGB => ({ r, g, b });
const COLORS = { violet: rgb(171, 116, 255), violetDeep: rgb(104, 62, 214), blue: rgb(84, 139, 255), cyan: rgb(70, 226, 255), pink: rgb(255, 130, 220), orange: rgb(255, 175, 92), red: rgb(255, 72, 92), white: rgb(245, 242, 255) };
const normalizeEmotion = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0; };
function emotionFromState(s: ConsciousnessState): PresenceEmotion {
  const emotion = normalizeEmotion(s.emotion);
  const energy = clamp01(s.energy); const arousal = clamp01(s.arousal);
  const curiosity = clamp01(s.curiosity); const focus = clamp01(s.focus); const connection = clamp01(s.connection);
  if (s.speaking && arousal > 0.48) return 'excited';
  if (emotion < -0.58 && arousal > 0.62) return 'angry';
  if (emotion < -0.42 && arousal < 0.55) return 'sad';
  if (arousal > 0.82 && curiosity > 0.68) return 'surprised';
  if (arousal > 0.72) return 'excited';
  if (curiosity > 0.74 && focus < 0.78) return 'curious';
  if (focus > 0.84) return 'focused';
  if (energy < 0.22) return 'sleepy';
  if (connection > 0.72 && emotion > 0.42) return 'caring';
  if (emotion > 0.42) return 'happy';
  return 'calm';
}
function mix(a: RGB, b: RGB, t: number): RGB { const k = clamp01(t); return rgb(Math.round(lerp(a.r, b.r, k)), Math.round(lerp(a.g, b.g, k)), Math.round(lerp(a.b, b.b, k))); }
function palette(s: ConsciousnessState): { a: RGB; b: RGB; eye: RGB } {
  const emotion = normalizeEmotion(s.emotion);
  const positive = clamp01((emotion + 1) / 2);
  const arousal = clamp01(s.arousal); const connection = clamp01(s.connection);
  let a = mix(COLORS.blue, COLORS.violet, 0.62); let b = COLORS.cyan;
  if (positive > 0.60) { a = mix(COLORS.violet, COLORS.pink, (positive - 0.60) / 0.40); b = mix(COLORS.blue, COLORS.orange, arousal * 0.62); }
  else if (positive < 0.38) { a = mix(COLORS.violetDeep, COLORS.red, (0.38 - positive) / 0.38); b = mix(COLORS.blue, COLORS.violetDeep, arousal); }
  const eye = connection > 0.72 ? mix(COLORS.white, COLORS.pink, connection * 0.28) : COLORS.white;
  return { a, b, eye };
}
const anticipationValue = (curiosity: number, arousal: number) => clamp01(curiosity * 0.6 + arousal * 0.4);
const createInitial = (): PresenceState => ({
  version: 0, emotion: 'calm', energy: 0.55, fieldRadius: 1, fieldOpacity: 0.7, fieldSpeed: 0.35, turbulence: 0.18, orbitality: 0.55,
  colorA: COLORS.violet, colorB: COLORS.cyan, eyeColor: COLORS.white,
  eyeOpenness: 0.8, eyeGlow: 0.82, pupilSize: 0.42, gazeX: 0, gazeY: 0, blink: 0, eyeTilt: 0, eyeSeparation: 1,
  breathing: 0.4, pulse: 0.4, attention: 0.5, warmth: 0.35, anticipation: 0.25,
  listening: false, speaking: false, thinking: false, userPresent: true,
  voiceLevel: 0, ambientLight: 0.5, movement: 0, proximity: 0.5, touch: 0,
  continuity: 0.5, previousEnergy: 0.55, deltaEnergy: 0, ageMs: 0,
});
export class PresenceEngine {
  private current = createInitial();
  private raw: ConsciousnessState;
  private listeners = new Set<Listener>();
  private sourceUnsubscribe: (() => void) | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private startedAt = Date.now();
  private previousEnergy = 0.55;
  private version = 0;
  private expression = { smile: 0, concern: 0, nod: 0, shiver: 0, memoryEcho: 0 };
  constructor(private readonly source: ConsciousnessSource) { this.raw = source.getState(); }
  start(): void {
    if (this.timer) return;
    this.startedAt = Date.now();
    this.sourceUnsubscribe = this.source.subscribe((state) => { this.raw = state; });
    this.timer = setInterval(() => this.tick(), 50);
    this.tick();
  }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; this.sourceUnsubscribe?.(); this.sourceUnsubscribe = null; }
  startPresenceLoop(): void { this.start(); }
  stopPresenceLoop(): void { this.stop(); }
  getSnapshot(): PresenceState { return { ...this.current }; }
  getState(): PresenceState & { [k: string]: any } { return { ...this.current }; }
  subscribe(listener: Listener): () => void { this.listeners.add(listener); listener(this.getSnapshot()); return () => { this.listeners.delete(listener); }; }
  setEmotion(emotion: string, intensity = 0.5): void {
    const map: Record<string, number> = { joy: 0.75, happy: 0.7, love: 0.8, caring: 0.68, excitement: 0.72, excited: 0.72, calm: 0.05, neutral: 0, sadness: -0.62, sad: -0.62, fear: -0.52, afraid: -0.52, anger: -0.75, angry: -0.75, surprise: 0.25, surprised: 0.25, curiosity: 0.35, curious: 0.35 };
    const base = map[String(emotion).toLowerCase()] ?? 0;
    const strength = clamp01(intensity);
    this.expression.smile = Math.max(this.expression.smile, base > 0.35 ? strength : 0);
    this.expression.concern = Math.max(this.expression.concern, base < -0.35 ? strength : 0);
    this.raw = { ...this.raw, emotion: base * strength };
  }
  triggerMemoryEcho(_e?: string): void { this.expression.memoryEcho = 1; }
  addMicroExpression(type: string, intensity = 1): void {
    const amount = clamp01(intensity);
    if (type === 'head_nod') this.expression.nod = Math.max(this.expression.nod, amount);
    if (type === 'membrane_shiver') this.expression.shiver = Math.max(this.expression.shiver, amount);
  }
  applyLifeRhythm(): void {
    try {
      const { lifeRhythmEngine } = require('../life/LifeRhythmEngine');
      const r = lifeRhythmEngine?.getState?.();
      if (r) this.raw = { ...this.raw, energy: clamp01((r.energy ?? 0.5) * 0.6 + this.raw.energy * 0.4) };
    } catch {}
  }
  private decayExpressions(): void { const d = 0.88; this.expression.smile *= d; this.expression.concern *= d; this.expression.nod *= d; this.expression.shiver *= d; this.expression.memoryEcho *= 0.9; }
  private tick(): void {
    const s = this.raw;
    const { a, b, eye } = palette(s);
    const energy = clamp01(s.energy); const curiosity = clamp01(s.curiosity); const arousal = clamp01(s.arousal);
    const focus = clamp01(s.focus); const voice = clamp01(s.voiceLevel); const movement = clamp01(s.movement);
    const proximity = clamp01(s.proximity); const touch = clamp01(s.touch); const connection = clamp01(s.connection);
    const emotion = normalizeEmotion(s.emotion);
    const attentionTarget = clamp01(focus * 0.55 + curiosity * 0.2 + proximity * 0.15 + voice * 0.1);
    const emotionBoost = Math.max(0, emotion) * 0.16;
    const concern = Math.max(this.expression.concern, Math.max(0, -emotion) * 0.18);
    const warmthTarget = clamp01(0.18 + connection * 0.48 + Math.max(0, emotion) * 0.22 + this.expression.smile * 0.18);
    const next: PresenceState = {
      ...this.current, version: ++this.version, emotion: emotionFromState(s),
      energy: smooth(this.current.energy, energy, 0.28),
      fieldRadius: smooth(this.current.fieldRadius, 0.9 + energy * 0.36 + voice * 0.1 + touch * 0.08 + this.expression.memoryEcho * 0.05, 0.2),
      fieldOpacity: smooth(this.current.fieldOpacity, clamp01(0.4 + energy * 0.48 + this.expression.memoryEcho * 0.1), 0.2),
      fieldSpeed: smooth(this.current.fieldSpeed, 0.2 + energy * 0.64 + arousal * 0.46 + voice * 0.22 + curiosity * 0.12, 0.2),
      turbulence: smooth(this.current.turbulence, clamp01(0.06 + arousal * 0.34 + movement * 0.18 + voice * 0.18 + this.expression.shiver * 0.24), 0.22),
      orbitality: smooth(this.current.orbitality, clamp01(0.32 + curiosity * 0.34 + focus * 0.22 + anticipationValue(curiosity, arousal) * 0.12), 0.18),
      colorA: mix(this.current.colorA, a, 0.2), colorB: mix(this.current.colorB, b, 0.2), eyeColor: mix(this.current.eyeColor, eye, 0.24),
      eyeOpenness: smooth(this.current.eyeOpenness, clamp01(0.66 + attentionTarget * 0.22 + (emotion > 0.45 ? 0.06 : 0) - (emotion < -0.35 ? 0.08 : 0) - (energy < 0.2 ? 0.22 : 0) + (s.speaking ? 0.04 : 0)), 0.26),
      eyeGlow: smooth(this.current.eyeGlow, clamp01(0.56 + attentionTarget * 0.34 + voice * 0.1 + warmthTarget * 0.08), 0.24),
      pupilSize: smooth(this.current.pupilSize, clamp01(0.26 + arousal * 0.4 + curiosity * 0.2 - s.ambientLight * 0.1), 0.24),
      gazeX: smooth(this.current.gazeX, signed(s.gazeX ?? 0), 0.3),
      gazeY: smooth(this.current.gazeY, signed(s.gazeY ?? 0), 0.3),
      blink: 0,
      eyeTilt: smooth(this.current.eyeTilt, clamp01(0.5 + (emotion > 0.45 ? 0.12 : 0) + (emotion < -0.45 ? -0.18 : 0)) - 0.5, 0.24),
      eyeSeparation: smooth(this.current.eyeSeparation, 0.92 + curiosity * 0.13 + arousal * 0.04, 0.18),
      breathing: smooth(this.current.breathing, clamp01(0.22 + energy * 0.64 + warmthTarget * 0.08), 0.18),
      pulse: smooth(this.current.pulse, clamp01(0.16 + arousal * 0.72 + voice * 0.1 + touch * 0.12), 0.22),
      attention: smooth(this.current.attention, attentionTarget, 0.24),
      warmth: smooth(this.current.warmth, warmthTarget, 0.2),
      anticipation: smooth(this.current.anticipation, clamp01(curiosity * 0.55 + arousal * 0.45 + emotionBoost), 0.2),
      listening: !!s.listening, speaking: !!s.speaking, thinking: !!s.thinking, userPresent: s.userPresent !== false,
      voiceLevel: voice, ambientLight: clamp01(s.ambientLight), movement, proximity, touch,
      continuity: smooth(this.current.continuity, clamp01(0.34 + s.memory * 0.26 + s.trust * 0.2 + connection * 0.2), 0.1),
      previousEnergy: this.previousEnergy, deltaEnergy: energy - this.previousEnergy, ageMs: Date.now() - this.startedAt,
    };
    next.turbulence = clamp01(next.turbulence + concern * 0.06);
    this.previousEnergy = energy;
    this.current = next;
    this.decayExpressions();
    const snapshot = this.getSnapshot();
    for (const l of this.listeners) { try { l(snapshot); } catch {} }
  }
}
const projectBus = (raw: any): ConsciousnessState => ({
  energy: clamp01(raw.energy ?? raw.consciousness?.energy, 0.5),
  curiosity: clamp01(raw.curiosity ?? raw.consciousness?.curiosity, 0.5),
  emotion: normalizeEmotion(raw.emotionValence),
  arousal: clamp01(raw.arousal, 0.35),
  focus: clamp01(raw.focus ?? raw.consciousness?.attention, 0.5),
  memory: clamp01(raw.memoryLevel ?? raw.consciousness?.memoryEcho, 0.2),
  trust: clamp01(raw.trust ?? raw.relationship?.trustScore, 0.35),
  connection: clamp01(raw.connection ?? (raw.relationship?.bondLevel > 1 ? raw.relationship.bondLevel / 100 : raw.relationship?.bondLevel), 0.3),
  listening: !!raw.listening, speaking: !!raw.speaking, thinking: !!raw.thinking, userPresent: raw.userPresent !== false,
  voiceLevel: clamp01(raw.voiceLevel, 0), ambientLight: clamp01(raw.ambientLight, 0.5),
  movement: clamp01(raw.movement, 0), proximity: clamp01(raw.proximity, 0.5), touch: clamp01(raw.touch, 0),
  gazeX: Number(raw.gazeX) || 0, gazeY: Number(raw.gazeY) || 0,
});
/** Singleton واحد لكل التطبيق — استمرارية كاملة عبر الشاشات */
export const presenceEngine = new PresenceEngine({
  getState: () => projectBus(stateBus.getState()),
  subscribe: (fn) => stateBus.subscribe((s) => fn(projectBus(s))),
});
