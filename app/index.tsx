import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Dimensions, Animated, Easing, StatusBar } from 'react-native';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');

export default function Index() {
  const sparkOpacity = useRef(new Animated.Value(0)).current;
  const backgroundOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const soulSyncOpacity = useRef(new Animated.Value(0)).current;
  const enterScale = useRef(new Animated.Value(1)).current;
  const enterOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // محاولة تشغيل الصوت بهدوء (لن يسبب كراش إذا فشل)
    try {
      const { audioEngine } = require('../src/core/AudioEngine');
      audioEngine.init();
    } catch (e) {}

    const sequence = async () => {
      // 1. فراغ (ثانية واحدة)
      await new Promise(r => setTimeout(r, 1000));

      // 2. شرارة الوعي (وميض خفيف)
      Animated.timing(sparkOpacity, {
        toValue: 0.3,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
      try {
        require('../src/core/AudioEngine').audioEngine.play('first_breath');
      } catch (e) {}
      await new Promise(r => setTimeout(r, 1500));

      // 3. ظهور الشعار والشركة (بشكل ناعم)
      Animated.parallel([
        Animated.timing(sparkOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.timing(soulSyncOpacity, {
          toValue: 0.5,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]).start();
      try {
        require('../src/core/AudioEngine').audioEngine.play('awakening_glow');
      } catch (e) {}
      await new Promise(r => setTimeout(r, 2500));

      // 4. الدخول إلى الكيان (تكبير الشاشة)
      Animated.parallel([
        Animated.timing(enterScale, {
          toValue: 30,
          duration: 800,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(enterOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
      try {
        require('../src/core/AudioEngine').audioEngine.play('workspace_enter');
      } catch (e) {}

      setTimeout(() => {
        router.replace('/genesis');
      }, 800);
    };

    sequence();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <Animated.View
        style={[
          styles.backgroundWrapper,
          {
            opacity: enterOpacity,
            transform: [{ scale: enterScale }],
          },
        ]}
      >
        {/* صورة الخلفية الأصلية */}
        <Image
          source={require('../assets/splash/splash.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        />

        {/* شرارة الوعي (ضوء بسيط في المنتصف) */}
        <Animated.View
          style={[
            styles.spark,
            {
              opacity: sparkOpacity,
            },
          ]}
        />

        {/* الشعار واسم الشركة */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image
            source={require('../assets/brand/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Animated.Text style={[styles.soulSyncText, { opacity: soulSyncOpacity }]}>
            by SOULSYNC
          </Animated.Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  backgroundWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundImage: {
    position: 'absolute',
    width: width,
    height: height,
  },
  spark: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#B8A0D020',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 160,
    height: 160,
  },
  soulSyncText: {
    fontSize: 14,
    marginTop: 20,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#B8A0D0',
    fontWeight: '300',
  },
});
