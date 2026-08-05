import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { selfAwarenessEngine } from '../../engine/consciousness/SelfAwarenessEngine';
import { worldAwarenessEngine } from '../../engine/consciousness/WorldAwarenessEngine';
import { lifeStateEngine } from '../../engine/life/LifeStateEngine';
import { lifeRhythmEngine } from '../../engine/life/LifeRhythmEngine';
import { dreamEngine } from '../../engine/life/DreamEngine';
import { surpriseEngine } from '../../engine/life/SurpriseEngine';
import { presenceEngine } from '../../engine/presence/PresenceEngine';
import { sensorContextEngine } from '../../engine/sensor/SensorContextEngine';
import { stateBus } from './StateBus';
export class ExistenceLoop {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private slowIntervalId: ReturnType<typeof setInterval> | null = null;
  private verySlowIntervalId: ReturnType<typeof setInterval> | null = null;
  private appSub: { remove: () => void } | null = null;
  private running = false;
  async start(): Promise<void> {
    if (this.running) return; this.running = true;
    this.resume();
    lifeRhythmEngine.start();
    const f = await this.flags();
    if (f.dreams) dreamEngine.start();
    if (f.surprises) surpriseEngine.start();
    this.appSub = AppState.addEventListener('change', s => this.onApp(s));
    console.log('[ExistenceLoop] 🧬 The Twin is now alive (governed).');
  }
  stop(): void {
    this.pause();
    lifeRhythmEngine.stop(); dreamEngine.stop(); surpriseEngine.stop();
    this.appSub?.remove(); this.appSub = null; this.running = false;
    stateBus.update({ isOnline: false, interfaceState: 'dormant' });
  }
  private async flags(): Promise<{ dreams: boolean; surprises: boolean }> {
    try { const raw = await AsyncStorage.getItem('mytwin_feature_flags'); if (raw) return { dreams: true, surprises: true, ...JSON.parse(raw) }; } catch {}
    return { dreams: true, surprises: true };
  }
  private onApp(s: AppStateStatus): void {
    if (s === 'active') { if (!this.intervalId) this.resume(); }
    else this.pause();
  }
  private resume(): void {
    this.intervalId = setInterval(() => this.tick(), 1000);
    this.slowIntervalId = setInterval(() => this.slowTick(), 30000);
    this.verySlowIntervalId = setInterval(() => this.deepTick(), 300000);
  }
  private pause(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.slowIntervalId) clearInterval(this.slowIntervalId);
    if (this.verySlowIntervalId) clearInterval(this.verySlowIntervalId);
    this.intervalId = this.slowIntervalId = this.verySlowIntervalId = null;
  }
  private tick(): void { selfAwarenessEngine.evaluate(); lifeStateEngine.update(); presenceEngine.applyLifeRhythm(); }
  private slowTick(): void {
    worldAwarenessEngine.evaluate(); sensorContextEngine.evaluate();
    const r = Math.random();
    if (r < 0.3) stateBus.emit('micro:gaze_shift', { direction: 'wandering' });
    else if (r < 0.5) stateBus.emit('micro:breath_variation', {});
    else if (r < 0.6) stateBus.emit('micro:tiny_pulse', {});
    const self = selfAwarenessEngine.getState();
    if (self.curiosity > 0.7 && Math.random() < 0.4) stateBus.emit('curiosity:triggered', { thought: self.internalMonologue, timestamp: Date.now() });
    const rhythm = lifeRhythmEngine.getState();
    dreamEngine.setSleeping(rhythm.phase === 'deep_sleep' || rhythm.phase === 'dawn');
  }
  private deepTick(): void {
    selfAwarenessEngine.evaluate(); worldAwarenessEngine.evaluate();
    if (lifeRhythmEngine.getState().shouldRest) presenceEngine.setEmotion('calm', 0.2);
  }
}
export const existenceLoop = new ExistenceLoop();
