/** AdService v2.1 — منح من الخادم فقط + واجهات قديمة متوافقة (TwinPlusWing). */
import { RewardedAdService } from './RewardedAdService';
import { economyEngine } from './EconomyEngine';
import { EventBus } from '../core/EventBus';

export interface AdStatus {
  watched_today: number; remaining_today: number; max_daily_ads: number;
  energy_left: number; capability_left: number; ads_available: boolean;
  tier: string; can_watch: boolean; reward_per_ad: number;
}
export interface AdReward { success: boolean; livingMessage?: string; }

export class AdService {
  private rewardedAd: RewardedAdService;
  constructor() { this.rewardedAd = new RewardedAdService(); }
  async loadAd(): Promise<void> { await this.rewardedAd.load(); }
  isReady(): boolean { return this.rewardedAd.isReady(); }
  getMaxDailyAds(): number { return 5; }
  getPassDuration(): number { return 60; }
  async getStatus(_userId?: string): Promise<AdStatus> {
    const s = await economyEngine.refresh();
    const e = s?.energyAdsLeft ?? 0, c = s?.capabilityAdsLeft ?? 0;
    const max = (s?.tier === 'plus') ? 2 : 5;
    return { watched_today: 0, remaining_today: e + c, max_daily_ads: max,
      energy_left: e, capability_left: c, ads_available: !!s?.adsAvailable,
      tier: s?.tier ?? 'free', can_watch: !!s?.adsAvailable && (e > 0 || c > 0), reward_per_ad: 60 };
  }
  async showAd(_userId?: string, kind: 'energy' | 'capability' = 'energy', capability = 'general'): Promise<AdReward> {
    const shown = await this.rewardedAd.show();
    if (!shown) return { success: false, livingMessage: 'لم يكتمل الإعلان.' };
    const res = kind === 'capability'
      ? await economyEngine.claimCapabilityAd(capability)
      : await economyEngine.claimEnergyAd();
    if (res.success) EventBus.emit('AD_REWARD_EARNED', { points: 10 });
    return { success: res.success, livingMessage: res.livingMessage };
  }
  async canWatch(_userId?: string): Promise<boolean> { return (await this.getStatus()).can_watch; }
}
export const adService = new AdService();
