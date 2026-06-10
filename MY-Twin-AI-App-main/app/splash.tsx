import { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useTwinStore } from '../store/useTwinStore';
import { setToken } from '../lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SplashScreen() {
  const { setAuth, theme } = useTwinStore();
  const isDark = theme === 'dark';

  // قيم الأنيميشن
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const brandTextOpacity = useRef(new Animated.Value(0)).current;
  const copyrightOpacity = useRef(new Animated.Value(0)).current;
  
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const [routeReady, setRouteReady] = useState(false);
  const targetRoute = useRef('/login');

  useEffect(() => {
    // تشغيل الأنيميشن المتسلسل
    animRef.current = Animated.sequence([
      // المرحلة الأولى: ظهور الشعار وتكبيره
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 8,
          friction: 3,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      // المرحلة الثانية: ظهور اسم الشركة
      Animated.timing(brandTextOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      // المرحلة الثالثة: ظهور سنة الحقوق
      Animated.timing(copyrightOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]);
    animRef.current.start();

    // بدء التحقق من الجلسة فوراً بالتوازي مع الأنيميشن
    const bootPromise = (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          targetRoute.current = '/login';
          return;
        }

        setAuth(session.user.id);
        setToken(session.access_token);

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('onboarded')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Profile fetch error:', profileError);
          targetRoute.current = '/login';
          return;
        }

        if (!profile || !profile.onboarded) {
          targetRoute.current = '/onboarding';
          return;
        }

        targetRoute.current = '/chat';
      } catch (e) {
        console.error('Boot error:', e);
        targetRoute.current = '/login';
      } finally {
        setRouteReady(true);
      }
    })();

    // ضمان عرض الشاشة لمدة 3.5 ثانية على الأقل
    const minTime = new Promise(resolve => setTimeout(resolve, 3500));

    Promise.all([bootPromise, minTime]).then(() => {
      if (!routeReady) setRouteReady(true);
    });

    return () => {
      animRef.current?.stop();
    };
  }, []);

  // الانتقال عند الجاهزية
  useEffect(() => {
    if (routeReady) {
      router.replace(targetRoute.current as any);
    }
  }, [routeReady]);

  return (
    <SafeAreaView style={[styles.safe, isDark && { backgroundColor: '#1A1A1A' }]}>
      <View style={[styles.container, isDark && { backgroundColor: '#1A1A1A' }]}>
        {/* مجموعة المحتوى المركزي */}
        <View style={styles.contentGroup}>
          {/* الشعار */}
          <Animated.Image
            source={require('../assets/logo.png')}
            style={[
              styles.logo,
              {
                transform: [{ scale: logoScale }],
                opacity: logoOpacity,
              },
            ]}
            resizeMode="contain"
          />
          
          {/* اسم الشركة */}
          <Animated.Text style={[styles.brandText, { opacity: brandTextOpacity }]}>
            By SOULSYNC
          </Animated.Text>
          
          {/* حقوق النشر */}
          <Animated.Text style={[styles.copyrightText, { opacity: copyrightOpacity }]}>
            ©2026
          </Animated.Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentGroup: {
    alignItems: 'center',
  },
  logo: {
    width: Math.min(SCREEN_WIDTH * 0.55, 280),
    height: Math.min(SCREEN_WIDTH * 0.55, 280),
    marginBottom: 24,
  },
  brandText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  copyrightText: {
    fontSize: 14,
    color: '#A78BFA',
    letterSpacing: 2,
  },
});
