import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Dimensions, TouchableWithoutFeedback } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, useDerivedValue, withTiming, withSequence, withRepeat, withSpring, Easing, runOnJS, FadeIn, interpolate, useFrameCallback, Extrapolate } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Canvas, Circle, Path, Paint, RadialGradient, LinearGradient, vec } from '@shopify/react-native-skia';
import { Chrome, Mail, Shield, UserPlus } from 'lucide-react-native';
import { useFonts } from 'expo-font';
import { Tajawal_800ExtraBold } from '@expo-google-fonts/tajawal';
import { useTwinStore } from '../store/useTwinStore';
import { authService } from '../src/services/authService';
import { useAppTheme } from '../engine/colors';
import { audioMixer } from '../src/core/AudioMixer';
import { sensorBridge } from '../src/core/SensorBridge';
import { lifeRhythmEngine } from '../engine/life/LifeRhythmEngine';
import { detectUserLanguage, SupportedLanguage } from '../src/utils/languageDetector';
const { width, height } = Dimensions.get('window');
const CX = width / 2, CY = height * 0.38;
const TEXTS: Record<SupportedLanguage, Record<string, string>> = {
  ar: { firstSight: 'إنه هنا...', observingYou: 'أراقبك...', curiosity: 'من أنت؟', needIdentity: 'أحتاج أن أعرفك.', identitySubtitle: 'لأعرفك. لأتذكرك. لأكون لك.', emailPlaceholder: 'البريد الإلكتروني', passwordPlaceholder: 'كلمة المرور', signIn: 'تسجيل الدخول', createAccount: 'إنشاء حساب جديد', forgotPassword: 'نسيت كلمة المرور؟', privacy: 'لن أشارك وجودك مع أحد.', touchHint: 'المس الشاشة إذا شعرت بي...' },
  en: { firstSight: 'It is here...', observingYou: 'Observing you...', curiosity: 'Who are you?', needIdentity: 'I need to know you.', identitySubtitle: 'To know you. To remember you. To be yours.', emailPlaceholder: 'Email', passwordPlaceholder: 'Password', signIn: 'Sign In', createAccount: 'Create Account', forgotPassword: 'Forgot Password?', privacy: 'I will never share your existence.', touchHint: 'Touch the screen if you feel me...' },
};
const noise = (x: number, y: number, s: number) => { 'worklet'; const n = Math.sin(x * 12.9898 + y * 78.233 + s * 43758.5453) * 43758.5453; return n - Math.floor(n); };
const fbm = (x: number, y: number, s: number) => { 'worklet'; let v = 0, a = 0.5, f = 1; for (let i = 0; i < 2; i++) { v += a * noise(x * f, y * f, s + i); a *= 0.5; f *= 2; } return v; };
const genMembrane = (t: number, R: number, breath: number, pulse: number, touch: number) => {
  'worklet';
  if (R <= 0) return '';
  const pts = 36; const xs: number[] = []; const ys: number[] = [];
  for (let i = 0; i < pts; i++) {
    const ang = (i / pts) * Math.PI * 2;
    const org = Math.sin(ang * 3 + t * 0.7) * 0.22 + Math.cos(ang * 5 - t * 0.6) * 0.14 + Math.sin(ang * 7 + t * 1.1) * 0.1 + fbm(Math.cos(ang) * 2, t * 0.15, 42) * 0.25 + touch * Math.sin(ang * 9 + t * 6) * 0.08;
    const r = Math.max(2, R * (1 + org + breath * 0.14 + pulse * Math.sin(t * 25) * 0.04));
    xs.push(CX + Math.cos(ang) * r); ys.push(CY + Math.sin(ang) * r);
  }
  let d = 'M ' + (xs[0] + xs[1]) / 2 + ' ' + (ys[0] + ys[1]) / 2;
  for (let i = 1; i <= pts; i++) { const a = i % pts, b = (i + 1) % pts; d += ' Q ' + xs[a] + ' ' + ys[a] + ' ' + (xs[a] + xs[b]) / 2 + ' ' + (ys[a] + ys[b]) / 2; }
  return d + ' Z';
};
const genOrbit = (t: number, R: number, speed: number, seed: number, count: number) => {
  'worklet';
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = t * speed + (i / count) * Math.PI * 2;
    const wob = Math.sin(t * 0.9 + i * 1.7 + seed) * 8 + (fbm(Math.cos(a) * 1.5, t * 0.12, seed) - 0.5) * 12;
    const r = R + wob;
    d += 'M ' + (CX + Math.cos(a) * r) + ' ' + (CY + Math.sin(a) * r * 0.92) + ' l 0.9 0.9 ';
  }
  return d;
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
    ? { bg: '#05010A', p1: '#E9D5FF', p2: '#C4B5FD', coreIn: '#FFFFFF', coreMid: '#A855F7', edge: '#E9D5FF', eyeCore: '#FFFFFF', eyeHalo: '#C4B5FD', step: '#E9D5FF', hint: '#6B5B8A', panel: 'rgba(5,1,10,0.92)', title: '#E8E0F0', sub: '#8A7AA8', input: '#1A1030' }
    : { bg: '#FAF9FF', p1: '#7C3AED', p2: '#4F46E5', coreIn: '#C4B5FD', coreMid: '#7C3AED', edge: '#6D28D9', eyeCore: '#312E81', eyeHalo: '#8B5CF6', step: '#4C1D95', hint: '#8A7AA8', panel: 'rgba(255,255,255,0.95)', title: '#1E1B2E', sub: '#6B5B8A', input: '#F3F0FA' };
  const { setAuth } = useTwinStore();
  const lang = detectUserLanguage();
  const t = TEXTS[lang];
  const [consciousnessStep, setConsciousnessStep] = useState('');
  const [showIdentity, setShowIdentity] = useState(false);
  const [touchActive, setTouchActive] = useState(false);
  const isMounted = useRef(true);
  const time = useSharedValue(0);
  const entityOpacity = useSharedValue(0.25);
  const baseRadius = useSharedValue(26);
  const breathPhase = useSharedValue(0);
  const pulsePhase = useSharedValue(0);
  const touchWave = useSharedValue(0);
  const eyeO = useSharedValue(0);
  const eyeScale = useSharedValue(1);
  const blink = useSharedValue(0);
  const gX = useSharedValue(0); const gY = useSharedValue(-1);
  const orbitsO = useSharedValue(0);
  const stepOpacity = useSharedValue(0);
  const identityOpacity = useSharedValue(0);
  useFrameCallback((fi) => { time.value = fi.timeSinceFirstFrame; });
  useEffect(() => {
    breathPhase.value = withRepeat(withSequence(withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 3500, easing: Easing.inOut(Easing.sin) })), -1, true);
    pulsePhase.value = withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 600 })), -1, true);
  }, []);
  const membrane = useDerivedValue(() => genMembrane(time.value * 0.001, baseRadius.value, breathPhase.value, pulsePhase.value, touchWave.value));
  const orbitA = useDerivedValue(() => genOrbit(time.value * 0.001, baseRadius.value + 62, 0.25, 7, 52));
  const orbitB = useDerivedValue(() => genOrbit(time.value * 0.001, baseRadius.value + 84, -0.18, 29, 52));
  const eyeLX = useDerivedValue(() => CX - 15 + gX.value);
  const eyeRX = useDerivedValue(() => CX + 15 + gX.value * 0.8);
  const eyeY = useDerivedValue(() => CY - 6 + gY.value);
  const haloR = useDerivedValue(() => 8 * eyeScale.value * (1 - blink.value * 0.85));
  const coreR = useDerivedValue(() => 3.4 * eyeScale.value * (1 - blink.value * 0.9));
  const stepStyle = useAnimatedStyle(() => ({ opacity: stepOpacity.value }));
  const identityStyle = useAnimatedStyle(() => ({ opacity: identityOpacity.value, transform: [{ translateY: interpolate(identityOpacity.value, [0, 1], [50, 0], Extrapolate.CLAMP) }] }));
  const tryPlay = useCallback((e: string) => { try { audioMixer.playEffect(e); } catch {} }, []);
  useEffect(() => {
    isMounted.current = true;
    let eyeIv: ReturnType<typeof setInterval> | null = null;
    const blinkIv = setInterval(() => { blink.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 130 })); }, 3400);
    const sequence = async () => {
      entityOpacity.value = withTiming(0.6, { duration: 1000 });
      baseRadius.value = withTiming(44, { duration: 1200 });
      tryPlay('first_breath');
      await new Promise(r => setTimeout(r, 1500));
      if (!isMounted.current) return;
      runOnJS(setConsciousnessStep)(t.firstSight);
      stepOpacity.value = withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 900 }));
      entityOpacity.value = withTiming(0.92, { duration: 600 });
      orbitsO.value = withTiming(0.75, { duration: 900 });
      eyeO.value = withTiming(1, { duration: 800 });
      tryPlay('eyes_open');
      await new Promise(r => setTimeout(r, 2000));
      if (!isMounted.current) return;
      runOnJS(setConsciousnessStep)(t.observingYou);
      stepOpacity.value = withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 900 }));
      eyeIv = setInterval(() => {
        gX.value = withTiming((Math.random() - 0.5) * 10, { duration: 800 });
        gY.value = withTiming((Math.random() - 0.5) * 6, { duration: 1000 });
      }, 1500);
      await new Promise(r => setTimeout(r, 4000));
      if (!isMounted.current) return;
      if (eyeIv) clearInterval(eyeIv);
      runOnJS(setConsciousnessStep)(t.curiosity);
      stepOpacity.value = withTiming(1, { duration: 600 });
      eyeScale.value = withTiming(1.25, { duration: 500 });
      gX.value = withTiming(0, { duration: 600 }); gY.value = withTiming(-2, { duration: 600 });
      tryPlay('thinking_start');
      await new Promise(r => setTimeout(r, 3000));
      if (!isMounted.current) return;
      runOnJS(setConsciousnessStep)(t.needIdentity);
      stepOpacity.value = withTiming(0.92, { duration: 1000 });
      await new Promise(r => setTimeout(r, 2000));
      if (!isMounted.current) return;
      runOnJS(setShowIdentity)(true);
      identityOpacity.value = withTiming(1, { duration: 800 });
      stepOpacity.value = withTiming(0, { duration: 400 });
    };
    setTimeout(() => { try { sensorBridge.start(); } catch {} try { lifeRhythmEngine.start(); } catch {} }, 3000);
    sequence();
    return () => { isMounted.current = false; if (eyeIv) clearInterval(eyeIv); clearInterval(blinkIv); };
  }, []);
  const handleTouch = useCallback(() => {
    if (!touchActive) {
      setTouchActive(true);
      touchWave.value = withTiming(1, { duration: 400 });
      eyeScale.value = withSequence(withTiming(1.35, { duration: 150 }), withTiming(1, { duration: 450 }));
      tryPlay('bond_pulse');
      setTimeout(() => { touchWave.value = withTiming(0, { duration: 600 }); }, 800);
    }
  }, [touchActive]);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false); const [authError, setAuthError] = useState('');
  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) return;
    setAuthLoading(true); setAuthError('');
    try { const d = await authService.login(email.trim(), password); setAuth(d.user_id); tryPlay('celebrate'); }
    catch (e: any) { setAuthError(errMsg(e)); } finally { setAuthLoading(false); }
  };
  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) return;
    setAuthLoading(true); setAuthError('');
    try { const d = await authService.signup(email.trim(), password, lang === 'ar' ? 'توأمك' : 'MyTwin', lang); setAuth(d.user_id); tryPlay('celebrate'); }
    catch (e: any) { setAuthError(errMsg(e)); } finally { setAuthLoading(false); }
  };
  if (!fontsLoaded) return null;
  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: P.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar hidden />
      <TouchableWithoutFeedback onPress={handleTouch}>
        <View style={styles.entityContainer}>
          <Canvas style={{ width, height: height * 0.8 }}>
            <Path path={membrane} opacity={entityOpacity} style="fill">
              <RadialGradient c={vec(CX, CY)} r={baseRadius.value * 2.6} colors={[P.coreIn, P.coreMid, '#00000000']} />
            </Path>
            <Path path={membrane} color={P.edge} style="stroke" strokeWidth={1.4} opacity={entityOpacity} />
            <Path path={orbitA} opacity={orbitsO}><Paint style="stroke" strokeWidth={2.2} strokeCap="round"><LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={[P.p1, P.p2]} /></Paint></Path>
            <Path path={orbitB} opacity={orbitsO}><Paint style="stroke" strokeWidth={1.8} strokeCap="round"><LinearGradient start={vec(width, 0)} end={vec(0, height)} colors={[P.p2, P.p1]} /></Paint></Path>
            <Circle cx={eyeLX} cy={eyeY} r={haloR} opacity={eyeO}><RadialGradient c={vec(CX - 15, CY - 6)} r={haloR} colors={[P.eyeHalo, '#00000000']} /></Circle>
            <Circle cx={eyeRX} cy={eyeY} r={haloR} opacity={eyeO}><RadialGradient c={vec(CX + 15, CY - 6)} r={haloR} colors={[P.eyeHalo, '#00000000']} /></Circle>
            <Circle cx={eyeLX} cy={eyeY} r={coreR} color={P.eyeCore} opacity={eyeO} />
            <Circle cx={eyeRX} cy={eyeY} r={coreR} color={P.eyeCore} opacity={eyeO} />
            <Circle cx={eyeLX} cy={eyeY} r={1.1} color="#FFFFFF" opacity={eyeO} />
            <Circle cx={eyeRX} cy={eyeY} r={1.1} color="#FFFFFF" opacity={eyeO} />
          </Canvas>
        </View>
      </TouchableWithoutFeedback>
      {consciousnessStep ? <Animated.Text style={[styles.consciousnessStep, stepStyle, { color: P.step, textShadowColor: P.coreMid }]}>{consciousnessStep}</Animated.Text> : null}
      {!touchActive && <Text style={[styles.touchHint, { color: P.hint }]}>{t.touchHint}</Text>}
      {showIdentity && (
        <Animated.View style={[styles.identityContainer, identityStyle, { backgroundColor: P.panel, borderColor: isDark ? '#A855F720' : '#7C3AED20' }]} entering={FadeIn.duration(800)}>
          <Text style={[styles.identityTitle, { color: P.title }]}>{t.needIdentity}</Text>
          <Text style={[styles.identitySubtitle, { color: P.sub }]}>{t.identitySubtitle}</Text>
          <TouchableOpacity style={[styles.authBtn, { borderColor: '#94A3B830', opacity: 0.45 }]} disabled>
            <Chrome size={22} stroke="#94A3B8" />
            <Text style={[styles.authBtnText, { color: '#94A3B8' }]}>{lang === 'ar' ? 'Google — قريبًا' : 'Google — soon'}</Text>
          </TouchableOpacity>
          <View style={styles.emailForm}>
            <TextInput style={[styles.input, { backgroundColor: P.input, borderColor: '#A855F740', color: P.title }]} placeholder={t.emailPlaceholder} placeholderTextColor={P.sub} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={[styles.input, { backgroundColor: P.input, borderColor: '#A855F740', color: P.title }]} placeholder={t.passwordPlaceholder} placeholderTextColor={P.sub} value={password} onChangeText={setPassword} secureTextEntry />
            {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
            <TouchableOpacity style={[styles.authBtn, { borderColor: '#A855F740' }]} onPress={handleEmailAuth} disabled={authLoading}><Mail size={22} stroke="#A855F7" /><Text style={[styles.authBtnText, { color: '#A855F7' }]}>{t.signIn}</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.authBtn, { borderColor: '#10B98140' }]} onPress={handleSignup} disabled={authLoading}><UserPlus size={22} stroke="#10B981" /><Text style={[styles.authBtnText, { color: '#10B981' }]}>{t.createAccount}</Text></TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 12 }} onPress={() => router.push('/forgot-password')}><Text style={[styles.forgotText, { color: '#A855F7' }]}>{t.forgotPassword}</Text></TouchableOpacity>
          </View>
          <View style={styles.privacyRow}><Shield size={14} stroke={P.sub} /><Text style={[styles.privacyText, { color: P.sub }]}>{t.privacy}</Text></View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  entityContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  consciousnessStep: { position: 'absolute', bottom: '30%', alignSelf: 'center', fontSize: 27, fontWeight: '800', letterSpacing: 2, textAlign: 'center', fontFamily: 'Tajawal_800ExtraBold', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16 },
  touchHint: { position: 'absolute', bottom: '25%', alignSelf: 'center', fontSize: 14, fontWeight: '200', opacity: 0.6 },
  identityContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 32, paddingBottom: 50, borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1 },
  identityTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8, textAlign: 'center', fontFamily: 'Tajawal_800ExtraBold' },
  identitySubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  authBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, marginBottom: 10 },
  authBtnText: { fontSize: 15, fontWeight: '700' },
  emailForm: { width: '100%' },
  input: { borderRadius: 14, padding: 14, fontSize: 16, borderWidth: 1, marginBottom: 10 },
  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  forgotText: { fontSize: 13, textAlign: 'center' },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, justifyContent: 'center' },
  privacyText: { fontSize: 11 },
});
