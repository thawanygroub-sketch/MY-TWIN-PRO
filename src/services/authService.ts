/** AuthService v2 — توكن واحد لكل الطبقات (mytwin-token) + أخطاء كريمة. */
import { apiPost, apiGet, setToken, removeToken } from '../../lib/httpClient';
import { googleLogin } from '../../lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { securityService } from './SecurityService';

const KEYS = { USER: 'mytwin-user', DEVICE_TRUSTED: 'mytwin-device-trusted', LAST_SESSION: 'mytwin-last-session' };

export interface AuthResult { token: string; user_id: string; onboarded: boolean; twin_name?: string; isNewUser: boolean; }

async function persistSession(token: string, userId: string): Promise<void> {
  await setToken(token);                      // مفتاح httpClient الموحد
  try { await securityService.storeToken(token); } catch {}
  try { await AsyncStorage.setItem(KEYS.USER, userId); } catch {}
}

export class AuthService {
  async login(email: string, password: string): Promise<AuthResult> {
    const data = await apiPost('/api/auth/login', { email: email.trim(), password });
    if (data?.token && data?.user_id) {
      await persistSession(data.token, data.user_id);
      return { token: data.token, user_id: data.user_id, onboarded: data.onboarded || false, isNewUser: false };
    }
    throw new Error('تعذر تسجيل الدخول.');
  }
  async signup(email: string, password: string, twinName: string = 'توأمك', lang: string = 'ar'): Promise<AuthResult> {
    const data = await apiPost('/api/auth/signup', { email: email.trim(), password, twin_name: twinName, lang });
    if (data?.token && data?.user_id) {
      await persistSession(data.token, data.user_id);
      return { token: data.token, user_id: data.user_id, onboarded: false, twin_name: twinName, isNewUser: true };
    }
    throw new Error(data?.message || 'تعذر إنشاء الحساب. حاول مرة أخرى.');
  }
  async loginWithGoogle(lang: string = 'ar'): Promise<AuthResult> {
    const data = await googleLogin(lang);
    if (data?.token && data?.user_id) {
      await persistSession(data.token, data.user_id);
      return { token: data.token, user_id: data.user_id, onboarded: data.onboarded || false, isNewUser: !data.onboarded };
    }
    throw new Error('تعذر تسجيل الدخول بـ Google. حاول مرة أخرى.');
  }
  async forgotPassword(email: string): Promise<string> {
    try {
      const data = await apiPost('/api/auth/forgot-password', { email: email.trim() });
      return data?.message || 'إذا كان البريد مسجلًا، فستصلك رسالة لاستعادة الوصول.';
    } catch {
      return 'إذا كان البريد مسجلًا، فستصلك رسالة لاستعادة الوصول.';
    }
  }
  async logout(): Promise<void> {
    await removeToken();
    try { await securityService.clearAll(); } catch {}
    try { await AsyncStorage.multiRemove([KEYS.USER, KES_LAST()]); } catch {}
  }
  async isAuthenticated(): Promise<boolean> {
    const token = await securityService.getToken().catch(() => null);
    if (!token) return false;
    if (securityService.isTokenExpired(token)) return await securityService.refreshAuthToken();
    return true;
  }
  async getUserId(): Promise<string | null> { return await AsyncStorage.getItem(KEYS.USER); }
  async checkSessionRestore() {
    const token = await securityService.getToken().catch(() => null);
    const userId = await AsyncStorage.getItem(KEYS.USER);
    if (token && userId) {
      if (securityService.isTokenExpired(token)) {
        const ok = await securityService.refreshAuthToken();
        if (!ok) return { canRestore: false, reason: 'token_expired' };
      }
      try {
        const data = await apiGet(`/api/auth/verify-token?user_id=${userId}`);
        if (data?.valid) return { canRestore: true, token, user_id: userId };
      } catch {}
    }
    return { canRestore: false, reason: 'no_valid_session' };
  }
}
function KES_LAST(){ return 'mytwin-last-session'; }
export const authService = new AuthService();
