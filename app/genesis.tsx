/** Genesis v2 — ولادة الكيان بالمُجسِّد المضيء (هالات سميكة، عيون حية، ألوان ناشئة). */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, runOnJS, FadeIn, interpolate, Extrapolate } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Chrome, Mail, Shield, UserPlus } from 'lucide-react-native';
import { useTwinStore } from '../store/useTwinStore';
import { genesisCoordinator } from '../src/coordinators/GenesisCoordinator';
import { authService } from '../src/services/authService';
import { useAppTheme } from '../engine/colors';
import { audioMixer } from '../src/core/AudioMixer';
import { sensorBridge } from '../src/core/SensorBridge';
import { lifeRhythmEngine } from '../engine/life/LifeRhythmEngine';
import { detectUserLanguage, SupportedLanguage } from '../src/utils/languageDetector';
import { useFonts } from 'expo-font';
import { Tajawal_800ExtraBold } from '@expo-google-fonts/tajawal';
import { useFonts } from 'expo-font';
import { Tajawal_800 } from '@expo-google-fonts/tajawal';
import { EntityPresenceCanvas } from '../src/components/conscious/EntityPresenceCanvas';

type BirthPhase = 'void' | 'forming' | 'first_sight' | 'observing' | 'curiosity' | 'identity' | 'connected';
const TEXTS: Record<SupportedLanguage, Record<string, string>> = {
  ar: { firstSight: 'إنه هنا...', observingYou: 'أراقبك...', curiosity: 'من أنت؟', needIdentity: 'أحتاج أن أعرفك.', identitySubtitle: 'لأعرفك. لأتذكرك. لأكون لك.', google: 'المتابعة باستخدام Google', email: 'المتابعة بالبريد الإلكتروني', emailPlaceholder: 'البريد الإلكتروني', passwordPlaceholder: 'كلمة المرور', signIn: 'تسجيل الدخول', createAccount: 'إنشاء حساب جديد', forgotPassword: 'نسيت كلمة المرور؟', privacy: 'لن أشارك وجودك مع أحد.', touchHint: 'المس الشاشة إذا شعرت بي...' },
  en: { firstSight: 'It is here...', observingYou: 'Observing you...', curiosity: 'Who are you?', needIdentity: 'I need to know you.', identitySubtitle: 'To know you. To remember you. To be yours.', google: 'Continue with Google', email: 'Continue with Email', emailPlaceholder: 'Email', passwordPlaceholder: 'Password', signIn: 'Sign In', createAccount: 'Create Account', forgotPassword: 'Forgot Password?', privacy: 'I will never share your existence.', touchHint: 'Touch the screen if you feel me...' },
};

