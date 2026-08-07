import React, { useEffect } from 'react';
import { View, Image, Text, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { Canvas, Path, Circle, RadialGradient, LinearGradient, vec, Paint } from '@shopify/react-native-skia';
import Animated, { useSharedValue, useAnimatedStyle, useDerivedValue, withTiming, withSequence, withSpring, Easing, useFrameCallback } from 'react-native-reanimated';
import { useAppTheme } from '../engine/colors';
import { audioMixer } from '../src/core/AudioMixer';
const { width, height } = Dimensions.get('window');
const CX = width / 2, CY = height * 0.42;
const noise = (x: number, y: number, s: number) => { 'worklet'; const n = Math.sin(x * 12.9898 + y * 78.233 + s * 43758.5453) * 43758.5453; return n - Math.floor(n); };
const fbm = (x: number, y: number, s: number) => { 'worklet'; let v = 0, a = 0.5, f = 1; for (let i = 0; i < 2; i++) { v += a * noise(x * f, y * f, s + i); a *= 0.5; f *= 2; } return v; };
const genMembrane = (t: number, R: number, breath: number, form: number) => {
  'worklet';
  if (form <= 0.01 || R <= 0) return '';
  const pts = 36; const xs: number[] = []; const ys: number[] = [];
  for (let i = 0; i < pts; i++) {
    const ang = (i / pts) * Math.PI * 2;
    const org = Math.sin(ang * 3 + t * 0.7) * 0.22 + Math.cos(ang * 5 - t * 0.6) * 0.14 + Math.sin(ang * 7 + t * 1.1) * 0.1 + fbm(Math.cos(ang) * 2, t * 0.15, 42) * 0.25;
    const r = Math.max(2, R * form * (1 + org + breath * 0.14 + Math.sin(t * 25) * 0.03));
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
    const wob = Math.sin(t * 0.9 + i * 1.7 + seed) * 10 + (fbm(Math.cos(a) * 1.5, t * 0.12, seed) - 0.5) * 14;
    const r = R + wob;
    d += 'M ' + (CX + Math.cos(a) * r) + ' ' + (CY + Math.sin(a) * r * 0.92) + ' l 0.9 0.9 ';
  }
  return d;
};
const genEmbers = (t: number, boost: number) => {
  'worklet';
  let d = '';
  for (let i = 0; i < 10; i++) {
    const seed = i * 97.13;
    const x = (seed * 13.7) % width;
    const y = height - ((seed * 3.1 + t * (26 + (i % 5) * 10)) % (height + 80));
    const sway = Math.sin(t * 1.4 + i) * 3;
    d += 'M ' + (x + sway) + ' ' + (y - boost * 4) + ' L ' + (x + sway * 1.4) + ' ' + (y - 6 - (i % 3) * 5 - boost * 4) + ' ';
  }
  return d;
};
export default function Index() {
  const { isDark } = useAppTheme();
  const P = isDark
    ? { bg: '#05010A', p1: '#E9D5FF', p2: '#C4B5FD', coreIn: '#FFFFFF', coreMid: '#A855F7', edge: '#E9D5FF', eyeCore: '#FFFFFF', eyeHalo: '#C4B5FD', text: '#B8A0D0' }
    : { bg: '#FAF9FF', p1: '#7C3AED', p2: '#4F46E5', coreIn: '#C4B5FD', coreMid: '#7C3AED', edge: '#6D28D9', eyeCore: '#312E81', eyeHalo: '#8B5CF6', text: '#4C1D95' };
  const time = useSharedValue(0);
  const form = useSharedValue(0); const glowO = useSharedValue(0); const edgeO = useSharedValue(0);
  const orbitsO = useSharedValue(0); const embersO = useSharedValue(0); const boost = useSharedValue(0);
  const eyeO = useSharedValue(0); const eyeScale = useSharedValue(1); const blink = useSharedValue(0);
  const gX = useSharedValue(0); const gY = useSharedValue(0);
  const logoO = useSharedValue(0); const nameO = useSharedValue(0); const brandExit = useSharedValue(1); const exitO = useSharedValue(1);
  useFrameCallback((fi) => { time.value = fi.timeSinceFirstFrame; });
  const membrane = useDerivedValue(() => genMembrane(time.value * 0.001, 84, Math.sin(time.value * 0.0016) * 0.5 + 0.5, form.value));
  const orbitA = useDerivedValue(() => genOrbit(time.value * 0.001, 108, 0.25, 7, 56));
  const orbitB = useDerivedValue(() => genOrbit(time.value * 0.001, 132, -0.18, 29, 56));
  const embers = useDerivedValue(() => genEmbers(time.value * 0.001, boost.value));
  const eyeLX = useDerivedValue(() => CX - 15 + gX.value);
  const eyeRX = useDerivedValue(() => CX + 15 + gX.value * 0.8);
  const eyeY = useDerivedValue(() => CY - 6 + gY.value);
  const haloR = useDerivedValue(() => 8 * eyeScale.value * (1 - blink.value * 0.85));
  const coreR = useDerivedValue(() => 3.4 * eyeScale.value * (1 - blink.value * 0.9));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: exitO.value }));
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoO.value * brandExit.value }));
  const nameStyle = useAnimatedStyle(() => ({ opacity: nameO.value * brandExit.value }));
  useEffect(() => {
    const play = (e: string) => { try { audioMixer.playEffect(e); } catch {} };
    const blinkIv = setInterval(() => { blink.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 130 })); }, 3400);
    const gazeIv = setInterval(() => {
      gX.value = withTiming((Math.random() - 0.5) * 8, { duration: 700 });
      gY.value = withTiming((Math.random() - 0.5) * 5, { duration: 900 });
    }, 1700);
    const seq = async () => {
      await new Promise(r => setTimeout(r, 900));
      glowO.value = withSequence(withTiming(0.95, { duration: 700 }), withTiming(0.75, { duration: 900 }));
      form.value = withTiming(0.35, { duration: 700 }); play('first_breath');
      await new Promise(r => setTimeout(r, 1200));
      form.value = withSpring(1, { damping: 14, stiffness: 110 });
      edgeO.value = withTiming(0.85, { duration: 800 });
      orbitsO.value = withTiming(0.8, { duration: 1000 });
      eyeO.value = withTiming(1, { duration: 800 }); play('eyes_open');
      logoO.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
      await new Promise(r => setTimeout(r, 900));
      nameO.value = withTiming(0.85, { duration: 900 });
      embersO.value = withTiming(0.5, { duration: 1000 }); play('awakening_glow');
      await new Promise(r => setTimeout(r, 1400));
      brandExit.value = withTiming(0, { duration: 700 });
      await new Promise(r => setTimeout(r, 800));
      play('workspace_enter');
      exitO.value = withTiming(0, { duration: 700 });
      setTimeout(() => router.replace('/genesis'), 750);
    };
    seq();
    return () => { clearInterval(blinkIv); clearInterval(gazeIv); };
  }, []);
  return (
    <View style={[st.root, { backgroundColor: P.bg }]}>
      <StatusBar hidden />
      <Animated.View style={[st.fill, fadeStyle]}>
        <Canvas style={st.fill}>
          <Path path={membrane} opacity={glowO} style="fill">
            <RadialGradient c={vec(CX, CY)} r={130} colors={[P.coreIn, P.coreMid, '#00000000']} />
          </Path>
          <Path path={membrane} color={P.edge} style="stroke" strokeWidth={1.4} opacity={edgeO} />
          <Path path={orbitA} opacity={orbitsO}><Paint style="stroke" strokeWidth={2.4} strokeCap="round"><LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={[P.p1, P.p2]} /></Paint></Path>
          <Path path={orbitB} opacity={orbitsO}><Paint style="stroke" strokeWidth={2} strokeCap="round"><LinearGradient start={vec(width, 0)} end={vec(0, height)} colors={[P.p2, P.p1]} /></Paint></Path>
          <Path path={embers} opacity={embersO}><Paint style="stroke" strokeWidth={1.6} strokeCap="round" color={P.p1} /></Paint></Path>
          <Circle cx={eyeLX} cy={eyeY} r={haloR} opacity={eyeO}><RadialGradient c={vec(eyeLX, eyeY)} r={haloR} colors={[P.eyeHalo, '#00000000']} /></Circle>
          <Circle cx={eyeRX} cy={eyeY} r={haloR} opacity={eyeO}><RadialGradient c={vec(eyeRX, eyeY)} r={haloR} colors={[P.eyeHalo, '#00000000']} /></Circle>
          <Circle cx={eyeLX} cy={eyeY} r={coreR} color={P.eyeCore} opacity={eyeO} />
          <Circle cx={eyeRX} cy={eyeY} r={coreR} color={P.eyeCore} opacity={eyeO} />
          <Circle cx={eyeLX} cy={eyeY} r={1.1} color="#FFFFFF" opacity={eyeO} />
          <Circle cx={eyeRX} cy={eyeY} r={1.1} color="#FFFFFF" opacity={eyeO} />
        </Canvas>
        <Animated.View style={[st.brand, logoStyle]}>
          <Image source={require('../assets/brand/logo.png')} style={st.logo} resizeMode="contain" />
        </Animated.View>
        <Animated.Text style={[st.name, nameStyle]}>© By SOULSYNC</Animated.Text>
      </Animated.View>
    </View>
  );
}
const st = StyleSheet.create({
  root: { flex: 1 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  brand: { position: 'absolute', bottom: 84, alignSelf: 'center' },
  logo: { width: 56, height: 56 },
  name: { position: 'absolute', bottom: 58, alignSelf: 'center', fontSize: 12, letterSpacing: 2.5, fontWeight: '300', color: '#B8A0D0' },
});
