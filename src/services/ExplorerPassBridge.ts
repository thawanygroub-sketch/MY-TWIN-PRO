/** ExplorerPassBridge v3 — ساعة القدرات من الخادم أولًا، وتوافق كامل مع القديم. */
import { EventBus } from '../core/EventBus';
import { economyEngine } from './EconomyEngine';

export class ExplorerPassBridge {
  private passActive = false;
  private passExpiry = 0;
  private capability = 'general';
  private timer: ReturnType<typeof setTimeout> | null = null;

  /** الواجهة القديمة — تمر عبر الخادم، ومع فشل الشبكة تمنح الساعة محليًا كي لا تنكسر التجربة. */
  async activatePass(userId?: string): Promise<void> {
    const ok = await this.activateViaAd('general');
    if (!ok) this.setExpiry(Date.now() + 3600_000, 'general');
    await economyEngine.addPoints('ad', 10, 'مشاهدة إعلان');
    EventBus.emit('EXPLORER_PASS_ACTIVATED', { expiry: this.passExpiry });
  }
  async activateViaAd(capability: string): Promise<boolean> {
    const res = await economyEngine.claimCapabilityAd(capability);
    if (!res.success || !res.expiresAt) return false;
    this.setExpiry(new Date(res.expiresAt).getTime(), capability);
    return true;
  }
  private setExpiry(exp: number, capability: string): void {
    this.passActive = true; this.passExpiry = exp; this.capability = capability;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.deactivatePass(), Math.max(0, exp - Date.now()));
  }
  deactivatePass(): void {
    this.passActive = false; this.passExpiry = 0;
    EventBus.emit('EXPLORER_PASS_EXPIRED', { capability: this.capability });
  }
  isPassActive(capability?: string): boolean {
    if (this.passActive && Date.now() > this.passExpiry) { this.deactivatePass(); return false; }
    if (!this.passActive) return false;
    return capability ? (capability === this.capability || this.capability === 'general') : true;
  }
  getRemainingMinutes(): number {
    return this.isPassActive() ? Math.max(0, Math.ceil((this.passExpiry - Date.now()) / 60000)) : 0;
  }
}
export const explorerPassBridge = new ExplorerPassBridge();