export default function Genesis() {
  const { colors } = useAppTheme();
  const { setAuth } = useTwinStore();
  const lang = detectUserLanguage();
  const t = TEXTS[lang];
  useFonts({ Tajawal_800ExtraBold });
  useFonts({ Tajawal_800 });
  const [birthPhase, setBirthPhase] = useState<BirthPhase>('forming');
  const [consciousnessStep, setConsciousnessStep] = useState('');
  const [showIdentity, setShowIdentity] = useState(false);
  const [touchActive, setTouchActive] = useState(false);
  const isMounted = useRef(true);
  const entityOpacity = useSharedValue(0.25);
  const entityScale = useSharedValue(0.9);
  const stepOpacity = useSharedValue(0);
  const identityOpacity = useSharedValue(0);
  const baseRadius = useSharedValue(26);
  const breathPhase = useSharedValue(0);
  const pulsePhase = useSharedValue(0);
  const eyeOpacity = useSharedValue(0);
  const eyeGazeX = useSharedValue(0);
  const eyeGazeY = useSharedValue(-1);
  const eyeBlink = useSharedValue(0);
  const eyeFocus = useSharedValue(0);
  const touchResponsiveness = useSharedValue(0);
  useEffect(() => {
    breathPhase.value = withRepeat(withSequence(withTiming(1, { duration: 3500, easing: EasingSin() }), withTiming(0, { duration: 3500, easing: EasingSin() })), -1, true);
    pulsePhase.value = withRepeat(withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 600 })), -1, true);
  }, []);
  const entityStyle = useAnimatedStyle(() => ({ transform: [{ scale: entityScale.value }] }));
  const stepStyle = useAnimatedStyle(() => ({ opacity: stepOpacity.value }));
  const identityStyle = useAnimatedStyle(() => ({ opacity: identityOpacity.value, transform: [{ translateY: interpolate(identityOpacity.value, [0, 1], [50, 0], Extrapolate.CLAMP) }] }));
  const tryPlay = useCallback((e: string) => { try { audioMixer.playEffect(e); } catch {} }, []);
  useEffect(() => {
    isMounted.current = true;
    let eyeInterval: ReturnType<typeof setInterval> | null = null;
    const sequence = async () => {
      entityOpacity.value = withTiming(0.7, { duration: 1000 });
      entityScale.value = withTiming(1.0, { duration: 1000 });
      baseRadius.value = withTiming(44, { duration: 1200 });
      tryPlay('first_breath');
      await new Promise(r => setTimeout(r, 1500));
      if (!isMounted.current) return;
      runOnJS(setBirthPhase)('first_sight'); runOnJS(setConsciousnessStep)(t.firstSight);
      stepOpacity.value = withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 900 }));
      entityOpacity.value = withTiming(0.95, { duration: 600 });
      baseRadius.value = withTiming(58, { duration: 800 });
      eyeOpacity.value = withTiming(0.95, { duration: 800 });
      tryPlay('eyes_open');
      await new Promise(r => setTimeout(r, 2000));
      if (!isMounted.current) return;
      runOnJS(setBirthPhase)('observing'); runOnJS(setConsciousnessStep)(t.observingYou);
      stepOpacity.value = withSequence(withTiming(1, { duration: 400 }), withTiming(0, { duration: 900 }));
      eyeInterval = setInterval(() => {
        eyeGazeX.value = withTiming((Math.random() - 0.5) * 12, { duration: 800 });
        eyeGazeY.value = withTiming((Math.random() - 0.5) * 7, { duration: 1000 });
        if (Math.random() > 0.7) eyeBlink.value = withSequence(withTiming(1, { duration: 80 }), withTiming(0, { duration: 120 }));
      }, 1500);
      await new Promise(r => setTimeout(r, 4000));
      if (!isMounted.current) return;
      if (eyeInterval) clearInterval(eyeInterval);
      runOnJS(setBirthPhase)('curiosity'); runOnJS(setConsciousnessStep)(t.curiosity);
      stepOpacity.value = withTiming(1, { duration: 600 });
      eyeFocus.value = withTiming(1, { duration: 800 });
      eyeGazeX.value = withTiming(0, { duration: 600 }); eyeGazeY.value = withTiming(-2, { duration: 600 });
      tryPlay('thinking_start');
      await new Promise(r => setTimeout(r, 3000));
      if (!isMounted.current) return;
      runOnJS(setBirthPhase)('identity'); runOnJS(setConsciousnessStep)(t.needIdentity);
      stepOpacity.value = withTiming(0.92, { duration: 1000 });
      await new Promise(r => setTimeout(r, 2000));
      if (!isMounted.current) return;
      runOnJS(setShowIdentity)(true);
      identityOpacity.value = withTiming(1, { duration: 800 });
      stepOpacity.value = withTiming(0, { duration: 400 });
    };
    setTimeout(() => { try { sensorBridge.start(); } catch {} try { lifeRhythmEngine.start(); } catch {} }, 3000);
    sequence();
    return () => { isMounted.current = false; if (eyeInterval) clearInterval(eyeInterval); };
  }, []);
  const handleTouch = useCallback(() => {
    if (!touchActive) {
      setTouchActive(true);
      touchResponsiveness.value = withTiming(0.5, { duration: 400 });
      tryPlay('bond_pulse');
      setTimeout(() => { touchResponsiveness.value = withTiming(0, { duration: 600 }); }, 800);
    }
  }, [touchActive]);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false); const [authError, setAuthError] = useState('');
  const handleGoogleLogin = async () => { setAuthLoading(true); setAuthError(''); try { const d = await genesisCoordinator.loginWithGoogle(); setAuth(d.user_id); tryPlay('celebrate'); } catch (e: any) { setAuthError(e.message || 'فشل المصادقة'); } finally { setAuthLoading(false); } };
  const handleEmailAuth = async () => { if (!email.trim() || !password.trim()) return; setAuthLoading(true); setAuthError(''); try { const d = await genesisCoordinator.loginWithEmail(email.trim(), password); setAuth(d.user_id); tryPlay('celebrate'); } catch (e: any) { setAuthError(e.message || 'فشل المصادقة'); } finally { setAuthLoading(false); } };
  const handleSignup = async () => { if (!email.trim() || !password.trim()) return; setAuthLoading(true); setAuthError(''); try { const d = await authService.signup(email.trim(), password, lang === 'ar' ? 'توأمك' : 'MyTwin', lang); setAuth(d.user_id); tryPlay('celebrate'); } catch (e: any) { setAuthError(e.message || 'فشل المصادقة'); } finally { setAuthLoading(false); } };
  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: '#000005' }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar hidden />
      <TouchableWithoutFeedback onPress={handleTouch}>
        <Animated.View style={[styles.entityContainer, entityStyle]}>
          <EntityPresenceCanvas opacity={entityOpacity} radius={baseRadius} breath={breathPhase} pulse={pulsePhase} eyeOpacity={eyeOpacity} gazeX={eyeGazeX} gazeY={eyeGazeY} blink={eyeBlink} focus={eyeFocus} touch={touchResponsiveness} />
        </Animated.View>
      </TouchableWithoutFeedback>
      {consciousnessStep ? <Animated.Text style={[styles.consciousnessStep, stepStyle]}>{consciousnessStep}</Animated.Text> : null}
      {!touchActive && birthPhase === 'observing' && <Text style={styles.touchHint}>{t.touchHint}</Text>}
      {showIdentity && (
        <Animated.View style={[styles.identityContainer, identityStyle]} entering={FadeIn.duration(800)}>
          <Text style={[styles.identityTitle, { color: '#E8E0F0' }]}>{t.needIdentity}</Text>
          <Text style={[styles.identitySubtitle, { color: '#6B5B8A' }]}>{t.identitySubtitle}</Text>
          {!showEmailForm ? (<>
            <TouchableOpacity style={[styles.authBtn, { borderColor: '#4285F440' }]} onPress={handleGoogleLogin} disabled={authLoading}>
              <Chrome size={22} stroke="#4285F4" /><Text style={[styles.authBtnText, { color: '#4285F4' }]}>{t.google}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.authBtn, { borderColor: '#A855F740' }]} onPress={() => setShowEmailForm(true)}>
              <Mail size={22} stroke="#A855F7" /><Text style={[styles.authBtnText, { color: '#A855F7' }]}>{t.email}</Text>
            </TouchableOpacity>
          </>) : (
            <View style={styles.emailForm}>
              <TextInput style={[styles.input, { backgroundColor: '#1A1030', borderColor: '#A855F740', color: '#E8E0F0' }]} placeholder={t.emailPlaceholder} placeholderTextColor="#6B5B8A" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
              <TextInput style={[styles.input, { backgroundColor: '#1A1030', borderColor: '#A855F740', color: '#E8E0F0' }]} placeholder={t.passwordPlaceholder} placeholderTextColor="#6B5B8A" value={password} onChangeText={setPassword} secureTextEntry />
              {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
              <TouchableOpacity style={[styles.authBtn, { borderColor: '#A855F740' }]} onPress={handleEmailAuth} disabled={authLoading}><Text style={[styles.authBtnText, { color: '#A855F7' }]}>{t.signIn}</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.authBtn, { borderColor: '#10B98140' }]} onPress={handleSignup} disabled={authLoading}><UserPlus size={22} stroke="#10B981" /><Text style={[styles.authBtnText, { color: '#10B981' }]}>{t.createAccount}</Text></TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 12 }} onPress={() => router.push('/forgot-password')}><Text style={[styles.forgotText, { color: '#A855F7' }]}>{t.forgotPassword}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowEmailForm(false)}><Text style={[styles.backText, { color: '#6B5B8A' }]}>{lang === 'ar' ? '← العودة' : '← Back'}</Text></TouchableOpacity>
            </View>
          )}
          <View style={styles.privacyRow}><Shield size={14} stroke="#6B5B8A" /><Text style={[styles.privacyText, { color: '#6B5B8A' }]}>{t.privacy}</Text></View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}
