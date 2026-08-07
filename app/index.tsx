import React, { useEffect } from 'react';
import { View, Image, Text, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { Canvas, Path, RadialGradient, LinearGradient, vec, BlurMask, Paint } from '@shopify/react-native-skia';
import Animated, { useSharedValue, useAnimatedStyle, useDerivedValue, withTiming, withSequence, withSpring, Easing, useFrameCallback } from 'react-native-reanimated';
import { audioMixer } from '../src/core/AudioMixer';
const { width, height } = Dimensions.get('window');
const CX = width / 2, CY = height * 0.42;
const noise = (x: number, y: number, s: number) => {
  'worklet';
  const n = Math.sin(x * 12.9898 + y * 78.233 + s * 43758.5453) * 43758.5453;
  return n - Math.floor(n);
};
const fbm = (x: number, y: number, s: number) => {
  'worklet';
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < 2; i++) { v += a * noise(x * f, y * f, s + i); a *= 0.5; f *= 2; }
  return v;
};
const genMembrane = (t: number, R: number, breath: number, form: number) => {
  'worklet';
  if (form <= 0.01 || R <= 0) return '';
  const pts = 48; let d = '';
  for (let i = 0; i < pts; i++) {
    const ang = (i / pts) * Math.PI * 2;
    const org = Math.sin(ang * 3 + t * 0.7) * 0.32 + Math.cos(ang * 5 - t * 0.6) * 0.22
      + Math.sin(ang * 7 + t * 1.1) * 0.18 + fbm(Math.cos(ang) * 2, t * 0.15, 42) * 0.4;
    const r = Math.max(2, R * form * (1 + org + breath * 0.16 + Math.sin(t * 25) * 0.04));
    d += (i === 0 ? 'M ' : ' L ') + (CX + Math.cos(ang) * r) + ' ' + (CY + Math.sin(ang) * r);
  }
  return d + ' Z';
};
const genStream = (t: number, yBase: number, seed: number, amp: number) => {
  'worklet';
  const seg = 6;
  let d = 'M 0 ' + (yBase + (noise(0, t * 0.3, seed) - 0.5) * 2 * amp);
  for (let i = 1; i <= seg; i++) {
    const x = (width / seg) * i;
    const y = yBase + (noise(i * 0.7, t * 0.3, seed) - 0.5) * 2 * amp + Math.sin(t * 0.8 + i + seed) * amp * 0.25;
    d += ' Q ' + (x - width / seg / 2) + ' ' + (yBase + (noise((i - 0.5) * 0.7, t * 0.3, seed) - 0.5) * 2 * amp) + ' ' + x + ' ' + y;
  }
  return d;
};
const genEmbers = (t: number) => {
  'worklet';
  let d = '';
  for (let i = 0; i < 12; i++) {
    const seed = i * 97.13;
    const x = (seed * 13.7) % width;
    const y = height - ((seed * 3.1 + t * (26 + (i % 5) * 10)) % (height + 80));
    const sway = Math.sin(t * 1.4 + i) * 3;
    d += 'M ' + (x + sway) + ' ' + y + ' L ' + (x + sway * 1.4) + ' ' + (y - 6 - (i % 3) * 5) + ' ';
  }
  return d;
};
export default function Index() {
  const time = useSharedValue(0);
  const form = useSharedValue(0); const glowO = useSharedValue(0); const edgeO = useSharedValue(0);
  const streamO = useSharedValue(0); const emberO = useSharedValue(0);
  const logoO = useSharedValue(0); const logoS = useSharedValue(0.92);
  const textO = useSharedValue(0); const exitO = useSharedValue(1);
  useFrameCallback((fi) => { time.value = fi.timeSinceFirstFrame; });
  const membrane = useDerivedValue(() => genMembrane(time.value * 0.001, 86, Math.sin(time.value * 0.0016) * 0.5 + 0.5, form.value));
  const streamA = useDerivedValue(() => genStream(time.value * 0.001, height * 0.3, 7, 26));
  const streamB = useDerivedValue(() => genStream(time.value * 0.0011 + 2, height * 0.55, 13, 34));
  const streamC = useDerivedValue(() => genStream(time.value * 0.0009 + 4, height * 0.78, 29, 22));
  const embers = useDerivedValue(() => genEmbers(time.value * 0.001));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: exitO.value }));
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoO.value, transform: [{ scale: logoS.value }] as any }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textO.value }));
  useEffect(() => {
    const play = (e: string) => { try { audioMixer.playEffect(e); } catch {} };
    const seq = async () => {
      await new Promise(r => setTimeout(r, 900));
      glowO.value = withSequence(withTiming(0.9, { duration: 700 }), withTiming(0.55, { duration: 900 }));
      form.value = withTiming(0.35, { duration: 700 }); play('first_breath');
      await new Promise(r => setTimeout(r, 1200));
      form.value = withSpring(1, { damping: 14, stiffness: 110 });
      edgeO.value = withTiming(0.9, { duration: 800 });
      logoO.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) });
      logoS.value = withSpring(1, { damping: 14, stiffness: 120 }); play('awakening_glow');
      await new Promise(r => setTimeout(r, 1500));
      textO.value = withTiming(0.65, { duration: 1500 });
      streamO.value = withTiming(0.7, { duration: 1200 });
      emberO.value = withTiming(0.5, { duration: 1200 }); play('workspace_enter');
      await new Promise(r => setTimeout(r, 1800));
      exitO.value = withTiming(0, { duration: 700 });
      setTimeout(() => router.replace('/genesis'), 750);
    };
    seq();
  }, []);
  return (
    <View style={st.root}>
      <StatusBar hidden />
      <Animated.View style={[st.fill, fadeStyle]}>
        <Canvas style={st.fill}>
          <Path path={membrane} opacity={glowO}>
            <Paint><BlurMask blur={14} style="normal" /><RadialGradient c={vec(CX, CY)} r={150} colors={['#C4B5FD', '#8B5CF6', '#00000000']} /></Paint>
          </Path>
          <Path path={membrane} color="#E9D5FF" style="stroke" strokeWidth={2} opacity={edgeO}>
            <Paint><BlurMask blur={3} style="solid" /></Paint>
          </Path>
          <Path path={streamA} style="stroke" strokeWidth={3} opacity={streamO}><Paint><LinearGradient start={vec(0, 0)} end={vec(width, 0)} colors={['#00000000', '#A855F7', '#00000000']} /></Paint></Path>
          <Path path={streamB} style="stroke" strokeWidth={2.5} opacity={streamO}><Paint><LinearGradient start={vec(0, 0)} end={vec(width, 0)} colors={['#00000000', '#22D3EE', '#00000000']} /></Paint></Path>
          <Path path={streamC} style="stroke" strokeWidth={2} opacity={streamO}><Paint><LinearGradient start={vec(0, 0)} end={vec(width, 0)} colors={['#00000000', '#F472B6', '#00000000']} /></Paint></Path>
          <Path path={embers} color="#E9D5FF" style="stroke" strokeWidth={1.5} opacity={emberO} />
        </Canvas>
        <Animated.View style={[st.logoWrap, logoStyle]}>
          <Image source={require('../assets/brand/logo.png')} style={st.logo} resizeMode="contain" />
          <Animated.Text style={[st.brand, textStyle]}>by SOULSYNC</Animated.Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000005' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  logoWrap: { position: 'absolute', top: CY - 80, alignSelf: 'center', alignItems: 'center' },
  logo: { width: 160, height: 160 },
  brand: { fontSize: 14, letterSpacing: 3, textTransform: 'uppercase', color: '#B8A0D0', fontWeight: '300', marginTop: 20 },
});
