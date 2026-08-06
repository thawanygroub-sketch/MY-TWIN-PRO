import { AppState, AppStateStatus } from 'react-native';
import * as Battery from 'expo-battery';
import { authService } from '../services/authService';
import { stateBus } from './StateBus';
import { unifiedBrainBridge } from './UnifiedBrainBridge';
import { presenceEngine } from '../../engine/presence/PresenceEngine';
import { lifeRhythmEngine } from '../../engine/life/LifeRhythmEngine';
import { unifiedPerceptionEngine } from '../../engine/perception/UnifiedPerceptionEngine';
import { sensorBridge } from './SensorBridge';
import { runtime } from './TwinRuntime';
import { syncInitialTheme } from '../../engine/colors';
import { EventBus } from './EventBus';
export class BootstrapCoordinator {
  private userId: string = '';
  private appSub: { remove: () => void } | null = null;
  private batterySub: { remove: () => void } | null = null;
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
    }
    try { presenceEngine.startPresenceLoop(); } catch (e) {}
    try { lifeRhythmEngine.start(); } catch (e) {}
    try { sensorBridge.start(); } catch (e) {}
    try { unifiedPerceptionEngine.start(); } catch (e) {}
    try { runtime.start(); } catch (e) {}
    try { require('./AudioEngine').audioEngine.bindEvents(); } catch (e) {}
    this.bindLifecycle();
    await this.bindBattery();
    stateBus.update({ isOnline: true, interfaceState: 'twin', uptime: Date.now() });
    return { userId: this.userId, isReturning, isAnniversary };
  }
  private bindLifecycle(): void {
    if (this.appSub) return;
    this.appSub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') { try { runtime.resume(); } catch {} }
      else { try { runtime.pause(); } catch {} }
    });
  }
  private async bindBattery(): Promise<void> {
    try {
      const level = await Battery.getBatteryLevelAsync();
      const { devicePresenceEngine } = require('../../engine/device/DevicePresenceEngine');
      devicePresenceEngine.updateBattery(Math.round(level * 100));
      this.batterySub = Battery.addBatteryLevelListener((e: any) => devicePresenceEngine.updateBattery(Math.round((e && typeof e.batteryLevel === 'number' ? e.batteryLevel : 1) * 100)));
    } catch (e) {}
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
    try { unifiedPerceptionEngine.stop(); } catch (e) {}
    try { sensorBridge.stop(); } catch (e) {}
    try { runtime.stop(); } catch (e) {}
    this.appSub?.remove(); this.appSub = null;
    this.batterySub?.remove(); this.batterySub = null;
    stateBus.update({ isOnline: false, interfaceState: 'dormant' });
  }
  private delay(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }
}
export const bootstrapCoordinator = new BootstrapCoordinator();
