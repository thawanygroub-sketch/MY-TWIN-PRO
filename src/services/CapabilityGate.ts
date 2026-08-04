/** CapabilityGate v2 — الواجهة تعرض فقط ما يسمح به الخادم (capability_gate.py).
 * ساعة المستكشف تفتح كل شيء مؤقتًا. الخادم يبقى المنفّذ النهائي. */
import { subscriptionService } from './SubscriptionService';
import { PlanTier } from './CommercePlugin';
import { explorerPassBridge } from './ExplorerPassBridge';

const LEVEL: Record<PlanTier, number> = { free: 0, plus: 1, premium: 2, pro: 3, yearly: 4 };

const SERVER_NEED: Record<string, number> = {
  chat: 0, study: 0, dream: 0, task_manager: 0,
  business: 1, creator: 1, life_coach: 1, proactive: 1,
  code_lab: 2, image_lab: 2, smart_home: 2, deep_search: 2, shadow_mode: 2,
};

const CLIENT_TO_SERVER: Record<string, string> = {
  chat: 'chat', weather: 'chat', search: 'chat', translate: 'chat', summarize: 'chat',
  study: 'study', dreams: 'dream', content: 'creator', coach: 'life_coach',
  code: 'code_lab', business: 'business', smart_home: 'smart_home',
  proactive: 'proactive', deep_search: 'deep_search', shadow_mode: 'shadow_mode',
};

export class CapabilityGate {
  isCapabilityAvailable(capabilityId: string): boolean {
    if (explorerPassBridge.isPassActive(capabilityId)) return true;
    const tier = subscriptionService.getCurrentTier();
    const mine = LEVEL[tier] ?? 0;
    const key = CLIENT_TO_SERVER[capabilityId] ?? capabilityId;
    return mine >= (SERVER_NEED[key] ?? 0);
  }
  getAvailableCapabilities(): string[] {
    return Object.keys(CLIENT_TO_SERVER).filter(c => this.isCapabilityAvailable(c));
  }
  getUpgradeMessage(capabilityId: string): string | null {
    return this.isCapabilityAvailable(capabilityId)
      ? null
      : 'هذه القدرة تنفتح تدريجيًا مع علاقتنا وباقتك الحالية.';
  }
}
export const capabilityGate = new CapabilityGate();
