import React, { useEffect } from 'react';
import { View, Image, Text, StyleSheet, Dimensions, StatusBar } from 'react-native';
import { router } from 'expo-router';
import { Canvas, Circle, Path, RadialGradient, vec, BlurMask, Paint } from '@shopify/react-native-skia';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withSpring, withDelay, Easing, useFrameCallback } from 'react-native-reanimated';
import { audioMixer } from '../src/core/AudioMixer';
const { width, height } = Dimensions.get('window');
const CX = width / 2, CY = height * 0.42;
const buildStars = (t: number): string => {
  let d = '';
  for (let i = 0; i < 18; i++) {
    const seed = i * 97.13; const x = (seed * 13.7) % width; const speed = 10 + (i % 5) * 6;
    const y = height - ((seed * 3.1 + t * speed) % (height + 40));
    const tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
    if (tw < 0.2) continue;
    const r = 0.8 + tw * 1.8;
    d += `M ${x + r} ${y} A ${r} ${r} 0 1 0 ${x - r} ${y} A ${r} ${r} 0 1 0 ${x + r} ${y} `;
  }
  return d;
};
export default function Index() {
  const sparkA = useSharedValue(0); const logoO = useSharedValue(0); const logoS = useSharedValue(0.92);
  const textO = useSharedValue(0); const exitO = useSharedValue(1); const floatY = useSharedValue(0);
  const b1x = useSharedValue(CX); const b1y = useSharedValue(height * 0.3);
  const b2x = useSharedValue(CX); const b2y = useSharedValue(height * 0.62);
  const b3x = useSharedValue(CX); const b3y = useSharedValue(height * 0.8);
  const stars = useSharedValue(''); const starsA = useSharedValue(0.4);
  const r1 = useSharedValue(0); const a1 = useSharedValue(0); const r2 = useSharedValue(0); const a2 = useSharedValue(0);
  const ringR = useSharedValue(90); const ringO = useSharedValue(0);
  useFrameCallback((fi) => {
    const t = fi.timeSinceFirstFrame * 0.001;
    b1x.value = CX + Math.sin(t * 0.11) * width * 0.25; b1y.value = height * 0.3 + Math.cos(t * 0.07) * 40;
    b2x.value = CX - Math.sin(t * 0.09 + 2) * width * 0.3; b2y.value = height * 0.62 + Math.sin(t * 0.05) * 50;
    b3x.value = CX + Math.cos(t * 0.13 + 4) * width * 0.2; b3y.value = height * 0.8 + Math.cos(t * 0.06) * 30;
    floatY.value = Math.sin(t * 0.9) * 6;
    stars.value = buildStars(t); starsA.value = 0.35 + 0.25 * Math.sin(t * 1.3);
    const span = 3.2; const f1 = (t % span) / span, f2 = ((t + span / 2) % span) / span;
    r1.value = 90 + f1 * 170; a1.value = (1 - f1) * 0.35;
    r2.value = 90 + f2 * 170; a2.value = (1 - f2) * 0.28;
  });
  const fadeStyle = useAnimatedStyle(() => ({ opacity: exitO.value }));
  const logoStyle = useAnimatedStyle(() => ({ opacity: logoO.value, transform: [{ scale: logoS.value }, { translateY: floatY.value }] as any }));
  const textStyle = useAnimatedStyle(() => ({ opacity: textO.value }));
  useEffect(() => {
    const play = (e: string) => { try { audioMixer.playEffect(e); } catch {} };
    const seq = async () => {
      await new Promise(r => setTimeout(r, 900));
      sparkA.value = withSequence(withTiming(0.9, { duration: 700 }), withTiming(0.2, { duration: 900 }));
      play('first_breath');
      await new Promise(r => setTimeout(r, 1200));
      logoO.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) });
      logoS.value = withSpring(1, { damping: 14, stiffness: 120 });
      play('awakening_glow');
      await new Promise(r => setTimeout(r, 1500));
      textO.value = withTiming(0.65, { duration: 1500 });
      await new Promise(r => setTimeout(r, 1800));
      play('workspace_enter');
      ringO.value = withTiming(0.9, { duration: 200 });
      ringR.value = withTiming(width * 1.4, { duration: 900, easing: Easing.out(Easing.cubic) });
      ringO.value = withDelay(300, withTiming(0, { duration: 600 }));
      exitO.value = withDelay(350, withTiming(0, { duration: 600 }));
      setTimeout(() => router.replace('/genesis'), 1000);
    };
    seq();
  }, []);
  return (
    <View style={st.root}>
      <StatusBar hidden />
      <Animated.View style={[st.fill, fadeStyle]}>
        <Canvas style={st.fill}>
          <Circle cx={b1x} cy={b1y} r={210} color="#7C3AED" opacity={0.3}><BlurMask blur={40} style="normal" /></Circle>
          <Circle cx={b2x} cy={b2y} r={240} color="#4C1D95" opacity={0.35}><BlurMask blur={44} style="normal" /></Circle>
          <Circle cx={b3x} cy={b3y} r={170} color="#0EA5E9" opacity={0.18}><BlurMask blur={36} style="normal" /></Circle>
          <Path path={stars} color="#E9D5FF" opacity={starsA} style="fill" />
          <Circle cx={CX} cy={CY} r={r1} color="#A855F7" style="stroke" strokeWidth={2} opacity={a1} />
          <Circle cx={CX} cy={CY} r={r2} color="#A855F7" style="stroke" strokeWidth={1.5} opacity={a2} />
          <Circle cx={CX} cy={CY} r={30} opacity={sparkA}><Paint><RadialGradient c={vec(CX, CY)} r={30} colors={['#FFFFFF', '#A855F7', '#00000000']} /></Paint></Circle>
          <Circle cx={CX} cy={CY} r={120} color="#A855F7" opacity={0.4}><BlurMask blur={24} style="normal" /></Circle>
          <Circle cx={CX} cy={CY} r={ringR} color="#E9D5FF" style="stroke" strokeWidth={3} opacity={ringO} />
          <Circle cx={CX} cy={CY} r={height * 0.75}><Paint><RadialGradient c={vec(CX, CY)} r={height * 0.75} colors={['#00000000', '#00000000', '#000005E6']} /></Paint></Circle>
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
