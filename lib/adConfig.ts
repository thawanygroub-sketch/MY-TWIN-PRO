import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';

// قراءة معرفات الإعلانات من متغيرات البيئة أو استخدام Test IDs
const envAdUnits = {
  android: Constants.expoConfig?.extra?.REWARDED_AD_UNIT_ID_ANDROID,
  ios: Constants.expoConfig?.extra?.REWARDED_AD_UNIT_ID_IOS,
};

// معرفات الإعلانات الحقيقية (استبدل عند النشر)
const PRODUCTION_AD_UNITS: Record<string, string> = {
  rewarded: Platform.select({
    ios: envAdUnits.ios || 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx',
    android: envAdUnits.android || 'ca-app-pub-xxxxxxxxxxxxxxxx/xxxxxxxxxx',
  }) || TestIds.REWARDED,
};

export const getAdUnitId = (type: 'rewarded' | 'interstitial' | 'banner') => {
  if (__DEV__) {
    switch (type) {
      case 'rewarded': return TestIds.REWARDED;
      case 'interstitial': return TestIds.INTERSTITIAL;
      case 'banner': return TestIds.BANNER;
      default: return TestIds.REWARDED;
    }
  }
  return PRODUCTION_AD_UNITS[type] || TestIds.REWARDED;
};

// إعدادات الإعلانات حسب الباقة
export const AD_CONFIG = {
  free: { maxDaily: 3, rewardMessages: 3 },
  plus: { maxDaily: 1, rewardMessages: 5 },
  premium: { maxDaily: 0, rewardMessages: 0 },
  pro: { maxDaily: 0, rewardMessages: 0 },
  yearly: { maxDaily: 0, rewardMessages: 0 },
};
