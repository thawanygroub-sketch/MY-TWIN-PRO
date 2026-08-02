import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Dimensions,
  TouchableWithoutFeedback,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, useDerivedValue,
  withTiming, withSequence, withRepeat, withDelay,
  Easing, runOnJS, FadeIn, interpolate,
  useFrameCallback, Extrapolate,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { Canvas, Circle, Path, Group, Paint, BlurMask, Rect, RadialGradient, vec } from "@shopify/react-native-skia";
import { Chrome, Mail, Shield, UserPlus, Eye, EyeOff } from 'lucide-react-native';
import { useTwinStore } from '../store/useTwinStore';
import { genesisCoordinator } from '../src/coordinators/GenesisCoordinator';
import { authService } from '../src/services/authService';
import { useAppTheme } from '../engine/colors';
import { audioMixer } from '../src/core/AudioMixer';
import { sensorBridge } from '../src/core/SensorBridge';
import { lifeRhythmEngine } from '../engine/life/LifeRhythmEngine';
import { detectUserLanguage, SupportedLanguage } from '../src/utils/languageDetector';

const { width, height } = Dimensions.get('window');
const CX = width / 2;
const CY = height * 0.38;

/* ═══════════════════════════════════════════════════════════════
   1.  الأنواع والنصوص
   ═══════════════════════════════════════════════════════════════ */
type BirthPhase = 'void' | 'forming' | 'first_sight' | 'observing' | 'curiosity' | 'identity' | 'connected';

const TEXTS: Record<SupportedLanguage, Record<string, string>> = {
  ar: {
    firstSight: 'إنه هنا...',
    observingYou: 'أراقبك...',
    curiosity: 'من أنت؟',
    needIdentity: 'أحتاج أن أعرفك.',
    identitySubtitle: 'لأعرفك. لأتذكرك. لأكون لك.',
    google: 'المتابعة باستخدام Google',
    email: 'المتابعة بالبريد الإلكتروني',
    emailPlaceholder: 'البريد الإلكتروني',
    passwordPlaceholder: 'كلمة المرور',
    signIn: 'تسجيل الدخول',
    createAccount: 'إنشاء حساب جديد',
    forgotPassword: 'نسيت كلمة المرور؟',
    privacy: 'لن أشارك وجودك مع أحد.',
    touchHint: 'المس الشاشة إذا شعرت بي...',
  },
  en: {
    firstSight: 'It is here...',
    observingYou: 'Observing you...',
    curiosity: 'Who are you?',
    needIdentity: 'I need to know you.',
    identitySubtitle: 'To know you. To remember you. To be yours.',
    google: 'Continue with Google',
    email: 'Continue with Email',
    emailPlaceholder: 'Email',
    passwordPlaceholder: 'Password',
    signIn: 'Sign In',
    createAccount: 'Create Account',
    forgotPassword: 'Forgot Password?',
    privacy: 'I will never share your existence.',
    touchHint: 'Touch the screen if you feel me...',
  },
};

/* ═══════════════════════════════════════════════════════════════
   2.  مولدات المسارات (Worklets خالصة — لا React State)
   ═══════════════════════════════════════════════════════════════ */
const fbm = (x: number, y: number, seed: number, octaves: number = 3) => {
  'worklet';
  const noise = (nx: number, ny: number, ns: number) => {
    const n = Math.sin(nx * 12.9898 + ny * 78.233 + ns * 43758.5453) * 43758.5453;
    return n - Math.floor(n);
  };
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise(x * freq, y * freq, seed + i);
    amp *= 0.5;
    freq *= 2;
  }
  return value;
};

