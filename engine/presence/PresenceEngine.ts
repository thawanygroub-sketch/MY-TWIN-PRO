import { stateBus } from '../../src/core/StateBus';
import { lifeRhythmEngine } from '../life/LifeRhythmEngine';
import { audioMixer } from '../../src/core/AudioMixer';
export interface MicroExpression {
  type: 'core_tilt' | 'breath_variation' | 'gaze_shift' | 'tiny_pulse' | 'membrane_shiver' | 'particle_burst' | 'warmth_flicker' | 'head_nod' | 'head_shake';
  intensity: number; duration: number; timestamp: number;
}
export interface PresenceState {
  breathPhase: number; breathRate: number; focusLevel: number; energyLevel: number; warmth: number;
  emotion: string; emotionIntensity: number; silenceLevel: number; memoryEchoIntensity: number; intentIntensity: number;
  microExpressions: MicroExpression[];
  eyeOpenness: number; pupilSize: number; gazeDirection: { x: number; y: number }; gazeBehavior: string;
  eyeExpression: string; headTilt: number; blinkRate: number;
  membraneAmplitude: number; membraneSpeed: number; membranePoints: number;
  auraSize: number; auraOpacity: number; auraColor: string; auraFlicker: number; auraLayers: number;
  waveCount: number; waveSpeed: number; waveAmplitude: number;
  breathSound: string | null; touchResponse: string; hapticIntensity: number;
  audioEffect: string | null; voiceTone: string;
}
export class PresenceEngine {
  private state: PresenceState;
  private animationFrame: number | null = null;
  private lastFrameTime = 0;
  private readonly FRAME_INTERVAL = 1000 / 30;
  private lastEmitTime = 0;
  private readonly EMIT_INTERVAL = 120;
  private lastSound: { name: string; at: number } = { name: '', at: 0 };
  constructor() { this.state = this.getDefaultState(); }
  getDefaultState(): PresenceState {
    return {
      breathPhase: 0, breathRate: 4000, focusLevel: 0.5, energyLevel: 0.5, warmth: 0.5,
      emotion: 'neutral', emotionIntensity: 0.5, silenceLevel: 0, memoryEchoIntensity: 0, intentIntensity: 0,
      microExpressions: [], eyeOpenness: 1, pupilSize: 0.5, gazeDirection: { x: 0, y: 0 }, gazeBehavior: 'wander',
      eyeExpression: 'normal', headTilt: 0, blinkRate: 4,
      membraneAmplitude: 0.3, membraneSpeed: 1, membranePoints: 40,
      auraSize: 0.65, auraOpacity: 0.6, auraColor: '#8B5CF6', auraFlicker: 0.1, auraLayers: 3,
      waveCount: 3, waveSpeed: 1, waveAmplitude: 0.2,
      breathSound: null, touchResponse: 'none', hapticIntensity: 0, audioEffect: null, voiceTone: 'neutral',
    };
  }
  startPresenceLoop(): void {
    setTimeout(() => {
      this.animationFrame = requestAnimationFrame((t) => this.update(t));
      setInterval(() => this.applyLifeRhythm(), 30000);
    }, 600);
  }
  stopPresenceLoop(): void { if (this.animationFrame) cancelAnimationFrame(this.animationFrame); }
  private update(timestamp: number): void {
    if (timestamp - this.lastFrameTime < this.FRAME_INTERVAL) {
      this.animationFrame = requestAnimationFrame((t) => this.update(t)); return;
    }
    this.lastFrameTime = timestamp;
    this.state.breathPhase = (Math.sin(timestamp / (this.state.breathRate / 1000)) + 1) / 2;
    if (timestamp - this.lastEmitTime >= this.EMIT_INTERVAL) {
      this.lastEmitTime = timestamp;
      stateBus.emit('presence:state_updated', this.state);
    }
    this.animationFrame = requestAnimationFrame((t) => this.update(t));
  }
  applyLifeRhythm(): void {
    const r = lifeRhythmEngine.getState();
    this.state.breathRate = r.breathRate; this.state.energyLevel = r.energy; this.state.warmth = r.warmth;
  }
  setEmotion(emotion: string, intensity: number): void { this.state.emotion = emotion; this.state.emotionIntensity = intensity; }
  triggerMemoryEcho(_emotion?: string): void { this.state.memoryEchoIntensity = 1; setTimeout(() => { this.state.memoryEchoIntensity = 0; }, 2000); }
  addMicroExpression(type: MicroExpression['type'], intensity: number): void {
    this.state.microExpressions.push({ type, intensity, duration: 1000, timestamp: Date.now() });
    if (this.state.microExpressions.length > 5) this.state.microExpressions = this.state.microExpressions.slice(-5);
    const soundMap: Partial<Record<MicroExpression['type'], string>> = { head_nod: 'comfort', head_shake: 'head_shake', particle_burst: 'surprise', membrane_shiver: 'comfort' };
    const name = soundMap[type]; const now = Date.now();
    if (name && (this.lastSound.name !== name || now - this.lastSound.at > 1500)) {
      audioMixer.playEffect(name as any); this.lastSound = { name, at: now };
    }
  }
  getState(): PresenceState { return { ...this.state }; }
  translate(intent: string): PresenceState {
    const r = lifeRhythmEngine.getState();
    const colors: Record<string, string> = { sleeping: '#1a1a3e', waking: '#4a3a6e', curious: '#FCD34D', focused: '#06B6D4', playful: '#F472B6', calm: '#8B5CF6', concerned: '#3B82F6', excited: '#10B981', reflective: '#A78BFA', overwhelmed: '#EF4444', connected: '#EC4899', neutral: '#8B5CF6' };
    const eyes: Record<string, string> = { sleeping: 'closed', curious: 'stars', playful: 'happy', concerned: 'sad', excited: 'surprised', overwhelmed: 'x_eyes', connected: 'heart' };
    const tilts: Record<string, number> = { waking: -2, curious: 5, playful: 8, calm: -1, concerned: 3, excited: 6, reflective: -3, overwhelmed: -5, connected: 4 };
    return { ...this.getDefaultState(), breathRate: r.breathRate, energyLevel: r.energy, warmth: r.warmth,
      eyeExpression: eyes[intent] || 'normal', headTilt: tilts[intent] || 0, auraColor: colors[intent] || colors.neutral, voiceTone: r.voiceTone || 'neutral' };
  }
}
export const presenceEngine = new PresenceEngine();
