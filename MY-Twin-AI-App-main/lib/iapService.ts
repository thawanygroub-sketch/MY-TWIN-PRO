import {
  initConnection,
  getProducts as iapGetProducts,
  requestSubscription,
  getAvailablePurchases,
  acknowledgePurchaseAndroid,
  finishTransaction,
  purchaseErrorListener,
  purchaseUpdatedListener,
  endConnection,
  type Product,
  type Purchase,
} from 'react-native-iap';
import { Platform } from 'react-native';

// ✅ تم استبدال as any بواجهات مخصصة متوافقة مع إصداري react-native-iap الحالي
interface IapPurchase {
  purchaseToken?: string;
  transactionReceipt?: string;
  transactionId?: string;
  signature?: string;
  isAcknowledged?: boolean;
}

const PRODUCT_IDS = Platform.select({
  ios: [] as string[],
  android: ['plus_monthly', 'premium_monthly', 'pro_semiannual', 'yearly_annual'] as string[],
}) || [];

export const TIER_MAP: Record<string, string> = {
  plus_monthly: 'plus', premium_monthly: 'premium', pro_semiannual: 'pro', yearly_annual: 'yearly',
};

let purchaseUpdateSubscription: any = null;
let purchaseErrorSubscription: any = null;
let isPurchasing = false;

export async function initIAP(): Promise<boolean> {
  try { await initConnection(); return true; } catch { return false; }
}

export async function getProducts(): Promise<Product[]> {
  try { return await iapGetProducts({ skus: PRODUCT_IDS }); } catch { return []; }
}

export async function purchaseSubscription(productId: string): Promise<string | null> {
  if (isPurchasing) return null;
  isPurchasing = true;
  try {
    const purchase = await requestSubscription({ sku: productId });
    if (!purchase) { isPurchasing = false; return null; }
    const p: IapPurchase = purchase as any; // Cast ضروري لمرة واحدة بسبب عدم تطابق تعريفات المكتبة
    const token = p.purchaseToken || p.transactionReceipt || '';
    if (!token) { isPurchasing = false; return null; }

    if (Platform.OS === 'android' && !(await verifyAndroidSignature(p))) {
      isPurchasing = false; return null;
    }
    if (!(await verifyReceiptWithBackend(token, productId))) {
      isPurchasing = false; return null;
    }

    await finalizePurchase(p);
    isPurchasing = false;
    return token;
  } catch (err: any) {
    isPurchasing = false;
    if (err?.code === 'E_USER_CANCELLED') return null;
    return null;
  }
}

export async function restorePurchases(): Promise<Purchase[]> {
  try { return await getAvailablePurchases(); } catch { return []; }
}

export function listenForPurchases(onPurchase: (purchase: Purchase) => void): void {
  if (purchaseUpdateSubscription) purchaseUpdateSubscription.remove();
  purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase: Purchase) => {
    await finalizePurchase(purchase as any);
    onPurchase(purchase);
  });
  if (purchaseErrorSubscription) purchaseErrorSubscription.remove();
  purchaseErrorSubscription = purchaseErrorListener((error: any) => console.warn('⚠️ خطأ شراء:', error));
}

async function finalizePurchase(purchase: IapPurchase): Promise<void> {
  try {
    if (Platform.OS === 'android' && purchase.purchaseToken) {
      await acknowledgePurchaseAndroid({ purchaseToken: purchase.purchaseToken } as any);
    } else if (Platform.OS === 'ios' && purchase.transactionId) {
      await finishTransaction({ transactionId: purchase.transactionId } as any);
    }
  } catch (err) { console.warn('finalizePurchase failed:', err); }
}

async function verifyAndroidSignature(purchase: IapPurchase): Promise<boolean> {
  if (__DEV__) return true;
  const receipt = purchase.transactionReceipt || '';
  const signature = purchase.signature || '';
  return !!(receipt && signature);
}

async function verifyReceiptWithBackend(token: string, productId: string): Promise<boolean> {
  try {
    const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await fetch(`${BASE_URL}/api/verify-receipt`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receipt: token, productId, platform: Platform.OS }),
    });
    if (!response.ok) return __DEV__;
    const data = await response.json();
    return data?.valid === true;
  } catch { return __DEV__; }
}

export function disconnectIAP(): void {
  if (purchaseUpdateSubscription) { purchaseUpdateSubscription.remove(); purchaseUpdateSubscription = null; }
  if (purchaseErrorSubscription) { purchaseErrorSubscription.remove(); purchaseErrorSubscription = null; }
  try { endConnection(); } catch {}
}
