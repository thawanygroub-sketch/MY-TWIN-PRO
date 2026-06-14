import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import { supabase } from './supabase';
import { router } from 'expo-router';
import * as Sentry from '@sentry/react-native';

// ✅ معالج الإشعارات الأمامية
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

/**
 * تسجيل الجهاز للحصول على Push Token وتخزينه في Supabase
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    Sentry.captureMessage('⚠️ الإشعارات تحتاج جهازاً حقيقياً', 'warning');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Sentry.captureMessage('❌ المستخدم رفض صلاحية الإشعارات', 'info');
    return null;
  }

  try {
    const projectId = 'b5e2baa3-6015-40a5-9f31-115298d3b0c9';
    const token = await Notifications.getExpoPushTokenAsync({ projectId });

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { error } = await supabase.from('profiles').update({
        push_token: token.data,
        device_platform: Platform.OS,
        push_token_updated_at: new Date().toISOString(),
      }).eq('id', session.user.id);

      if (error) {
        Sentry.captureException(error);
      } else {
        console.log('✅ Push Token مخزن بنجاح');
      }
    }

    return token.data;
  } catch (e: any) {
    Sentry.captureException(e);
    return null;
  }
}

/**
 * معالجة الإشعارات الواردة والتنقل عند الضغط
 */
export function setupNotificationHandlers() {
  Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;
    console.log('📩 تم الضغط على إشعار:', data);

    try {
      if (data?.type === 'proactive') router.push('/chat');
      else if (data?.type === 'bond_update') router.push('/relationship');
      else if (data?.type === 'goal_reminder') router.push('/relationship');
      else router.push('/chat');
    } catch (e) {
      Sentry.captureException(e);
    }
  });

  Notifications.addNotificationReceivedListener(notification => {
    console.log('📬 إشعار في الأمام:', notification.request.content.title);
  });
}

/**
 * إعداد قنوات الإشعارات (Android)
 */
export async function setupAndroidChannels() {
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('mytwin_proactive', {
        name: 'رسائل استباقية',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6B21A8',
      });

      await Notifications.setNotificationChannelAsync('mytwin_default', {
        name: 'عام',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 100, 100, 100],
        lightColor: '#6B21A8',
      });
    } catch (e) {
      Sentry.captureException(e);
    }
  }
}
