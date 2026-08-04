/** EconomyEngine v3 — اقتصادان متكاملان:
 * 1) طاقة الكيان: server-authoritative، لغة حية، إعلانات محكومة (A-001/A-003).
 * 2) نقاط الروح: طبقة تفاعل محلية محفوظة دائمًا (قرار المالك A-004)،
 *    ليست الطاقة ولا تحل محلها، وتُراجع مع الإعلانات بعد سنتين. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventBus } from '../core/EventBus';
import { apiGet, apiPost } from '../../lib/httpClient';

export interface SoulPointTransaction {
  id: string;
  source: 'ad'|'daily_login'|'study_session'|'dream'|'journal'|'referral'|'achievement'|'goal'|'surprise';
  amount: number; timestamp: string; description: string;
}
export interface SoulPointsBalance { total: number; earned_today: number; lifetime: number; history: SoulPointTransaction[]; }
export interface EconomyState {
  energyLevel: number; mood: string; livingMessage: string;
  tier: string; messagesRemaining: number;
  energyAdsLeft: number; capabilityAdsLeft: number; adsAvailable: boolean;
  restOptions: { id: string; label: string }[];
}
const POINTS_KEY = 'mytwin_soul_points';

export class EconomyEngine {
  private balance: SoulPointsBalance = { total: 0, earned_today: 0, lifetime: 0, history: [] };
  private state: EconomyState | null = null;
  private loaded = false;

  /* ── الطاقة (الخادم هو الحقيقة) ─────────────────────────── */
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

  /* ── نقاط الروح (محفوظة، غير وهمية، بقرار المالك) ───────── */
  private async load(): Promise<void> {
    if (this.loaded) return;
    try { const raw = await AsyncStorage.getItem(POINTS_KEY); if (raw) this.balance = JSON.parse(raw); } catch {}
    this.loaded = true;
  }
  private async persist(): Promise<void> {
    try { await AsyncStorage.setItem(POINTS_KEY, JSON.stringify(this.balance)); } catch {}
  }
  async initialize(userId?: string): Promise<void> { await this.load(); await this.refresh(); }
  async addPoints(source: SoulPointTransaction['source'], amount: number, description: string): Promise<number> {
    await this.load();
    this.balance.total += amount; this.balance.earned_today += amount; this.balance.lifetime += amount;
    this.balance.history.unshift({ id: `sp_${Date.now()}_${Math.random().toString(36).substr(2,5)}`, source, amount, timestamp: new Date().toISOString(), description });
    if (this.balance.history.length > 100) this.balance.history.length = 100;
    await this.persist();
    EventBus.emit('SOUL_POINTS_EARNED', { source, amount, description });
    return this.balance.total;
  }
  async spendPoints(amount: number, description: string): Promise<boolean> {
    await this.load();
    if (this.balance.total < amount) return false;
    this.balance.total -= amount;
    await this.persist();
    EventBus.emit('SOUL_POINTS_SPENT', { amount, description });
    return true;
  }
  getBalance(): SoulPointsBalance { return { ...this.balance, history: [...this.balance.history] }; }
  async claimDailyLogin(userId?: string): Promise<number> { return this.addPoints('daily_login', 5, 'تسجيل الدخول اليومي'); }
  async rewardStudySession(): Promise<number> { return this.addPoints('study_session', 15, 'إنهاء جلسة دراسة'); }
  async rewardDream(): Promise<number> { return this.addPoints('dream', 10, 'استكشاف حلم'); }
  async rewardReferral(): Promise<number> { return this.addPoints('referral', 100, 'أحضرت روحاً جديدة'); }
  async rewardAchievement(name: string): Promise<number> { return this.addPoints('achievement', 25, `إنجاز: ${name}`); }
  async surpriseReward(amount: number, reason: string): Promise<number> { return this.addPoints('surprise', amount, `🎁 ${reason}`); }
  suggestPlan(stats: { studyCount: number; dreamCount: number; codeCount: number; voiceUsage: boolean }): string | null {
    if (stats.codeCount > 10 && stats.voiceUsage) return 'premium';
    if (stats.studyCount > 20) return 'plus';
    if (stats.dreamCount > 5) return 'plus';
    return null;
  }
  async redeemReward(rewardType: string): Promise<{ success: boolean; cost: number; description: string }> {
    const rewards: Record<string, { cost: number; description_ar: string }> = {
      theme: { cost: 50, description_ar: 'ثيم جديد' },
      voice: { cost: 100, description_ar: 'صوت جديد' },
      ambient: { cost: 75, description_ar: 'خلفية Ambient جديدة' },
      memory_capsule: { cost: 200, description_ar: 'كبسولة ذاكرة' },
      dream_pass: { cost: 150, description_ar: 'Dream Pass إضافي' },
    };
    const r = rewards[rewardType];
    if (!r) return { success: false, cost: 0, description: 'غير متاح' };
    const ok = await this.spendPoints(r.cost, r.description_ar);
    return { success: ok, cost: r.cost, description: r.description_ar };
  }
}
export const economyEngine = new EconomyEngine();
EventBus.on('AD_REWARD_EARNED', async (p: any) => {
  await economyEngine.addPoints('ad', p?.points || 10, 'مشاهدة إعلان');
});
