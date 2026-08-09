import React, { useEffect } from 'react';
import { View, Image, Text, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { router } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import ConsciousBeing from '../src/components/conscious/ConsciousBeing';
import { stateBus } from '../src/core/StateBus';
import { useAppTheme } from '../engine/colors';
import { audioMixer } from '../src/core/AudioMixer';
const { height } = Dimensions.get('window');
export default function Index() {
  const { isDark } = useAppTheme();
  const logoO = useSharedValue(0); const nameO = useSharedValue(0);
  const brandExit = useSharedValue(1); const exitO = useSharedValue(1);
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoO.value * brandExit.value }));
  const nameStyle = useAnimatedStyle(() => ({ opacity: nameO.value * brandExit.value }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: exitO.value }));
  useEffect(() => {
    const play = (e: string) => { try { audioMixer.playEffect(e); } catch {} };
    stateBus.patch({ energy: 0.35, curiosity: 0.4 });
    const seq = async () => {
      await new Promise(r => setTimeout(r, 700));
      stateBus.patch({ energy: 0.6 }); play('first_breath');
      await new Promise(r => setTimeout(r, 1400));
      stateBus.patch({ curiosity: 0.7, focus: 0.6, connection: 0.4 }); play('eyes_open');
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
        <View style={st.entity}><ConsciousBeing size={Math.min(height * 0.52, 430)} /></View>
        <Animated.View style={[st.brand, logoStyle]}><Image source={require('../assets/brand/logo.png')} style={st.logo} resizeMode="contain" /></Animated.View>
        <Animated.Text style={[st.name, nameStyle, { color: isDark ? '#B8A0D0' : '#4C1D95' }]}>© By SOULSYNC</Animated.Text>
      </Animated.View>
    </View>
  );
}
const st = StyleSheet.create({
  root: { flex: 1 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  entity: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.74, alignItems: 'center', justifyContent: 'center' },
  brand: { position: 'absolute', bottom: 84, alignSelf: 'center' },
  logo: { width: 56, height: 56 },
  name: { position: 'absolute', bottom: 58, alignSelf: 'center', fontSize: 12, letterSpacing: 2.5, fontWeight: '300' },
});
