import {
  initConnection,
  getProducts as iapGetProducts,
  purchaseUpdatedListener,
  requestSubscription,
  type Product,
  type Purchase,
  endConnection,
  getAvailablePurchases,
} from 'react-native-iap';
import { Platform } from 'react-native';

// معرفات المنتجات في Google Play Console
const PRODUCT_IDS = Platform.select({
  ios: [] as string[],
  android: [
    'plus_monthly',
    'premium_monthly',
    'pro_semiannual',
    'yearly_annual',
  ] as string[],
}) || [];

// خريطة تحويل productId إلى tier
export const TIER_MAP: Record<string, string> = {
  plus_monthly: 'plus',
  premium_monthly: 'premium',
  pro_semiannual: 'pro',
  yearly_annual: 'yearly',
};

let purchaseUpdateSubscription: any = null;

export async function initIAP(): Promise<boolean> {
  try {
    await initConnection();
    return true;
  } catch (err) {
    console.warn('IAP init failed:', err);
    return false;
  }
}

export async function getProducts(): Promise<Product[]> {
  try {
    const products = await iapGetProducts({ skus: PRODUCT_IDS });
    return products;
  } catch (err) {
    console.warn('getProducts failed:', err);
    return [];
  }
}

export function listenForPurchases(onPurchase: (purchase: Purchase) => void): void {
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
  }
  purchaseUpdateSubscription = purchaseUpdatedListener(async (purchase: Purchase) => {
    onPurchase(purchase);
  });
}

export async function purchaseSubscription(productId: string): Promise<string | null> {
  try {
    const purchase = await requestSubscription({ sku: productId });
    if (purchase) {
      return (purchase as any).purchaseToken || (purchase as any).transactionReceipt || 'purchased';
    }
    return null;
  } catch (err: any) {
    if (err?.code === 'E_USER_CANCELLED') {
      console.log('User cancelled');
      return null;
    }
    console.warn('purchaseSubscription failed:', err);
    return null;
  }
}

export async function restorePurchases(): Promise<Purchase[]> {
  try {
    const purchases = await getAvailablePurchases();
    return purchases;
  } catch (err) {
    console.warn('restorePurchases failed:', err);
    return [];
  }
}

export function disconnectIAP(): void {
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
    purchaseUpdateSubscription = null;
  }
  try {
    endConnection();
  } catch (err) {
    console.warn('endConnection failed:', err);
  }
}
