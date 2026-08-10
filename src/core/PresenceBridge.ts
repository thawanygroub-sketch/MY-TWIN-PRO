import { EventBus } from './EventBus';
import { stateBus } from './StateBus';
import { devicePresenceEngine } from '../../engine/device/DevicePresenceEngine';
import { presenceEngine } from '../../engine/presence/PresenceEngine';
export { presenceEngine };
const clamp01 = (n: unknown, fallback = 0) => { const v = Number(n); return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback; };
class PresenceBridge {
  private sensorTimer: ReturnType<typeof setInterval> | null = null;
  private unsubs: Array<() => void> = [];
  start(): void {
    if (this.sensorTimer) return;
    presenceEngine.start();
    this.sensorTimer = setInterval(() => {
      const sensors = devicePresenceEngine.getSensors();
      const current = stateBus.getState();
      const acc = sensors.accelerometer;
      const magnitude = acc ? Math.sqrt(acc.x * acc.x + acc.y * acc.y + acc.z * acc.z) : 1;
      stateBus.patch({
        movement: clamp01(Math.abs(magnitude - 1) * 2.2),
        proximity: sensors.proximity == null ? current.proximity : clamp01(1 - sensors.proximity / 100, current.proximity),
        ambientLight: sensors.lightLevel == null ? current.ambientLight : clamp01(Math.log10(Math.max(1, sensors.lightLevel) + 1) / 4, current.ambientLight),
        userPresent: sensors.faceDetected || current.userPresent,
        voiceLevel: clamp01(sensors.audioLevel, current.voiceLevel),
      });
    }, 250);
    this.unsubs.push(EventBus.on('AI_START_THINKING', () => stateBus.patch({ thinking: true, focus: Math.max(stateBus.getState().focus, 0.72), arousal: Math.max(stateBus.getState().arousal, 0.48) })));
    this.unsubs.push(EventBus.on('AI_FINISH_THINKING', () => stateBus.patch({ thinking: false })));
    this.unsubs.push(EventBus.on('USER_SEND_MESSAGE', () => { stateBus.patch({ listening: true }); setTimeout(() => stateBus.patch({ listening: false }), 3000); }));
    this.unsubs.push(EventBus.on('MEMORY_SURFACED', (_ev: any, data?: any) => {
      const d = data ?? _ev;
      const emotion = String(d?.emotion ?? '');
      const bias = emotion.includes('sad') || emotion.includes('fear') ? -0.25 : emotion.includes('joy') || emotion.includes('love') ? 0.3 : 0.1;
      stateBus.patch({ memoryLevel: 0.85, curiosity: Math.max(stateBus.getState().curiosity, 0.62), emotionValence: bias });
    }));
    this.unsubs.push(EventBus.on('MEMORY_CREATED', () => stateBus.patch({ memoryLevel: Math.min(1, stateBus.getState().memoryLevel + 0.12) })));
  }
  touch(): void {
    stateBus.patch({ touch: 1, connection: Math.min(1, stateBus.getState().connection + 0.025) });
    presenceEngine.addMicroExpression('head_nod', 0.35);
    setTimeout(() => stateBus.patch({ touch: 0 }), 1200);
  }
  speak(durationMs = 4000): void { stateBus.patch({ speaking: true }); setTimeout(() => stateBus.patch({ speaking: false }), durationMs); }
  setGaze(x: number, y: number): void { stateBus.patch({ gazeX: Math.max(-1, Math.min(1, x)), gazeY: Math.max(-1, Math.min(1, y)) }); }
  stop(): void {
    if (this.sensorTimer) clearInterval(this.sensorTimer);
    this.sensorTimer = null;
    this.unsubs.forEach((u) => { try { u(); } catch {} });
    this.unsubs = [];
    presenceEngine.stop();
  }
}
export const presenceBridge = new PresenceBridge();
