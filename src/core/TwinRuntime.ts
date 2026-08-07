import { StateBus, PresenceLevel, InterfaceState } from './StateBus';
import { EventBus } from './EventBus';
import { subscriptionService } from '../services/SubscriptionService';

export type RuntimeStatus = 'initializing' | 'running' | 'paused' | 'stopped' | 'degraded';

export interface TwinEngine {
  name: string;
  initialize: (runtime: TwinRuntime) => Promise<void>;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  getStatus: () => 'idle' | 'starting' | 'running' | 'paused' | 'stopped' | 'error';
}

export interface RuntimeConfig {
  enableBreathing: boolean;
  enableMicroPresence: boolean;
  enableDebugLogging: boolean;
  breathCycleDuration: number;
  autoStart: boolean;
}

const DEFAULT_CONFIG: RuntimeConfig = {
  enableBreathing: true,
  enableMicroPresence: true,
  enableDebugLogging: false,
  breathCycleDuration: 6000,
  autoStart: true,
};

export class TwinRuntime {
  private config: RuntimeConfig;
  private status: RuntimeStatus = 'initializing';
  private engines: Map<string, TwinEngine> = new Map();
  private breathAnimationId: number | null = null;
  private breathStartTime: number = 0;
  private uptimeStart: number = 0;
  private pauseTime: number = 0;
  private totalPausedDuration: number = 0;
  private uptimeIntervalId: ReturnType<typeof setInterval> | null = null;
  private lastBreathEmit: number = 0;
  

  constructor(config: Partial<RuntimeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async start(userId?: string): Promise<void> {
    if (this.status === 'running') return;
    this.uptimeStart = Date.now();
    if (userId) {
      subscriptionService.initialize(userId).catch(() => {});
    }
    this.status = 'running';
    StateBus.update({ presenceLevel: 1, interfaceState: 'aware', isOnline: true });
    if (this.config.enableBreathing) this.startBreathing();
    for (const [, engine] of this.engines) {
      try { engine.start(); } catch (e) {}
    }
    this.startUptimeTracking();
    EventBus.emit('APP_FOREGROUND', { timestamp: Date.now() });
  }

  pause(): void {
    if (this.status !== 'running') return;
    this.status = 'paused';
    this.pauseTime = Date.now();
    this.stopBreathing();
    for (const [, engine] of this.engines) engine.pause();
    StateBus.update({ presenceLevel: 0, interfaceState: 'dormant' });
    EventBus.emit('APP_BACKGROUND', { timestamp: Date.now() });
  }

  resume(): void {
    if (this.status !== 'paused') return;
    this.status = 'running';
    if (this.pauseTime > 0) { this.totalPausedDuration += Date.now() - this.pauseTime; this.pauseTime = 0; }
    if (this.config.enableBreathing) this.startBreathing();
    for (const [, engine] of this.engines) engine.resume();
    StateBus.update({ presenceLevel: 1, interfaceState: 'aware' });
    EventBus.emit('APP_FOREGROUND', { timestamp: Date.now() });
  }

  stop(): void {
    this.status = 'stopped';
    this.stopBreathing();
    this.stopUptimeTracking();
    for (const [, engine] of this.engines) engine.stop();
    StateBus.reset();
  }

  async registerEngine(engine: TwinEngine): Promise<void> {
    if (this.engines.has(engine.name)) return;
    this.engines.set(engine.name, engine);
    try { await engine.initialize(this); } catch (e) { this.engines.delete(engine.name); }
  }

  getEngine<T extends TwinEngine>(name: string): T | undefined {
    return this.engines.get(name) as T | undefined;
  }

  setPresence(level: PresenceLevel, trigger: string = 'manual'): void {
    const currentLevel = StateBus.select(s => s.presenceLevel);
    if (currentLevel === level) return;
    const interfaceState = this.mapPresenceToState(level);
    StateBus.update({ presenceLevel: level, interfaceState });
    EventBus.emit('PRESENCE_CHANGED', { from: currentLevel, to: level, trigger });
  }

  getUptime(): number {
    if (this.status === 'running') return Date.now() - this.uptimeStart - this.totalPausedDuration;
    return 0;
  }

  getStatus(): RuntimeStatus { return this.status; }
  getConfig(): Readonly<RuntimeConfig> { return this.config; }
  isRunning(): boolean { return this.status === 'running'; }

  private startBreathing(): void {
    if (this.breathAnimationId !== null) return;
    this.breathStartTime = Date.now();
    const tick = () => {
      if (this.status !== 'running') { this.breathAnimationId = null; return; }
      const elapsed = Date.now() - this.breathStartTime;
      const duration = this.getCurrentBreathDuration();
      const rawPhase = (elapsed % duration) / duration;
      const phase = Math.sin(rawPhase * Math.PI * 2) * 0.5 + 0.5;
      const isHolding = phase > 0.95 || phase < 0.05;
      // 🟢 throttle: تحديث StateBus كل 100ms بدل كل إطار
      if (elapsed - this.lastBreathEmit >= 100) {
        this.lastBreathEmit = elapsed;
        StateBus.update({ breath: { phase, duration, intensity: this.getCurrentBreathIntensity(), isHolding }, uptime: this.getUptime() });
      }
      this.breathAnimationId = requestAnimationFrame(tick);
    };
    this.breathAnimationId = requestAnimationFrame(tick);
  }

  private stopBreathing(): void {
    if (this.breathAnimationId !== null) { cancelAnimationFrame(this.breathAnimationId); this.breathAnimationId = null; }
  }

  private getCurrentBreathDuration(): number {
    const presenceLevel = StateBus.select(s => s.presenceLevel);
    const durationMap: Record<number, number> = { 0: 9600, 1: 8400, 2: 7200, 3: 5400, 4: 4800, 5: 5100, 6: 6600, 7: 6000, 8: 4800, 9: 4200 };
    return durationMap[presenceLevel] ?? this.config.breathCycleDuration;
  }

  private getCurrentBreathIntensity(): number {
    const presenceLevel = StateBus.select(s => s.presenceLevel);
    const intensityMap: Record<number, number> = { 0: 0.15, 1: 0.25, 2: 0.40, 3: 0.50, 4: 0.60, 5: 0.70, 6: 0.45, 7: 0.40, 8: 0.55, 9: 0.85 };
    return intensityMap[presenceLevel] ?? 0.25;
  }

  private mapPresenceToState(level: PresenceLevel): InterfaceState {
    const map: Record<number, InterfaceState> = { 0: 'dormant', 1: 'aware', 2: 'attentive', 3: 'thinking', 4: 'speaking', 5: 'remembering', 6: 'reflecting', 7: 'proactive', 8: 'proactive', 9: 'twin' };
    return map[level] ?? 'aware';
  }

  private startUptimeTracking(): void {
    if (this.uptimeIntervalId !== null) return;
    this.uptimeIntervalId = setInterval(() => { if (this.status === 'running') StateBus.update({ uptime: this.getUptime() }); }, 1000);
  }

  private stopUptimeTracking(): void {
    if (this.uptimeIntervalId !== null) { clearInterval(this.uptimeIntervalId); this.uptimeIntervalId = null; }
  }
}

export const runtime = new TwinRuntime();
