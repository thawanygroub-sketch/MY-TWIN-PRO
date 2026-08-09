import { stateBus } from './StateBus';
import { EventBus } from './EventBus';
import { devicePresenceEngine } from '../../engine/device/DevicePresenceEngine';
import { PresenceEngine } from '../../engine/presence/PresenceEngine';
import type { ConsciousnessSource, ConsciousnessState } from '../../engine/presence/PresenceTypes';
const c01 = (n: number) => Math.max(0, Math.min(1, n));
const project = (s: any): ConsciousnessState => ({
  energy: s.energy ?? 0.55, curiosity: s.curiosity ?? 0.45, emotion: s.emotionValence ?? 0.05, arousal: s.arousal ?? 0.35, focus: s.focus ?? 0.5,
  memory: s.memoryLevel ?? 0.2, trust: s.trust ?? 0.35, connection: s.connection ?? 0.3,
  listening: !!s.listening, speaking: !!s.speaking, thinking: !!s.thinking, userPresent: s.userPresent !== false,
  voiceLevel: s.voiceLevel ?? 0, ambientLight: s.ambientLight ?? 0.5, movement: s.movement ?? 0, proximity: s.proximity ?? 0.5, touch: s.touch ?? 0,
  gazeX: s.gazeX, gazeY: s.gazeY,
});
export const consciousnessSource: ConsciousnessSource = {
  getState: () => project(stateBus.getState()),
  subscribe: (fn) => stateBus.subscribe((s) => { fn(project(s)); }),
};
export const presenceEngine = new PresenceEngine(consciousnessSource);
class PresenceBridge {
  private iv: any = null;
  start(): void {
    if (this.iv) return;
    presenceEngine.start();
    this.iv = setInterval(() => {
      const s = devicePresenceEngine.getSensors();
      const acc = s.accelerometer;
      const mag = acc ? Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z) : 1;
      stateBus.patch({
        movement: c01(Math.abs(mag - 1) * 2),
        proximity: s.proximity != null ? c01(1 - s.proximity / 100) : stateBus.getState().proximity,
        ambientLight: s.lightLevel != null ? c01(Math.log10(s.lightLevel + 1) / 4) : stateBus.getState().ambientLight,
        userPresent: s.faceDetected,
        voiceLevel: c01(s.audioLevel),
      });
    }, 500);
    EventBus.on('AI_START_THINKING', () => stateBus.patch({ thinking: true }));
    EventBus.on('AI_FINISH_THINKING', () => stateBus.patch({ thinking: false }));
    EventBus.on('USER_SEND_MESSAGE', () => { stateBus.patch({ listening: true }); setTimeout(() => stateBus.patch({ listening: false }), 3000); });
    EventBus.on('MEMORY_SURFACED', () => stateBus.patch({ memoryLevel: 0.85 }));
  }
  touch(): void { stateBus.pulseTouch(1, 1200); }
  speak(ms = 4000): void { stateBus.patch({ speaking: true }); setTimeout(() => stateBus.patch({ speaking: false }), ms); }
  stop(): void { if (this.iv) clearInterval(this.iv); this.iv = null; presenceEngine.stop(); }
}
export const presenceBridge = new PresenceBridge();
