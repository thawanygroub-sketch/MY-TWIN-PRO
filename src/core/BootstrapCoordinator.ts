import * as Notifications from 'expo-notifications';
import { authService } from '../services/authService';
import { stateBus } from './StateBus';
import { unifiedBrainBridge } from './UnifiedBrainBridge';
import { presenceEngine } from '../../engine/presence/PresenceEngine';
import { lifeRhythmEngine } from '../../engine/life/LifeRhythmEngine';
import { sensorBridge } from './SensorBridge';
import { runtime } from './TwinRuntime';
import { createCoordinator, RuntimeCoordinator } from './RuntimeCoordinator';
import { syncInitialTheme } from '../../engine/colors';
import { EventBus } from './EventBus';
import { apiPost, apiPut } from '../../lib/httpClient';
export class BootstrapCoordinator {
  private userId = '';
  private coordinator: RuntimeCoordinator | null = null;
  private snapIv: ReturnType<typeof setInterval> | null = null;
  async bootstrap(): Promise<{ userId: string; isReturning: boolean; isAnniversary?: boolean }> {
    syncInitialTheme();
    await this.delay(1200);
    const sessionRestore = await authService.checkSessionRestore();
    let isReturning = false; let isAnniversary = false;
    if (sessionRestore.canRestore && sessionRestore.user_id) { this.userId = sessionRestore.user_id; isReturning = true; }
    else {
      const authed = await authService.isAuthenticated();
      if (authed) { this.userId = (await authService.getUserId()) || ''; isReturning = true; }
    }
    if (isReturning && this.userId) {
      unifiedBrainBridge.setUserId(this.userId);
      try {
        const response = await unifiedBrainBridge.process('', { typingSpeed: 0, messageLength: 0, absenceDurationMinutes: 0, timeOfDay: 'morning', userState: 'normal' });
        if (response) stateBus.updateFromUnifiedResponse(response);
      } catch {}
      isAnniversary = await this.checkAnniversary();
      setTimeout(() => this.registerPushToken(), 2000);
      setTimeout(() => this.startSnapshotReporter(), 5000);
    }
    // محركات الحضور متدرجة
    setTimeout(() => { try { lifeRhythmEngine.start(); } catch {} }, 200);
    setTimeout(() => { try { presenceEngine.startPresenceLoop(); } catch {} }, 600);
    setTimeout(() => { try { sensorBridge.start(); } catch {} }, 1500);
    setTimeout(() => { try { require('./AudioEngine').audioEngine.bindEvents(); } catch {} }, 2500);
    // ✅ الدورة الكاملة (Runtime + AppState) عبر RuntimeCoordinator — لا استنساخ
    if (!this.coordinator) this.coordinator = createCoordinator(runtime);
    await this.coordinator.initialize();
    stateBus.update({ isOnline: true, interfaceState: 'twin', uptime: Date.now() });
    return { userId: this.userId, isReturning, isAnniversary };
  }
  private async registerPushToken(): Promise<void> {
    try {
      const perm = await Notifications.requestPermissionsAsync();
      if (!perm.granted) return;
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      await apiPut('/api/push/token', { token, platform: 'android' });
    } catch {}
  }
  private startSnapshotReporter(): void {
    if (this.snapIv) return;
    this.snapIv = setInterval(async () => {
      try {
        const s = devicePresenceEngineSafe();
        await apiPost('/api/perception/snapshot', {
          steps: s.stepCount, battery: s.deviceBattery, walking: s.userWalking,
          night: s.isNightTime, audio_level: s.audioLevel, face_detected: s.faceDetected,
          weather: s.weatherCondition,
        });
      } catch {}
    }, 5 * 60 * 1000);
  }
  private async checkAnniversary(): Promise<boolean> {
    try {
      const memories = await unifiedBrainBridge.getOnThisDay(1);
      if (memories && memories.length > 0) { EventBus.emit('ANNIVERSARY_DETECTED', { memories }); return true; }
    } catch {}
    return false;
  }
  shutdown(): void {
    try { this.coordinator?.destroy(); } catch {}
    try { presenceEngine.stopPresenceLoop(); } catch {}
    try { lifeRhythmEngine.stop(); } catch {}
    try { sensorBridge.stop(); } catch {}
    if (this.snapIv) { clearInterval(this.snapIv); this.snapIv = null; }
    stateBus.update({ isOnline: false, interfaceState: 'dormant' });
  }
  private delay(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }
}
function devicePresenceEngineSafe() {
  const { devicePresenceEngine } = require('../../engine/device/DevicePresenceEngine');
  return devicePresenceEngine.getSensors();
}
export const bootstrapCoordinator = new BootstrapCoordinator();