const generateMembranePath = (
  phase: number, baseRadius: number, breath: number, pulse: number, irregularity: number
) => {
  'worklet';
  if (baseRadius <= 0) return '';
  
  let d = '';
  const points = 60;
  const t = phase;
  
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    
    const org1 = Math.sin(angle * 3 + t * 0.7) * 0.35;
    const org2 = Math.cos(angle * 5 - t * 0.6) * 0.25;
    const org3 = Math.sin(angle * 7 + t * 1.1) * 0.2;
    const org4 = fbm(Math.cos(angle) * 2, t * 0.15, 42, 2) * 0.45;
    const breathEff = breath * 0.18;
    const tremor = pulse * Math.sin(t * 25) * 0.08;
    const noiseVal = fbm(Math.cos(angle) * 2.5, Math.sin(angle) * 2.5 + t * 0.1, 99, 2) * 0.2;
    
    const r = baseRadius * (1 + org1 + org2 + org3 + org4 + breathEff + tremor + noiseVal);
    const safeR = Math.max(2, r);
    
    const x = CX + Math.cos(angle) * safeR;
    const y = CY + Math.sin(angle) * safeR;
    
    if (i === 0) d += `M ${x} ${y}`;
    else {
      const prevAngle = ((i - 1) / points) * Math.PI * 2;
      const prevR = baseRadius * (1 + Math.sin(prevAngle * 3 + t * 0.7) * 0.35 + Math.cos(prevAngle * 5 - t * 0.6) * 0.25 + Math.sin(prevAngle * 7 + t * 1.1) * 0.2 + fbm(Math.cos(prevAngle) * 2, t * 0.15, 42, 2) * 0.45 + breathEff + tremor + fbm(Math.cos(prevAngle) * 2.5, Math.sin(prevAngle) * 2.5 + t * 0.1, 99, 2) * 0.2);
      const prevSafeR = Math.max(2, prevR);
      const prevX = CX + Math.cos(prevAngle) * prevSafeR;
      const prevY = CY + Math.sin(prevAngle) * prevSafeR;
      
      const cpx = (prevX + x) / 2 + Math.sin(t + i) * 2.5;
      const cpy = (prevY + y) / 2 + Math.cos(t + i) * 2.5;
      d += ` Q ${cpx} ${cpy} ${x} ${y}`;
    }
  }
  d += ' Z';
  return d;
};

const generateEyePath = (
  centerX: number, centerY: number, eyeWidth: number, eyeHeight: number,
  gazeX: number, gazeY: number, blink: number
) => {
  'worklet';
  const effectiveHeight = eyeHeight * (1 - blink * 0.95);
  if (effectiveHeight < 0.5) return '';
  
  const gx = gazeX;
  const gy = gazeY;
  const left = centerX - eyeWidth / 2 + gx;
  const right = centerX + eyeWidth / 2 + gx;
  const top = centerY - effectiveHeight / 2 + gy;
  const bottom = centerY + effectiveHeight / 2 + gy;
  const curveStrength = eyeWidth * 0.4;
  
  return `M ${centerX + gx} ${top} C ${right + curveStrength} ${top + effectiveHeight * 0.2}, ${right + curveStrength} ${bottom - effectiveHeight * 0.2}, ${centerX + gx} ${bottom} C ${left - curveStrength} ${bottom - effectiveHeight * 0.2}, ${left - curveStrength} ${top + effectiveHeight * 0.2}, ${centerX + gx} ${top} Z`;
};

/* ═══════════════════════════════════════════════════════════════
   3.  المكون الرئيسي — المنطق
   ═══════════════════════════════════════════════════════════════ */
