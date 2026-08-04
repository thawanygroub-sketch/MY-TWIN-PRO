import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiPost, setToken } from './httpClient';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const TOKEN_KEY = 'mytwin-token';
const USER_KEY = 'mytwin-user';
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
  || '907014926697-cj53f1nj1es27n1a5hhtnp7vv6q8uffn.apps.googleusercontent.com';

export async function saveAuthData(token: string, userId: string): Promise<void> {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, userId);
  await setToken(token);
}
export async function getToken(): Promise<string | null> { return AsyncStorage.getItem(TOKEN_KEY); }
export async function getUserId(): Promise<string | null> { return AsyncStorage.getItem(USER_KEY); }
export async function removeToken(): Promise<void> { await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]); }

export async function login(email: string, password: string): Promise<any> {
  const data = await apiPost('/api/auth/login', { email: email.trim(), password });
  if (data?.token && data?.user_id) await saveAuthData(data.token, data.user_id);
  return data;
}

export async function signup(email: string, password: string, twinName: string, lang: string = 'ar'): Promise<any> {
  const data = await apiPost('/api/auth/signup', { email: email.trim(), password, twin_name: twinName, lang });
  if (data?.token && data?.user_id) await saveAuthData(data.token, data.user_id);
  return data;
}

export async function googleLogin(lang: string = 'ar'): Promise<any> {
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'mytwin' });
  // ⚠️ هذا السطر هو ما يجب تسجيله حرفيًا في Google Console:
  console.log('[GoogleLogin] REGISTER THIS redirect_uri IN GOOGLE CONSOLE =>', redirectUri);
  const discovery = await AuthSession.fetchDiscoveryAsync('https://accounts.google.com');
  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });
  const result = await request.promptAsync(discovery);
  if (result.type === 'dismiss') throw new Error('تم إلغاء تسجيل الدخول.');
  if (result.type === 'success' && result.params.code) {
    const data = await apiPost('/api/auth/google', {
      code: result.params.code,
      redirect_uri: redirectUri,
      code_verifier: request.codeVerifier,
      lang,
    });
    if (data?.token && data?.user_id) {
      await saveAuthData(data.token, data.user_id);
      return { token: data.token, user_id: data.user_id, onboarded: data.onboarded || false };
    }
    throw new Error('تعذر التحقق من حساب Google على الخادم.');
  }
  throw new Error('فشل تسجيل الدخول بـ Google.');
}

export async function logout(): Promise<void> { await removeToken(); }
export async function isAuthenticated(): Promise<boolean> { return !!(await getToken()); }
