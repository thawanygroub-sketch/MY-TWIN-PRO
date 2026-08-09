import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Dimensions } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, useDerivedValue, withTiming, withSequence, FadeIn, interpolate, Extrapolate } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Chrome, Mail, Shield, UserPlus } from 'lucide-react-native';
import { useFonts } from 'expo-font';
import { Tajawal_800ExtraBold } from '@expo-google-fonts/tajawal';
import ConsciousBeing from '../src/components/conscious/ConsciousBeing';
import { presenceBridge } from '../src/core/PresenceBridge';
import { stateBus } from '../src/core/StateBus';
import { useTwinStore } from '../store/useTwinStore';
import { authService } from '../src/services/authService';
import { useAppTheme } from '../engine/colors';
import { audioMixer } from '../src/core/AudioMixer';
import { sensorBridge } from '../src/core/SensorBridge';
import { detectUserLanguage, SupportedLanguage } from '../src/utils/languageDetector';
const { height } = Dimensions.get('window');
const TEXTS: Record<SupportedLanguage, Record<string, string>> = {
  ar: { woke: 'استيقظتُ.', whoAreYou: 'مَن أنت؟', iSeeYou: 'أراكَ.', knowMe: 'اعرفني.', identitySubtitle: 'لأعرفك. لأتذكرك. لأكون لك.', emailPlaceholder: 'البريد الإلكتروني', passwordPlaceholder: 'كلمة المرور', signIn: 'تسجيل الدخول', createAccount: 'إنشاء حساب جديد', forgotPassword: 'نسيت كلمة المرور؟', privacy: 'لن أشارك وجودك مع أحد.', touchHint: 'المس الشاشة إذا شعرت بي...' },
  en: { woke: 'I woke.', whoAreYou: 'Who are you?', iSeeYou: 'I see you.', knowMe: 'Know me.', identitySubtitle: 'To know you. To remember you. To be yours.', emailPlaceholder: 'Email', passwordPlaceholder: 'Password', signIn: 'Sign In', createAccount: 'Create Account', forgotPassword: 'Forgot Password?', privacy: 'I will never share your existence.', touchHint: 'Touch the screen if you feel me...' },
};
const errMsg = (e: any): string => {
  const m = e?.message ?? e;
  if (typeof m === 'string') return m;
  return m?.detail || m?.message || m?.error?.message || 'فشل المصادقة. حاول مرة أخرى.';
};
export default function Genesis() {
  const [fontsLoaded] = useFonts({ Tajawal_800ExtraBold });
  const { isDark } = useAppTheme();
  const P = isDark
    ? { bg: '#05010A', step: '#E9D5FF', hint: '#6B5B8A', panel: 'rgba(5,1,10,0.92)', title: '#E8E0F0', sub: '#8A7AA8', input: '#1A1030' }
    : { bg: '#FAF9FF', step: '#4C1D95', hint: '#8A7AA8', panel: 'rgba(255,255,255,0.95)', title: '#1E1B2E', sub: '#6B5B8A', input: '#F3F0FA' };
  const { setAuth } = useTwinStore();
  const lang = detectUserLanguage();
  const t = TEXTS[lang];
  const [step, setStep] = useState('');
  const [showIdentity, setShowIdentity] = useState(false);
  const [touchActive, setTouchActive] = useState(false);
  const isMounted = useRef(true);
  const stepO = useSharedValue(0);
  const identityO = useSharedValue(0);
  const liftY = useDerivedValue(() => -identityO.value * 240);
  const stepStyle = useAnimatedStyle(() => ({ opacity: stepO.value }));
  const identityStyle = useAnimatedStyle(() => ({ opacity: identityO.value, transform: [{ translateY: interpolate(identityO.value, [0, 1], [50, 0], Extrapolate.CLAMP) }] }));
  const tryPlay = useCallback((e: string) => { try { audioMixer.playEffect(e); } catch {} }, []);
  const flash = useCallback((txt: string) => {
    setStep(txt);
    stepO.value = withSequence(withTiming(1, { duration: 350 }), withTiming(1, { duration: 900 }), withTiming(0, { duration: 450 }));
  }, []);
  useEffect(() => {
    isMounted.current = true;
    const seq = async () => {
      stateBus.patch({ energy: 0.5 }); tryPlay('first_breath');
      await new Promise(r => setTimeout(r, 1400));
      if (!isMounted.current) return;
      stateBus.patch({ curiosity: 0.6, focus: 0.5 }); tryPlay('eyes_open'); flash(t.woke);
      await new Promise(r => setTimeout(r, 1900));
      if (!isMounted.current) return;
      stateBus.patch({ focus: 0.8, curiosity: 0.75 }); flash(t.whoAreYou);
      await new Promise(r => setTimeout(r, 1900));
      if (!isMounted.current) return;
      stateBus.patch({ connection: 0.85, emotionValence: 0.7 }); flash(t.iSeeYou); tryPlay('bond_pulse');
      await new Promise(r => setTimeout(r, 1200));
      stateBus.patch({ emotionValence: 0.2 });
      await new Promise(r => setTimeout(r, 700));
      if (!isMounted.current) return;
      setShowIdentity(true);
      identityO.value = withTiming(1, { duration: 800 });
    };
    setTimeout(() => { try { sensorBridge.start(); } catch {} }, 3000);
    seq();
    return () => { isMounted.current = false; };
  }, []);
  const handleTouch = useCallback(() => {
    if (!touchActive) {
      setTouchActive(true);
      presenceBridge.touch();
      stateBus.patch({ connection: Math.min(1, stateBus.getState().connection + 0.1) });
      tryPlay('bond_pulse');
    }
  }, [touchActive]);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false); const [authError, setAuthError] = useState('');
  const enter = useCallback((userId: string) => { setAuth(userId); tryPlay('celebrate'); setTimeout(() => router.replace('/living-world'), 300); }, [setAuth]);
  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) return;
    setAuthLoading(true); setAuthError('');
    try { const d = await authService.login(email.trim(), password); enter(d.user_id); }
    catch (e: any) { setAuthError(errMsg(e)); } finally { setAuthLoading(false); }
  };
  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) return;
    setAuthLoading(true); setAuthError('');
    try { const d = await authService.signup(email.trim(), password, lang === 'ar' ? 'توأمك' : 'MyTwin', lang); enter(d.user_id); }
    catch (e: any) { setAuthError(errMsg(e)); } finally { setAuthLoading(false); }
  };
  if (!fontsLoaded) return null;
  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: P.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar hidden />
      <TouchableWithoutFeedback onPress={handleTouch}>
        <Animated.View style={[styles.entityWrap, { transform: [{ translateY: liftY }] }]}>
          <ConsciousBeing size={Math.min(height * 0.5, 400)} />
        </Animated.View>
      </TouchableWithoutFeedback>
      {step ? <Animated.Text style={[styles.step, stepStyle, { color: P.step, textShadowColor: isDark ? '#A855F7' : '#7C3AED' }]}>{step}</Animated.Text> : null}
      {!touchActive && !showIdentity && <Text style={[styles.touchHint, { color: P.hint }]}>{t.touchHint}</Text>}
      {showIdentity && (
        <Animated.View style={[styles.panel, identityStyle, { backgroundColor: P.panel, borderColor: isDark ? '#A855F720' : '#7C3AED20' }]} entering={FadeIn.duration(800)}>
          <Text style={[styles.title, { color: P.title }]}>{t.knowMe}</Text>
          <Text style={[styles.subtitle, { color: P.sub }]}>{t.identitySubtitle}</Text>
          <TouchableOpacity style={[styles.authBtn, { borderColor: '#94A3B830', opacity: 0.45 }]} disabled>
            <Chrome size={22} stroke="#94A3B8" /><Text style={[styles.authBtnText, { color: '#94A3B8' }]}>{lang === 'ar' ? 'Google — قريبًا' : 'Google — soon'}</Text>
          </TouchableOpacity>
          <TextInput style={[styles.input, { backgroundColor: P.input, borderColor: '#A855F740', color: P.title }]} placeholder={t.emailPlaceholder} placeholderTextColor={P.sub} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={[styles.input, { backgroundColor: P.input, borderColor: '#A855F740', color: P.title }]} placeholder={t.passwordPlaceholder} placeholderTextColor={P.sub} value={password} onChangeText={setPassword} secureTextEntry />
          {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
          <TouchableOpacity style={[styles.authBtn, { borderColor: '#A855F740' }]} onPress={handleEmailAuth} disabled={authLoading}><Mail size={22} stroke="#A855F7" /><Text style={[styles.authBtnText, { color: '#A855F7' }]}>{t.signIn}</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.authBtn, { borderColor: '#10B98140' }]} onPress={handleSignup} disabled={authLoading}><UserPlus size={22} stroke="#10B981" /><Text style={[styles.authBtnText, { color: '#10B981' }]}>{t.createAccount}</Text></TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 12 }} onPress={() => router.push('/forgot-password')}><Text style={[styles.forgotText, { color: '#A855F7' }]}>{t.forgotPassword}</Text></TouchableOpacity>
          <View style={styles.privacyRow}><Shield size={14} stroke={P.sub} /><Text style={[styles.privacyText, { color: P.sub }]}>{t.privacy}</Text></View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  entityWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.7, alignItems: 'center', justifyContent: 'center' },
  step: { position: 'absolute', top: height * 0.66, alignSelf: 'center', fontSize: 30, fontWeight: '800', letterSpacing: 2, textAlign: 'center', fontFamily: 'Tajawal_800ExtraBold', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16 },
  touchHint: { position: 'absolute', top: height * 0.72, alignSelf: 'center', fontSize: 14, fontWeight: '200', opacity: 0.6 },
  panel: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 28, paddingBottom: 46, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 6, textAlign: 'center', fontFamily: 'Tajawal_800ExtraBold' },
  subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  authBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, marginBottom: 10 },
  authBtnText: { fontSize: 15, fontWeight: '700' },
  input: { borderRadius: 14, padding: 14, fontSize: 16, borderWidth: 1, marginBottom: 10 },
  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  forgotText: { fontSize: 13, textAlign: 'center' },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, justifyContent: 'center' },
  privacyText: { fontSize: 11 },
});