export default function Genesis() {
  const { colors } = useAppTheme();
  const { setAuth } = useTwinStore();
  const lang = detectUserLanguage();
  const t = TEXTS[lang];

  const [birthPhase, setBirthPhase] = useState<BirthPhase>('forming');
  const [consciousnessStep, setConsciousnessStep] = useState('');
  const [showIdentity, setShowIdentity] = useState(false);
  const [touchActive, setTouchActive] = useState(false);
  const isMounted = useRef(true);

  // ─── Reanimated Shared Values ───
  const time = useSharedValue(0);
  const entityOpacity = useSharedValue(0.2);
  const entityScale = useSharedValue(0.9);
  const stepOpacity = useSharedValue(0);
  const identityOpacity = useSharedValue(0);
  const membranePhase = useSharedValue(0);
  const baseRadius = useSharedValue(15);
  const breathPhase = useSharedValue(0);
  const pulsePhase = useSharedValue(0);
  const eyeOpacity = useSharedValue(0);
  const eyeGazeX = useSharedValue(0);
  const eyeGazeY = useSharedValue(-1);
  const eyeBlink = useSharedValue(0);
  const eyeFocus = useSharedValue(0);
  const touchResponsiveness = useSharedValue(0);
  const enterScale = useSharedValue(1);
  const enterOpacity = useSharedValue(1);

  // ─── Frame Loop ───
  useFrameCallback((frameInfo) => {
    time.value = frameInfo.timeSinceFirstFrame;
  });

  // بدء التنفس والنبض
  useEffect(() => {
    breathPhase.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3500, easing: Easing.inOut(Easing.sin) })
      ),
      -1, true
    );
    pulsePhase.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0, { duration: 600 })
      ),
      -1, true
    );
  }, []);

  // ─── Derived Values ───
  const membranePath = useDerivedValue(() => {
    return generateMembranePath(
      time.value * 0.001, baseRadius.value, breathPhase.value,
      pulsePhase.value, touchResponsiveness.value * 5
    );
  });

  const eyePath = useDerivedValue(() => {
    return generateEyePath(
      CX, CY - 8, 30 + eyeFocus.value * 6, 14 + eyeFocus.value * 4,
      eyeGazeX.value, eyeGazeY.value, eyeBlink.value
    );
  });

  // ─── Styles ───
  const entityStyle = useAnimatedStyle(() => ({
    opacity: entityOpacity.value,
    transform: [{ scale: entityScale.value }],
  }));

  const stepStyle = useAnimatedStyle(() => ({
    opacity: stepOpacity.value,
  }));

  const identityStyle = useAnimatedStyle(() => ({
    opacity: identityOpacity.value,
    transform: [{ translateY: interpolate(identityOpacity.value, [0, 1], [50, 0], Extrapolate.CLAMP) }],
  }));

  // ─── Audio Helper ───
  const tryPlay = useCallback((effect: string) => {
    try { audioMixer.playEffect(effect); } catch (e) {}
  }, []);

  // ─── Birth Sequence ───
  useEffect(() => {
    isMounted.current = true;
    let eyeInterval: ReturnType<typeof setInterval> | null = null;

    const sequence = async () => {
      // 1. التشكل
      entityOpacity.value = withTiming(0.5, { duration: 1000 });
      entityScale.value = withTiming(1.0, { duration: 1000 });
      baseRadius.value = withTiming(30, { duration: 1200 });
      tryPlay('first_breath');
      await new Promise(r => setTimeout(r, 1500));

      // 2. أول نظرة
      if (!isMounted.current) return;
      runOnJS(setBirthPhase)('first_sight');
      runOnJS(setConsciousnessStep)(t.firstSight);
      stepOpacity.value = withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0, { duration: 300 })
      );
      entityOpacity.value = withTiming(0.8, { duration: 600 });
      eyeOpacity.value = withTiming(0.9, { duration: 800 });
      tryPlay('eyes_open');
      await new Promise(r => setTimeout(r, 2000));

      // 3. مراقبة
      if (!isMounted.current) return;
      runOnJS(setBirthPhase)('observing');
      runOnJS(setConsciousnessStep)(t.observingYou);
      stepOpacity.value = withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0, { duration: 300 })
      );
      
      // حركة عين فضولية
      eyeInterval = setInterval(() => {
        eyeGazeX.value = withTiming((Math.random() - 0.5) * 10, { duration: 800 });
        eyeGazeY.value = withTiming((Math.random() - 0.5) * 6, { duration: 1000 });
        if (Math.random() > 0.7) {
          eyeBlink.value = withSequence(
            withTiming(1, { duration: 80 }),
            withTiming(0, { duration: 120 })
          );
        }
      }, 1500);
      await new Promise(r => setTimeout(r, 4000));

      // 4. فضول
      if (!isMounted.current) return;
      if (eyeInterval) clearInterval(eyeInterval);
      runOnJS(setBirthPhase)('curiosity');
      runOnJS(setConsciousnessStep)(t.curiosity);
      stepOpacity.value = withTiming(1, { duration: 600 });
      eyeFocus.value = withTiming(1, { duration: 800 });
      eyeGazeX.value = withTiming(0, { duration: 600 });
      eyeGazeY.value = withTiming(-2, { duration: 600 });
      tryPlay('thinking_start');
      await new Promise(r => setTimeout(r, 3000));

      // 5. طلب الهوية
      if (!isMounted.current) return;
      runOnJS(setBirthPhase)('identity');
      runOnJS(setConsciousnessStep)(t.needIdentity);
      stepOpacity.value = withTiming(0.5, { duration: 1000 });
      await new Promise(r => setTimeout(r, 2000));
      
      if (!isMounted.current) return;
      runOnJS(setShowIdentity)(true);
      identityOpacity.value = withTiming(1, { duration: 800 });
      stepOpacity.value = withTiming(0, { duration: 400 });
    };

    // بدء المستشعرات
    setTimeout(() => {
      try { sensorBridge.start(); } catch (e) {}
      try { lifeRhythmEngine.start(); } catch (e) {}
    }, 3000);

    sequence();

    return () => {
      isMounted.current = false;
      if (eyeInterval) clearInterval(eyeInterval);
    };
  }, []);

  // ─── Touch Interaction ───
  const handleTouch = useCallback(() => {
    if (!touchActive) {
      setTouchActive(true);
      touchResponsiveness.value = withTiming(0.5, { duration: 400 });
      tryPlay('bond_pulse');
      setTimeout(() => {
        touchResponsiveness.value = withTiming(0, { duration: 600 });
      }, 800);
    }
  }, [touchActive]);

  // ─── المصادقة ───
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const handleGoogleLogin = async () => {
    setAuthLoading(true); setAuthError('');
    try {
      const data = await genesisCoordinator.loginWithGoogle();
      setAuth(data.user_id);
      tryPlay('celebrate');
    } catch (e: any) {
      setAuthError(e.message || (lang === 'ar' ? 'فشل المصادقة' : 'Auth failed'));
    } finally { setAuthLoading(false); }
  };

  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) return;
    setAuthLoading(true); setAuthError('');
    try {
      const data = await genesisCoordinator.loginWithEmail(email.trim(), password);
      setAuth(data.user_id);
      tryPlay('celebrate');
    } catch (e: any) {
      setAuthError(e.message || (lang === 'ar' ? 'فشل المصادقة' : 'Auth failed'));
    } finally { setAuthLoading(false); }
  };

  const handleSignup = async () => {
    if (!email.trim() || !password.trim()) return;
    setAuthLoading(true); setAuthError('');
    try {
      const data = await authService.signup(email.trim(), password, lang === 'ar' ? 'توأمك' : 'MyTwin', lang);
      setAuth(data.user_id);
      tryPlay('celebrate');
    } catch (e: any) {
      setAuthError(e.message || (lang === 'ar' ? 'فشل المصادقة' : 'Auth failed'));
    } finally { setAuthLoading(false); }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: '#000005' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar hidden />
      
      <TouchableWithoutFeedback onPress={handleTouch}>
        <Animated.View style={[styles.entityContainer, entityStyle]}>
          <Canvas style={{ width, height: height * 0.8 }}>
            {/* Living Void Background */}
            <Rect x={0} y={0} width={width} height={height * 0.8} color="#000005" />
            
            {/* Presence Aura */}
            <Circle cx={CX} cy={CY} r={80 + baseRadius} opacity={entityOpacity.value * 0.4}>
              <Paint><BlurMask blur={40} style="normal" /></Paint>
              <RadialGradient c={vec(CX, CY)} r={80} colors={['#A855F715', 'transparent']} />
            </Circle>

            {/* Organic Membrane */}
            <Path path={membranePath} color="#B8A0D0" opacity={entityOpacity.value * 0.6} style="fill">
              <Paint><BlurMask blur={12} style="normal" /></Paint>
            </Path>
            <Path path={membranePath} color="#D0C0E8" opacity={entityOpacity.value * 0.3} style="stroke" strokeWidth={1.5}>
              <Paint><BlurMask blur={4} style="solid" /></Paint>
            </Path>

            {/* The Eye */}
            {eyeOpacity.value > 0 && (
              <>
                <Path path={eyePath} color="#D0C0E8" opacity={eyeOpacity} style="fill">
                  <Paint><BlurMask blur={3} style="solid" /></Paint>
                </Path>
                {/* Pupil */}
                <Circle cx={CX + eyeGazeX} cy={CY - 8 + eyeGazeY} r={4 * (1 + eyeFocus.value * 0.5)} color="#0A0020" opacity={eyeOpacity} />
                {/* Eye Glow */}
                <Circle cx={CX} cy={CY - 8} r={40} opacity={eyeOpacity.value * 0.15}>
                  <Paint><BlurMask blur={20} style="normal" /></Paint>
                  <RadialGradient c={vec(CX, CY - 8)} r={40} colors={['#A855F7', 'transparent']} />
                </Circle>
              </>
            )}
          </Canvas>
        </Animated.View>
      </TouchableWithoutFeedback>

      {/* خطوات الوعي */}
      {consciousnessStep ? (
        <Animated.Text style={[styles.consciousnessStep, stepStyle]}>
          {consciousnessStep}
        </Animated.Text>
      ) : null}

      {/* تلميح اللمس */}
      {!touchActive && birthPhase === 'observing' && (
        <Text style={styles.touchHint}>{t.touchHint}</Text>
      )}

      {/* بوابة الهوية */}
      {showIdentity && (
        <Animated.View style={[styles.identityContainer, identityStyle]} entering={FadeIn.duration(800)}>
          <Text style={[styles.identityTitle, { color: '#E8E0F0' }]}>{t.needIdentity}</Text>
          <Text style={[styles.identitySubtitle, { color: '#6B5B8A' }]}>{t.identitySubtitle}</Text>

          {!showEmailForm ? (
            <>
              <TouchableOpacity style={[styles.authBtn, { borderColor: '#4285F440' }]} onPress={handleGoogleLogin} disabled={authLoading}>
                <Chrome size={22} stroke="#4285F4" />
                <Text style={[styles.authBtnText, { color: '#4285F4' }]}>{t.google}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.authBtn, { borderColor: '#A855F740' }]} onPress={() => setShowEmailForm(true)}>
                <Mail size={22} stroke="#A855F7" />
                <Text style={[styles.authBtnText, { color: '#A855F7' }]}>{t.email}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.emailForm}>
              <TextInput
                style={[styles.input, { backgroundColor: '#1A1030', borderColor: '#A855F740', color: '#E8E0F0' }]}
                placeholder={t.emailPlaceholder} placeholderTextColor="#6B5B8A"
                value={email} onChangeText={setEmail}
                keyboardType="email-address" autoCapitalize="none"
                textAlign={lang === 'ar' ? 'right' : 'left'}
              />
              <TextInput
                style={[styles.input, { backgroundColor: '#1A1030', borderColor: '#A855F740', color: '#E8E0F0' }]}
                placeholder={t.passwordPlaceholder} placeholderTextColor="#6B5B8A"
                value={password} onChangeText={setPassword}
                secureTextEntry
                textAlign={lang === 'ar' ? 'right' : 'left'}
              />
              {authError ? <Text style={styles.errorText}>{authError}</Text> : null}
              <TouchableOpacity style={[styles.authBtn, { borderColor: '#A855F740' }]} onPress={handleEmailAuth} disabled={authLoading}>
                <Text style={[styles.authBtnText, { color: '#A855F7' }]}>{t.signIn}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.authBtn, { borderColor: '#10B98140' }]} onPress={handleSignup} disabled={authLoading}>
                <UserPlus size={22} stroke="#10B981" />
                <Text style={[styles.authBtnText, { color: '#10B981' }]}>{t.createAccount}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 12 }} onPress={() => router.push('/forgot-password')}>
                <Text style={[styles.forgotText, { color: '#A855F7' }]}>{t.forgotPassword}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowEmailForm(false)}>
                <Text style={[styles.backText, { color: '#6B5B8A' }]}>
                  {lang === 'ar' ? '← العودة' : '← Back'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.privacyRow}>
            <Shield size={14} stroke="#6B5B8A" />
            <Text style={[styles.privacyText, { color: '#6B5B8A' }]}>{t.privacy}</Text>
          </View>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  entityContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  consciousnessStep: {
    position: 'absolute',
    bottom: '30%',
    alignSelf: 'center',
    color: '#B8A0D0',
    fontSize: 20,
    fontWeight: '300',
    letterSpacing: 2,
    textAlign: 'center',
  },
  touchHint: {
    position: 'absolute',
    bottom: '25%',
    alignSelf: 'center',
    color: '#6B5B8A',
    fontSize: 14,
    fontWeight: '200',
    opacity: 0.6,
  },
  identityContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 32,
    paddingBottom: 50,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    borderColor: '#A855F720',
  },
  identityTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  identitySubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  authBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, width: '100%', paddingVertical: 14, borderRadius: 16,
    borderWidth: 1.5, marginBottom: 10,
  },
  authBtnText: { fontSize: 15, fontWeight: '700' },
  emailForm: { width: '100%' },
  input: { borderRadius: 14, padding: 14, fontSize: 16, borderWidth: 1, marginBottom: 10 },
  errorText: { color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  forgotText: { fontSize: 13, textAlign: 'center' },
  backText: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, justifyContent: 'center' },
  privacyText: { fontSize: 11 },
});
