/** ExplorerPassBridge v2 — ساعة القدرات تُمنح من الخادم فقط. */
import { EventBus } from '../core/EventBus';
import { economyEngine } from './EconomyEngine';

export class ExplorerPassBridge {
  private passActive = false;
  private passExpiry = 0;
  private capability = 'general';
  private timer: ReturnType<typeof setTimeout> | null = null;

  async activateViaAd(capability: string): Promise<boolean> {
    const res = await economyEngine.claimCapabilityAd(capability);
    if (!res.success || !res.expiresAt) return false;
    this.capability = capability;
    this.passActive = true;
    this.passExpiry = new Date(res.expiresAt).getTime();
    EventBus.emit('EXPLORER_PASS_ACTIVATED', { expiry: this.passExpiry, capability });
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.deactivate(), Math.max(0, this.passExpiry - Date.now()));
    return true;
  }
  deactivate(): void {
    this.passActive = false; this.passExpiry = 0;
    EventBus.emit('EXPLORER_PASS_EXPIRED', { capability: this.capability });
  }
  isPassActive(capability?: string): boolean {
    if (this.passActive && Date.now() > this.passExpiry) { this.deactivate(); return false; }
    if (!this.passActive) return false;
    return capability ? capability === this.capability || this.capability === 'general' : true;
  }
  getRemainingMinutes(): number {
    return this.isPassActive() ? Math.max(0, Math.ceil((this.passExpiry - Date.now())/60000)) : 0;
  }
}
export const explorerPassBridge = new ExplorerPassBridge();
