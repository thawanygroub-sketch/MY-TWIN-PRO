import React, { useEffect, useState } from 'react';
import { View, Image, Text, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { router } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { LivingEntity } from '../src/components/LivingEntity';
import { useAppTheme } from '../engine/colors';
import { audioMixer } from '../src/core/AudioMixer';
const { height } = Dimensions.get('window');
export default function Index() {
  const { isDark } = useAppTheme();
  const [formed, setFormed] = useState(false);
  const [eyes, setEyes] = useState(false);
  const logoO = useSharedValue(0); const nameO = useSharedValue(0);
  const brandExit = useSharedValue(1); const exitO = useSharedValue(1);
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoO.value * brandExit.value }));
  const nameStyle = useAnimatedStyle(() => ({ opacity: nameO.value * brandExit.value }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: exitO.value }));
  useEffect(() => {
    const play = (e: string) => { try { audioMixer.playEffect(e); } catch {} };
    const seq = async () => {
      await new Promise(r => setTimeout(r, 700));
      setFormed(true); play('first_breath');
      await new Promise(r => setTimeout(r, 1400));
      setEyes(true); play('eyes_open');
      logoO.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
      await new Promise(r => setTimeout(r, 800));
      nameO.value = withTiming(0.85, { duration: 900 }); play('awakening_glow');
      await new Promise(r => setTimeout(r, 1500));
      brandExit.value = withTiming(0, { duration: 700 });
      await new Promise(r => setTimeout(r, 700));
      play('workspace_enter');
      exitO.value = withTiming(0, { duration: 700 });
      setTimeout(() => router.replace('/genesis'), 750);
    };
    seq();
  }, []);
  return (
    <View style={[st.root, { backgroundColor: isDark ? '#05010A' : '#FAF9FF' }]}>
      <StatusBar hidden />
      <Animated.View style={[st.fill, fadeStyle]}>
        <View style={st.entity}><LivingEntity radius={80} height={height * 0.66} formed={formed} eyesOpen={eyes} /></View>
        <Animated.View style={[st.brand, logoStyle]}><Image source={require('../assets/brand/logo.png')} style={st.logo} resizeMode="contain" /></Animated.View>
        <Animated.Text style={[st.name, nameStyle, { color: isDark ? '#B8A0D0' : '#4C1D95' }]}>© By SOULSYNC</Animated.Text>
      </Animated.View>
    </View>
  );
}
const st = StyleSheet.create({
  root: { flex: 1 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  entity: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.74 },
  brand: { position: 'absolute', bottom: 84, alignSelf: 'center' },
  logo: { width: 56, height: 56 },
  name: { position: 'absolute', bottom: 58, alignSelf: 'center', fontSize: 12, letterSpacing: 2.5, fontWeight: '300' },
});
