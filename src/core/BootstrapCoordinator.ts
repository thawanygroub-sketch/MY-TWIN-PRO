import { AppState, AppStateStatus } from 'react-native';
import * as Battery from 'expo-battery';
import * as Notifications from 'expo-notifications';
import { authService } from '../services/authService';
import { stateBus } from './StateBus';
import { unifiedBrainBridge } from './UnifiedBrainBridge';
import { presenceEngine } from '../../engine/presence/PresenceEngine';
import { lifeRhythmEngine } from '../../engine/life/LifeRhythmEngine';
import { sensorBridge } from './SensorBridge';
import { runtime } from './TwinRuntime';
import { syncInitialTheme } from '../../engine/colors';
import { EventBus } from './EventBus';
import { devicePresenceEngine } from '../../engine/device/DevicePresenceEngine';
import { apiPost, apiPut } from '../../lib/httpClient';
export class BootstrapCoordinator {
  private userId = '';
  private appSub: { remove: () => void } | null = null;
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
      } catch (e) {}
      isAnniversary = await this.checkAnniversary();
      await this.registerPushToken();
      this.startSnapshotReporter();
    }
    try { presenceEngine.startPresenceLoop(); } catch (e) {}
    try { lifeRhythmEngine.start(); } catch (e) {}
    try { sensorBridge.start(); } catch (e) {}
    try { runtime.start(); } catch (e) {}
    try { require('./AudioEngine').audioEngine.bindEvents(); } catch (e) {}
    this.bindLifecycle();
    stateBus.update({ isOnline: true, interfaceState: 'twin', uptime: Date.now() });
    return { userId: this.userId, isReturning, isAnniversary };
  }
  private async registerPushToken(): Promise<void> {
    try {
      const perm = await Notifications.requestPermissionsAsync();
      if (!perm.granted) return;
      const token = (await Notifications.getExpoPushTokenAsync()).data;
      await apiPut('/api/push/token', { token, platform: 'android' });
    } catch (e) {}
  }
  private startSnapshotReporter(): void {
    if (this.snapIv) return;
    this.snapIv = setInterval(async () => {
      try {
        const s = devicePresenceEngine.getSensors();
        await apiPost('/api/perception/snapshot', {
          steps: s.stepCount, battery: s.deviceBattery, walking: s.userWalking,
          night: s.isNightTime, audio_level: s.audioLevel, face_detected: s.faceDetected,
          weather: s.weatherCondition,
        });
      } catch (e) {}
    }, 5 * 60 * 1000);
  }
  private bindLifecycle(): void {
    if (this.appSub) return;
    this.appSub = AppState.addEventListener('change', (st: AppStateStatus) => {
      if (st === 'active') { try { runtime.resume(); } catch {} }
      else { try { runtime.pause(); } catch {} }
    });
  }
  private async checkAnniversary(): Promise<boolean> {
    try {
      const memories = await unifiedBrainBridge.getOnThisDay(1);
      if (memories && memories.length > 0) { EventBus.emit('ANNIVERSARY_DETECTED', { memories }); return true; }
    } catch (e) {}
    return false;
  }
  shutdown(): void {
    try { presenceEngine.stopPresenceLoop(); } catch (e) {}
    try { lifeRhythmEngine.stop(); } catch (e) {}
    try { sensorBridge.stop(); } catch (e) {}
    try { runtime.stop(); } catch (e) {}
    if (this.snapIv) { clearInterval(this.snapIv); this.snapIv = null; }
    this.appSub?.remove(); this.appSub = null;
    stateBus.update({ isOnline: false, interfaceState: 'dormant' });
  }
  private delay(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }
}
export const bootstrapCoordinator = new BootstrapCoordinator();
