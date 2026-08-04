/** AuthService v3 — توكن موحد (mytwin-token) + أخطاء حية + استعادة كريمة.
 * يغلق فجوة تعدد أماكن حفظ التوكن بين httpClient وبقية الطبقات. */
import { apiPost, apiGet, setToken, removeToken } from '../../lib/httpClient';
import { googleLogin } from '../../lib/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = { USER: 'mytwin-user', LAST_SESSION: 'mytwin-last-session' };

export interface AuthResult {
  token: string; user_id: string; onboarded: boolean;
  twin_name?: string; isNewUser: boolean;
}
export interface SessionRestoreResult {
  canRestore: boolean; token?: string; user_id?: string; reason?: string;
}

async function persistSession(token: string, userId: string): Promise<void> {
  await setToken(token);                      // مفتاح httpClient الموحد
  await AsyncStorage.setItem(KEYS.USER, userId);
}

export class AuthService {
  async login(email: string, password: string): Promise<AuthResult> {
    const data = await apiPost('/api/auth/login', { email: email.trim(), password });
    if (data?.token && data?.user_id) {
      await persistSession(data.token, data.user_id);
      return { token: data.token, user_id: data.user_id, onboarded: true, isNewUser: false };
    }
    throw new Error(data?.message || 'بيانات الدخول غير صحيحة.');
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
    throw new Error(data?.message || 'تعذر تسجيل الدخول بـ Google. حاول مرة أخرى.');
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
    await AsyncStorage.multiRemove([KEYS.USER, KEYS.LAST_SESSION]).catch(() => {});
  }

  async getUserId(): Promise<string | null> { return AsyncStorage.getItem(KEYS.USER); }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }

  async getToken(): Promise<string | null> {
    try { return await AsyncStorage.getItem('mytwin-token'); } catch { return null; }
  }

  async checkSessionRestore(): Promise<SessionRestoreResult> {
    const token = await this.getToken();
    const userId = await AsyncStorage.getItem(KEYS.USER);
    if (!token || !userId) return { canRestore: false, reason: 'no_session' };
    try {
      const data = await apiGet(`/api/auth/verify-token?user_id=${userId}`);
      if (data?.valid) return { canRestore: true, token, user_id: userId };
    } catch {}
    return { canRestore: false, reason: 'invalid_session' };
  }

  async saveLastSession(sessionId: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.LAST_SESSION, sessionId).catch(() => {});
  }
}
export const authService = new AuthService();
