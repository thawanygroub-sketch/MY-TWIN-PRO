/** adConfig v2 — معرفات الوحدات فقط.
 * الحدود والمكافآت: الخادم وحده (/api/economy/*) هو مصدر الحقيقة (A-001/A-003). */
import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';

const envAdUnits = {
  android: Constants.expoConfig?.extra?.REWARDED_AD_UNIT_ID_ANDROID,
  ios: Constants.expoConfig?.extra?.REWARDED_AD_UNIT_ID_IOS,
};

const PRODUCTION_AD_UNITS: Record<string, string> = {
  rewarded: Platform.select({ ios: envAdUnits.ios, android: envAdUnits.android }) || TestIds.REWARDED,
};

export const getAdUnitId = (type: 'rewarded' | 'interstitial' | 'banner') => {
  if (__DEV__) return TestIds.REWARDED;
  return PRODUCTION_AD_UNITS[type] || TestIds.REWARDED;
};
