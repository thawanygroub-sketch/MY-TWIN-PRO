import type { ConsciousnessState, PresenceEmotion, PresenceState, ConsciousnessSource } from './PresenceTypes';
export type { ConsciousnessState, PresenceEmotion, PresenceState, ConsciousnessSource } from './PresenceTypes';
import { stateBus } from '../../src/core/StateBus';
type Listener = (state: PresenceState) => void;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (c: number, t: number, f: number) => lerp(c, t, 1 - Math.pow(1 - f, 2));
const rgb = (r: number, g: number, b: number) => ({ r, g, b });
const COLORS = { violet: rgb(171,116,255), blue: rgb(84,139,255), cyan: rgb(70,226,255), pink: rgb(255,130,220), orange: rgb(255,175,92), red: rgb(255,72,92), white: rgb(245,242,255) };
function emotionFromState(s: ConsciousnessState): PresenceEmotion {
  if (s.speaking && s.emotion > 0.25) return 'excited';
  if (s.emotion < -0.55 && s.arousal > 0.65) return 'angry';
  if (s.emotion < -0.45) return 'sad';
  if (s.arousal > 0.82 && s.curiosity > 0.7) return 'surprised';
  if (s.arousal > 0.7) return 'excited';
  if (s.curiosity > 0.72 && s.focus < 0.75) return 'curious';
  if (s.focus > 0.82) return 'focused';
  if (s.energy < 0.25) return 'sleepy';
  if (s.connection > 0.72 && s.emotion > 0.45) return 'caring';
  if (s.emotion > 0.45) return 'happy';
  return 'calm';
}
function mix(a: any, b: any, t: number) { return rgb(Math.round(lerp(a.r,b.r,t)), Math.round(lerp(a.g,b.g,t)), Math.round(lerp(a.b,b.b,t))); }
function palette(s: ConsciousnessState) {
  const positive = clamp01((s.emotion + 1) / 2);
  let a = mix(COLORS.blue, COLORS.violet, 0.55); let b = COLORS.cyan;
  if (positive > 0.58) { a = mix(COLORS.violet, COLORS.pink, (positive-0.58)/0.42); b = mix(COLORS.blue, COLORS.orange, s.arousal*0.65); }
  else if (positive < 0.38) { a = mix(COLORS.violet, COLORS.red, (0.38-positive)/0.38); b = mix(COLORS.blue, COLORS.violet, s.arousal); }
  return { a, b };
}
const projectState = (s: any): ConsciousnessState => ({
  energy: s.energy ?? 0.55, curiosity: s.curiosity ?? 0.45, emotion: s.emotionValence ?? 0.05, arousal: s.arousal ?? 0.35, focus: s.focus ?? 0.5,
  memory: s.memoryLevel ?? 0.2, trust: s.trust ?? 0.35, connection: s.connection ?? 0.3,
  listening: !!s.listening, speaking: !!s.speaking, thinking: !!s.thinking, userPresent: s.userPresent !== false,
  voiceLevel: s.voiceLevel ?? 0, ambientLight: s.ambientLight ?? 0.5, movement: s.movement ?? 0, proximity: s.proximity ?? 0.5, touch: s.touch ?? 0,
  gazeX: s.gazeX, gazeY: s.gazeY,
});
export class PresenceEngine {
  private current: PresenceState; private raw: ConsciousnessState;
  private listeners = new Set<Listener>(); private unsub: (() => void) | null = null;
  private timer: any = null; private startedAt = Date.now(); private prevEnergy = 0.55; private version = 0;
  constructor(bus?: ConsciousnessSource) {
    const src = bus ?? { getState: () => projectState(stateBus.getState()), subscribe: (fn: any) => stateBus.subscribe((s: any) => { fn(projectState(s)); }) };
    this.bus = src; this.raw = src.getState();
    this.current = { version:0, emotion:'calm', energy:0.55, fieldRadius:1, fieldOpacity:0.7, fieldSpeed:0.35, turbulence:0.18, orbitality:0.55,
      colorA:COLORS.violet, colorB:COLORS.cyan, eyeColor:COLORS.white, eyeOpenness:0.78, eyeGlow:0.8, pupilSize:0.42, gazeX:0, gazeY:0, blink:0, eyeTilt:0, eyeSeparation:1,
      breathing:0.4, pulse:0.4, attention:0.5, warmth:0.35, anticipation:0.25, listening:false, speaking:false, thinking:false, userPresent:true,
      voiceLevel:0, ambientLight:0.5, movement:0, proximity:0.5, touch:0, continuity:0.5, previousEnergy:0.55, deltaEnergy:0, ageMs:0 };
  }
  private bus: ConsciousnessSource;
  start(): void {
    if (this.timer) return;
    this.startedAt = Date.now();
    this.unsub = this.bus.subscribe((st) => { this.raw = st; });
    this.timer = setInterval(() => this.tick(), 50);
    this.tick();
  }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = null; this.unsub?.(); this.unsub = null; }
  /** توافُق: الإيقاع الحي يغذي الطاقة من LifeRhythmEngine (lazy لتجنب دورة استيراد) */
  applyLifeRhythm(): void {
    try {
      const { lifeRhythmEngine } = require('../life/LifeRhythmEngine');
      const r = lifeRhythmEngine?.getState?.();
      if (r) this.raw = { ...this.raw, energy: clamp01((r.energy ?? 0.5) * 0.6 + this.raw.energy * 0.4) };
    } catch {}
  }
  startPresenceLoop(): void { this.start(); }
  stopPresenceLoop(): void { this.stop(); }
  /** توافُق مع المستهلكين القدامى */
  setEmotion(emotion: string, intensity: number): void {
    const val = (emotion==='joy'||emotion==='love'||emotion==='excited'?1:(emotion==='sadness'||emotion==='fear'||emotion==='anger'?-1:0))*intensity;
    this.raw = { ...this.raw, emotion: val, arousal: Math.max(this.raw.arousal, intensity*0.7) };
  }
  addMicroExpression(_t: string, i: number): void { this.raw = { ...this.raw, touch: Math.max(this.raw.touch, i*0.6) }; }
  triggerMemoryEcho(_e?: string): void { this.raw = { ...this.raw, memory: 0.85 }; }
  translate(_intent: string): any { return this.getSnapshot(); }
  getState(): any { return this.getSnapshot(); }
  getSnapshot(): PresenceState { return { ...this.current }; }
  subscribe(l: Listener): () => void { this.listeners.add(l); l(this.getSnapshot()); return () => { this.listeners.delete(l); }; }
  private tick(): void {
    const s = this.raw; const old = this.current;
    const energy = clamp01(s.energy); const { a, b } = palette(s);
    const voice = clamp01(s.voiceLevel), proximity = clamp01(s.proximity), movement = clamp01(s.movement), touch = clamp01(s.touch);
    const attentionT = clamp01(s.focus*0.55 + s.curiosity*0.2 + proximity*0.15 + voice*0.1);
    const next: PresenceState = { ...old, version: ++this.version, emotion: emotionFromState(s),
      energy: smooth(old.energy, energy, 0.22),
      fieldRadius: smooth(old.fieldRadius, 0.88 + energy*0.34 + voice*0.12 + touch*0.08, 0.18),
      fieldOpacity: smooth(old.fieldOpacity, 0.42 + energy*0.52, 0.18),
      fieldSpeed: smooth(old.fieldSpeed, 0.22 + energy*0.7 + s.arousal*0.45 + voice*0.25, 0.18),
      turbulence: smooth(old.turbulence, 0.08 + s.arousal*0.35 + movement*0.18 + voice*0.18, 0.2),
      orbitality: smooth(old.orbitality, 0.35 + s.curiosity*0.35 + s.focus*0.25, 0.16),
      colorA: mix(old.colorA, a, 0.18), colorB: mix(old.colorB, b, 0.18), eyeColor: mix(old.eyeColor, COLORS.white, 0.2),
      eyeOpenness: smooth(old.eyeOpenness, clamp01(0.72 + attentionT*0.18 - (s.emotion<-0.35?0.12:0) - (energy<0.2?0.25:0)), 0.24),
      eyeGlow: smooth(old.eyeGlow, 0.58 + attentionT*0.38 + voice*0.08, 0.2),
      pupilSize: smooth(old.pupilSize, clamp01(0.3 + s.arousal*0.35 + s.curiosity*0.18 - s.ambientLight*0.1), 0.22),
      gazeX: smooth(old.gazeX, clamp01(Math.abs(s.gazeX??0)*0.5 + movement*0.05)*Math.sign(s.gazeX||0), 0.28),
      gazeY: smooth(old.gazeY, clamp01(Math.abs(s.gazeY??0)*0.5)*Math.sign(s.gazeY||0), 0.28),
      blink: 0,
      eyeTilt: smooth(old.eyeTilt, s.emotion<-0.4?-0.1:s.emotion>0.45?0.05:0, 0.18),
      eyeSeparation: smooth(old.eyeSeparation, 0.92 + s.curiosity*0.14 + s.arousal*0.04, 0.18),
      breathing: smooth(old.breathing, 0.25 + energy*0.65, 0.16),
      pulse: smooth(old.pulse, 0.2 + s.arousal*0.75 + voice*0.12, 0.2),
      attention: smooth(old.attention, attentionT, 0.22),
      warmth: smooth(old.warmth, 0.25 + s.connection*0.5 + Math.max(0,s.emotion)*0.25, 0.18),
      anticipation: smooth(old.anticipation, s.curiosity*0.55 + s.arousal*0.45, 0.18),
      listening: s.listening, speaking: s.speaking, thinking: s.thinking, userPresent: s.userPresent,
      voiceLevel: voice, ambientLight: clamp01(s.ambientLight), movement, proximity, touch,
      continuity: smooth(old.continuity, 0.4 + s.memory*0.25 + s.trust*0.2 + s.connection*0.15, 0.08),
      previousEnergy: this.prevEnergy, deltaEnergy: energy - this.prevEnergy, ageMs: Date.now() - this.startedAt };
    this.prevEnergy = energy; this.current = next;
    for (const l of this.listeners) { try { l(this.getSnapshot()); } catch {} }
  }
}
/** Singleton التطبيق — يستهلك StateBus الموحَّد مباشرة */
export const presenceEngine = new PresenceEngine();
