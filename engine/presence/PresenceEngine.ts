import { stateBus } from '../../src/core/StateBus';
import { EventBus } from '../../src/core/EventBus';
import { lifeRhythmEngine } from '../life/LifeRhythmEngine';
import { audioMixer } from '../../src/core/AudioMixer';

export interface MicroExpression {
  type: 'core_tilt' | 'breath_variation' | 'gaze_shift' | 'tiny_pulse' | 'membrane_shiver' | 'particle_burst' | 'warmth_flicker' | 'head_nod' | 'head_shake';
  intensity: number;
  duration: number;
  timestamp: number;
}

export interface PresenceState {
  // الأساسية
  breathPhase: number;
  breathRate: number;
  focusLevel: number;
  energyLevel: number;
  warmth: number;
  emotion: string;
  emotionIntensity: number;
  silenceLevel: number;
  memoryEchoIntensity: number;
  intentIntensity: number;
  microExpressions: MicroExpression[];
  
  // البصرية
  eyeOpenness: number;
  pupilSize: number;
  gazeDirection: { x: number; y: number };
  gazeBehavior: string;
  eyeExpression: string;
  headTilt: number;
  blinkRate: number;
  
  // الغشاء
  membraneAmplitude: number;
  membraneSpeed: number;
  membranePoints: number;
  
  // الهالة
  auraSize: number;
  auraOpacity: number;
  auraColor: string;
  auraFlicker: number;
  auraLayers: number;
  
  // الموجات
  waveCount: number;
  waveSpeed: number;
  waveAmplitude: number;
  
  // الصوت واللمس
  breathSound: string | null;
  touchResponse: string;
  hapticIntensity: number;
  audioEffect: string | null;
  voiceTone: string;
}

export class PresenceEngine {
  private state: PresenceState;
  private animationFrame: number | null = null;

  constructor() {
    this.state = this.getDefaultState();
  }

  getDefaultState(): PresenceState {
    return {
      breathPhase: 0, breathRate: 4000, focusLevel: 0.5, energyLevel: 0.5, warmth: 0.5,
      emotion: 'neutral', emotionIntensity: 0.5, silenceLevel: 0,
      memoryEchoIntensity: 0, intentIntensity: 0, microExpressions: [],
      eyeOpenness: 1, pupilSize: 0.5,
      gazeDirection: { x: 0, y: 0 }, gazeBehavior: 'wander',
      eyeExpression: 'normal', headTilt: 0, blinkRate: 4,
      membraneAmplitude: 0.3, membraneSpeed: 1, membranePoints: 40,
      auraSize: 0.65, auraOpacity: 0.6, auraColor: '#8B5CF6',
      auraFlicker: 0.1, auraLayers: 3,
      waveCount: 3, waveSpeed: 1, waveAmplitude: 0.2,
      breathSound: null, touchResponse: 'none', hapticIntensity: 0,
      audioEffect: null, voiceTone: 'neutral',
    };
  }

  // الدوال الأساسية (للتوافق مع الملفات القديمة)
  startPresenceLoop(): void {
    this.animationFrame = requestAnimationFrame((t) => this.update(t));
    setInterval(() => this.applyLifeRhythm(), 30000);
  }
  stopPresenceLoop(): void { if (this.animationFrame) cancelAnimationFrame(this.animationFrame); }

  private update(timestamp: number): void {
    this.state.breathPhase = (Math.sin(timestamp / (this.state.breathRate / 1000)) + 1) / 2;
    stateBus.emit('presence:state_updated', this.state);
    this.animationFrame = requestAnimationFrame((t) => this.update(t));
  }

  applyLifeRhythm(): void {
    const rhythm = lifeRhythmEngine.getState();
    this.state.breathRate = rhythm.breathRate;
    this.state.energyLevel = rhythm.energy;
    this.state.warmth = rhythm.warmth;
  }

  setEmotion(emotion: string, intensity: number): void {
    this.state.emotion = emotion;
    this.state.emotionIntensity = intensity;
  }

  triggerMemoryEcho(emotion: string): void { this.state.memoryEchoIntensity = 1; }

  addMicroExpression(type: MicroExpression['type'], intensity: number): void {
    this.state.microExpressions.push({ type, intensity, duration: 1000, timestamp: Date.now() });
    if (type === 'head_nod') audioMixer.playEffect('comfort');
    else if (type === 'head_shake') audioMixer.playEffect('head_shake');
    else if (type === 'particle_burst') audioMixer.playEffect('surprise');
  }

  getState(): PresenceState { return { ...this.state }; }

  // الدالة الجديدة للاستخدام من ConsciousBeing
  translate(intent: string): PresenceState {
    const rhythm = lifeRhythmEngine.getState();
    const colors: Record<string, string[]> = {
      sleeping: ['#1a1a3e', '#2a2a5e', '#0d0d2b'],
      waking: ['#4a3a6e', '#6a5a8e', '#3a2a5e'],
      curious: ['#FCD34D', '#F59E0B', '#FBBF24'],
      focused: ['#06B6D4', '#0891B2', '#22D3EE'],
      playful: ['#F472B6', '#EC4899', '#FBCFE8'],
      calm: ['#8B5CF6', '#A855F7', '#C084FC'],
      concerned: ['#3B82F6', '#60A5FA', '#93C5FD'],
      excited: ['#10B981', '#059669', '#34D399'],
      reflective: ['#A78BFA', '#8B5CF6', '#C4B5FD'],
      overwhelmed: ['#EF4444', '#DC2626', '#F87171'],
      connected: ['#EC4899', '#DB2777', '#F472B6'],
      neutral: ['#8B5CF6', '#A855F7', '#C084FC'],
    };
    const eyeExprs: Record<string, string> = {
      sleeping: 'closed', waking: 'normal', curious: 'stars', focused: 'normal',
      playful: 'happy', calm: 'normal', concerned: 'sad', excited: 'surprised',
      reflective: 'normal', overwhelmed: 'x_eyes', connected: 'heart', neutral: 'normal',
    };
    const headTilts: Record<string, number> = {
      sleeping: 0, waking: -2, curious: 5, focused: 0, playful: 8, calm: -1,
      concerned: 3, excited: 6, reflective: -3, overwhelmed: -5, connected: 4, neutral: 0,
    };

    return {
      breathPhase: 0, breathRate: rhythm.breathRate, focusLevel: 0.5,
      energyLevel: rhythm.energy, warmth: rhythm.warmth,
      emotion: 'neutral', emotionIntensity: 0.5, silenceLevel: 0,
      memoryEchoIntensity: 0, intentIntensity: 0, microExpressions: [],
      eyeOpenness: 1, pupilSize: 0.5,
      gazeDirection: { x: 0, y: 0 }, gazeBehavior: 'wander',
      eyeExpression: eyeExprs[intent] || 'normal',
      headTilt: headTilts[intent] || 0, blinkRate: 4,
      membraneAmplitude: 0.3, membraneSpeed: 1, membranePoints: 40,
      auraSize: 0.65, auraOpacity: 0.6,
      auraColor: (colors[intent] || colors.neutral)[0],
      auraFlicker: 0.1, auraLayers: 3,
      waveCount: 3, waveSpeed: 1, waveAmplitude: 0.2,
      breathSound: null, touchResponse: 'none', hapticIntensity: 0,
      audioEffect: null, voiceTone: rhythm.voiceTone || 'neutral',
    };
  }
}

// ✅ نسخة عالمية — هذا هو المطلوب
export const presenceEngine = new PresenceEngine();