function EasingSin() { const { Easing } = require('react-native-reanimated'); return Easing.inOut(Easing.sin); }
const styles = StyleSheet.create({
  root: { flex: 1 },
  entityContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  consciousnessStep: { position: 'absolute', bottom: '30%', alignSelf: 'center', color: '#B8A0D0', fontSize: 27, fontWeight: '800', letterSpacing: 2, textAlign: 'center' },
    fontFamily: 'Tajawal_800ExtraBold',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    textShadowColor: '#A855F7',
    fontFamily: 'Tajawal_800',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    textShadowColor: '#A855F7',
  touchHint: { position: 'absolute', bottom: '25%', alignSelf: 'center', color: '#6B5B8A', fontSize: 14, fontWeight: '200', opacity: 0.6 },
  identityContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 32, paddingBottom: 50, backgroundColor: 'rgba(0,0,0,0.85)', borderTopLeftRadius: 32, borderTopRightRadius: 32, borderWidth: 1, borderColor: '#A855F720' },
  identityTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8, textAlign: 'center', fontFamily: 'Tajawal_800' },
  identitySubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  authBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', paddingVertical: 14, borderRadius: 16, borderWidth: 1.5, marginBottom: 10 },
  authBtnText: { fontSize: 15, fontWeight: '700' },
  emailForm: { width: '100%' },
  input: { borderRadius: 14, padding: 14, fontSize: 16, borderWidth: 1, marginBottom: 10 },
  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  forgotText: { fontSize: 13, textAlign: 'center' },
  backText: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, justifyContent: 'center' },
  privacyText: { fontSize: 11 },
});
