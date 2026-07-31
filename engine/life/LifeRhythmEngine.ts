import { stateBus } from '../../src/core/StateBus';
import { presenceEngine } from '../presence/PresenceEngine';
import { devicePresenceEngine } from '../device/DevicePresenceEngine';

export type LifePhase = 'deep_sleep' | 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night' | 'late_night';

export interface LifeRhythmState {
  phase: LifePhase;
  energy: number;
  warmth: number;
  breathRate: number;
  heartRate: number;
  ambientColor: string;
  voiceTone: 'whisper' | 'soft' | 'warm' | 'neutral' | 'enthusiastic';
  speedMultiplier: number;
  shouldRest: boolean;
  isDeepSleep: boolean;
  greeting: string;
}

export class LifeRhythmEngine {
  private state: LifeRhythmState;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastUserInteraction: number = Date.now();
  private usedGreetings: Set<string> = new Set();

  constructor() {
    this.state = this.calculateState();
  }

  start(): void { this.intervalId = setInterval(() => this.update(), 30000); }
  stop(): void { if (this.intervalId) clearInterval(this.intervalId); }
  recordInteraction(): void { this.lastUserInteraction = Date.now(); }

  private update(): void {
    this.state = this.calculateState();
    presenceEngine.setEmotion('neutral', this.state.energy);
    stateBus.emit('life:rhythm_changed', this.state);
  }

  private calculateState(): LifeRhythmState {
    const hour = new Date().getHours();
    const sensors = devicePresenceEngine.getSensors();
    const weather = sensors.weatherCondition || 'clear';
    const isRainy = weather === 'rain' || weather === 'storm';
    const batteryLow = sensors.isBatteryLow;
    const stepCount = sensors.stepCount;

    let phase: LifePhase; let energy: number; let warmth: number; let breathRate: number;
    let heartRate: number; let ambientColor: string; let voiceTone: any; let speedMultiplier: number;
    let shouldRest: boolean; let isDeepSleep = false; let greeting = '';

    if (hour >= 2 && hour < 4) {
      phase = 'deep_sleep';
      energy = 0.05; warmth = 0.05; breathRate = 12000; heartRate = 40;
      ambientColor = '#000010'; voiceTone = 'whisper'; speedMultiplier = 0.1;
      shouldRest = true; isDeepSleep = true; greeting = '';
    } else if (hour < 6) {
      phase = 'deep_sleep';
      energy = 0.1; warmth = 0.1; breathRate = 10000; heartRate = 45;
      ambientColor = '#000015'; voiceTone = 'whisper'; speedMultiplier = 0.2;
      shouldRest = true; isDeepSleep = true; greeting = '';
    } else if (hour < 9) {
      phase = 'morning'; energy = 0.7; warmth = 0.7; breathRate = 3500; heartRate = 68;
      ambientColor = '#2A1050'; voiceTone = 'warm'; speedMultiplier = 0.8;
      shouldRest = false; greeting = this.getUniqueGreeting(['صباح النور', 'يوم جديد معك', 'هل أنت مستعد؟']);
    } else if (hour < 18) {
      phase = 'afternoon'; energy = 0.8; warmth = 0.8; breathRate = 3000; heartRate = 72;
      ambientColor = '#3A2060'; voiceTone = 'neutral'; speedMultiplier = 1.0;
      shouldRest = false;
    } else if (hour < 22) {
      phase = 'evening'; energy = 0.6; warmth = 0.7; breathRate = 4000; heartRate = 68;
      ambientColor = '#2A1050'; voiceTone = 'warm'; speedMultiplier = 0.9;
      shouldRest = false; greeting = this.getUniqueGreeting(['مساء الخير... أتمنى أن يكون يومك جيداً.']);
    } else {
      phase = 'night'; energy = 0.4; warmth = 0.5; breathRate = 5000; heartRate = 62;
      ambientColor = '#150030'; voiceTone = 'soft'; speedMultiplier = 0.7;
      shouldRest = false; greeting = this.getUniqueGreeting(['الليل هادئ... هل تريد التحدث؟']);
    }

    if (isRainy) { warmth -= 0.1; energy -= 0.1; voiceTone = 'soft'; }
    if (batteryLow) { energy *= 0.7; voiceTone = 'soft'; }

    return { phase, energy, warmth, breathRate, heartRate, ambientColor, voiceTone, speedMultiplier, shouldRest, isDeepSleep, greeting };
  }

  private getUniqueGreeting(options: string[]): string {
    const available = options.filter(g => !this.usedGreetings.has(g));
    if (available.length === 0) { this.usedGreetings.clear(); return options[0]; }
    const chosen = available[Math.floor(Math.random() * available.length)];
    this.usedGreetings.add(chosen);
    return chosen;
  }

  getState(): LifeRhythmState { return { ...this.state }; }
}

export const lifeRhythmEngine = new LifeRhythmEngine();
