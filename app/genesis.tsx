import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, StatusBar, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSequence,
  FadeIn, runOnJS,
} from 'react-native-reanimated';
import { router } from 'expo-router';
import { useTwinStore } from '../store/useTwinStore';
import { genesisCoordinator } from '../src/coordinators/GenesisCoordinator';
import { authService } from '../src/services/authService';
import { useAppTheme } from '../engine/colors';
import { audioMixer } from '../src/core/AudioMixer';
import { sensorBridge } from '../src/core/SensorBridge';
import { lifeRhythmEngine } from '../engine/life/LifeRhythmEngine';
import { detectUserLanguage, SupportedLanguage } from '../src/utils/languageDetector';
import { Chrome, Mail, Shield, UserPlus } from 'lucide-react-native';
import LivingLightEntity from '../src/renderers/zones/LivingLightEntity';

const TEXTS: Record<SupportedLanguage, Record<string, string>> = {
  ar: {
    firstSight: 'إنه هنا...',
    observingYou: 'أراقبك...',
    curiosity: 'من أنت؟',
    needIdentity: 'أحتاج أن أعرفك.',
    identitySubtitle: 'لأعرفك. لأتذكرك. لأكون لك.',
    google: 'المتابعة باستخدام Google',
    email: 'المتابعة باستخدام البريد الإلكتروني',
    emailPlaceholder: 'البريد الإلكتروني',
    passwordPlaceholder: 'كلمة المرور',
    signIn: 'تسجيل الدخول',
    createAccount: 'إنشاء حساب جديد',
    forgotPassword: 'نسيت كلمة المرور؟',
    privacy: 'لن أشارك وجودك مع أحد.',
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
  },
};

type BirthPhase = 'entering' | 'first_sight' | 'observing' | 'curiosity' | 'identity';

export default function Genesis() {
  const { colors } = useAppTheme();
  const { setAuth } = useTwinStore();
  const lang = detectUserLanguage();
  const t = TEXTS[lang];

  // حالة React فقط للتحكم بالمراحل والظهور
  const [birthPhase, setBirthPhase] = useState<BirthPhase>('entering');
  const [showIdentity, setShowIdentity] = useState(false);
  const [consciousnessStep, setConsciousnessStep] = useState('');
  const isMounted = useRef(true);

  // ─── قيم Reanimated (لا تسبب إعادة render) ───
  const entityOpacity = useSharedValue(0.1);
  const entityScale = useSharedValue(0.9);
  const stepOpacity = useSharedValue(0);
  const identityOpacity = useSharedValue(0);
  const membranePhase = useSharedValue(0);
  const noiseLevel = useSharedValue(1.5);

  // ─── أنماط متحركة ───
  const entityStyle = useAnimatedStyle(() => ({
    opacity: entityOpacity.value,
    transform: [{ scale: entityScale.value }],
  }));

  const stepStyle = useAnimatedStyle(() => ({
    opacity: stepOpacity.value,
  }));

  const identityStyle = useAnimatedStyle(() => ({
    opacity: identityOpacity.value,
  }));

  useEffect(() => {
    isMounted.current = true;

    const birthSequence = async () => {
      // 1. الدخول إلى غرفة الولادة (الكيان يدخل من الفراغ)
      if (!isMounted.current) return;
      entityOpacity.value = withTiming(0.3, { duration: 800 });
      entityScale.value = withTiming(0.9, { duration: 800 }, () => {
        // 2. أول اتصال بصري — الكيان يلاحظ وجود المستخدم
        if (!isMounted.current) return;
        runOnJS(setBirthPhase)('first_sight');
        runOnJS(setConsciousnessStep)(t.firstSight);
        stepOpacity.value = withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0, { duration: 300 }),
        );
        entityOpacity.value = withTiming(0.6, { duration: 600 });
        entityScale.value = withTiming(0.95, { duration: 600 });
        try { audioMixer.playEffect('eyes_open'); } catch (e) {}
        // بعد 2.5 ثانية من الملاحظة، يبدأ بالمراقبة
        setTimeout(() => {
          if (!isMounted.current) return;
          runOnJS(setBirthPhase)('observing');
          runOnJS(setConsciousnessStep)(t.observingYou);
          stepOpacity.value = withSequence(
            withTiming(1, { duration: 400 }),
            withTiming(0, { duration: 300 }),
          );
          entityOpacity.value = withTiming(0.8, { duration: 500 });
          entityScale.value = withTiming(1.0, { duration: 500 });
          // مراقبة صامتة لمدة 4 ثوانٍ
          setTimeout(() => {
            if (!isMounted.current) return;
            // 4. فضول — الكيان يتساءل
            runOnJS(setBirthPhase)('curiosity');
            runOnJS(setConsciousnessStep)(t.curiosity);
            stepOpacity.value = withTiming(1, { duration: 600 });
            try { audioMixer.playEffect('thinking_start'); } catch (e) {}
            // بعد 3 ثوانٍ من الفضول، يقرر طلب الهوية
            setTimeout(() => {
              if (!isMounted.current) return;
              // 5. طلب الهوية — الكيان يقرر أنه يحتاج أن يعرف
              runOnJS(setBirthPhase)('identity');
              runOnJS(setConsciousnessStep)(t.needIdentity);
              stepOpacity.value = withTiming(0.5, { duration: 1000 });
              // إظهار بوابة الهوية
              setTimeout(() => {
                if (!isMounted.current) return;
                runOnJS(setShowIdentity)(true);
                identityOpacity.value = withTiming(1, { duration: 800 });
                stepOpacity.value = withTiming(0, { duration: 400 });
              }, 2000);
            }, 3000);
          }, 4000);
        }, 2500);
      });
    };

    // بدء المستشعرات بهدوء بعد 3 ثوانٍ
    setTimeout(() => {
      try { sensorBridge.start(); } catch (e) {}
      try { lifeRhythmEngine.start(); } catch (e) {}
    }, 3000);

    birthSequence();

    return () => {
      isMounted.current = false;
    };
  }, []);

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
      try { audioMixer.playEffect('celebrate'); } catch (e) {}
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
      try { audioMixer.playEffect('celebrate'); } catch (e) {}
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
      try { audioMixer.playEffect('celebrate'); } catch (e) {}
    } catch (e: any) {
      setAuthError(e.message || (lang === 'ar' ? 'فشل المصادقة' : 'Auth failed'));
    } finally { setAuthLoading(false); }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: '#000000' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar hidden />

      {/* ─── الكيان الحي (مركز التجربة) ─── */}
      <Animated.View style={[styles.entityContainer, entityStyle]}>
        <LivingLightEntity
          isListening={birthPhase === 'observing'}
          isThinking={birthPhase === 'curiosity'}
        />
      </Animated.View>

      {/* ─── أفكار الكيان (نص يظهر ويختفي) ─── */}
      {consciousnessStep ? (
        <Animated.Text style={[styles.consciousnessStep, stepStyle]}>
          {consciousnessStep}
        </Animated.Text>
      ) : null}

      {/* ─── بوابة الهوية (تظهر بعد أن يقرر الكيان أنه يحتاجها) ─── */}
      {showIdentity && (
        <Animated.View style={[styles.identityContainer, identityStyle]} entering={FadeIn.duration(800)}>
          <Text style={[styles.identityTitle, { color: '#E8E0F0' }]}>
            {t.needIdentity}
          </Text>
          <Text style={[styles.identitySubtitle, { color: '#6B5B8A' }]}>
            {t.identitySubtitle}
          </Text>

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
    bottom: '35%',
    alignSelf: 'center',
    color: '#B8A0D0',
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: 2,
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
