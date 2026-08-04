/** EconomyEngine v2 — اقتصاد الطاقة الحي، server-authoritative.
 * لا نقاط، لا gamification (الفصل 33). الطاقة وساعات القدرات فقط.
 * يقرأ عقد economy v5: energy/mood/living_message/ads/rest_options. */
import { EventBus } from '../core/EventBus';
import { apiGet, apiPost } from '../../lib/httpClient';

export interface EconomyState {
  energyLevel: number; mood: string; livingMessage: string;
  tier: string; messagesRemaining: number;
  energyAdsLeft: number; capabilityAdsLeft: number; adsAvailable: boolean;
  restOptions: { id: string; label: string }[];
}
export class EconomyEngine {
  private state: EconomyState | null = null;
  async refresh(): Promise<EconomyState | null> {
    try {
      const res = await apiGet('/api/economy/balance');
      if (!res) return this.state;
      this.state = {
        energyLevel: res?.energy?.level ?? 0.5,
        mood: res?.energy?.mood ?? 'warming',
        livingMessage: res?.energy?.living_message ?? '',
        tier: res?.subscription?.tier ?? 'free',
        messagesRemaining: res?.subscription?.messages_remaining ?? 0,
        adsAvailable: !!res?.ads,
        energyAdsLeft: res?.ads?.energy_left ?? 0,
        capabilityAdsLeft: res?.ads?.capability_left ?? 0,
        restOptions: res?.rest_options ?? [],
      };
      EventBus.emit('ECONOMY_UPDATED', this.state);
      return this.state;
    } catch { return this.state; }
  }
  getState(): EconomyState | null { return this.state; }
  async takeRest(): Promise<{ success: boolean; livingMessage: string }> {
    const res = await apiPost('/api/economy/rest', {});
    await this.refresh();
    return { success: !!res?.success, livingMessage: res?.living_message ?? '' };
  }
  async claimEnergyAd(): Promise<{ success: boolean; livingMessage: string }> {
    const res = await apiPost('/api/economy/ad-reward', { ad_type: 'energy' });
    await this.refresh();
    return { success: !!res?.success, livingMessage: res?.living_message ?? '' };
  }
  async claimCapabilityAd(capability: string): Promise<{ success: boolean; livingMessage: string; expiresAt?: string }> {
    const res = await apiPost('/api/economy/ad-reward', { ad_type: 'capability', capability });
    await this.refresh();
    return { success: !!res?.success, livingMessage: res?.living_message ?? '', expiresAt: res?.expires_at };
  }
  /** توافقي قديم — مُهمَل دستوريًا؛ لا يمنح شيئًا. */
  async addPoints(): Promise<number> { console.warn('[Economy] points deprecated (Ch.33)'); return 0; }
  async claimDailyLogin(): Promise<number> { return 0; }
}
export const economyEngine = new EconomyEngine();
