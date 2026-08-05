import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group, BlurMask, RadialGradient, vec, Paint } from '@shopify/react-native-skia';
import { useSharedValue, useFrameCallback } from 'react-native-reanimated';
import { LivingEyes } from './LivingEyes';
import { stateBus } from '../../core/StateBus';
const { width: SW, height: SH } = Dimensions.get('window');
const ENTITY_SIZE = Math.min(SW, SH) * 0.9;
const CX = ENTITY_SIZE / 2, CY = ENTITY_SIZE / 2;
const EMOTION_COLORS: Record<string, string> = {
  joy: '#F59E0B', sadness: '#38BDF8', fear: '#FB7185', anger: '#F87171',
  calm: '#A78BFA', curious: '#22D3EE', focused: '#60A5FA', neutral: '#A855F7',
};
interface Props { size?: number; eyeOpenness: number; pupilSize: number; auraSize: number; auraOpacity: number; membraneAmplitude: number; membraneSpeed: number; waveSpeed: number; energyLevel: number; warmth: number; auraFlicker: number; gazeX: number; gazeY: number; eyeExpression: any; headTilt: number; trailState: any; }
export const DigitalBeing: React.FC<Props> = ({ size = ENTITY_SIZE, eyeOpenness, pupilSize, auraSize, auraOpacity, membraneAmplitude, membraneSpeed, waveSpeed, energyLevel, warmth, auraFlicker, gazeX, gazeY, eyeExpression, headTilt, trailState }) => {
  const [accent, setAccent] = useState('#A855F7');
  useEffect(() => stateBus.subscribeTo(s => s.emotion.primaryEmotion, e => setAccent(EMOTION_COLORS[e] || '#A855F7')), []);
  const time = useSharedValue(0);
  useFrameCallback(fi => { time.value = fi.timeSinceFirstFrame; });
  const r1 = useSharedValue(0); const a1 = useSharedValue(0); const r2 = useSharedValue(0); const a2 = useSharedValue(0); const r3 = useSharedValue(0); const a3 = useSharedValue(0);
  useFrameCallback(() => {
    const t = time.value * 0.001; const base = size * auraSize * 0.9; const span = 3.6;
    const f1 = (t % span) / span, f2 = ((t + span / 3) % span) / span, f3 = ((t + 2 * span / 3) % span) / span;
    r1.value = base + f1 * 95; a1.value = (1 - f1) * 0.42 * Math.max(0.55, auraOpacity);
    r2.value = base + f2 * 95; a2.value = (1 - f2) * 0.32 * Math.max(0.55, auraOpacity);
    r3.value = base + f3 * 95; a3.value = (1 - f3) * 0.24 * Math.max(0.55, auraOpacity);
  });
  const as = auraSize * 1.5; const ao = Math.max(0.55, auraOpacity); const af = auraFlicker; const el = energyLevel; const wm = warmth;
  const waveCount = Math.max(3, Math.round(el * 6)); const auraLayers = Math.max(4, Math.round(el * 5));
  const strokeWidth = 16 + wm * 10;
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View style={{ transform: [{ rotate: `${headTilt}deg` }] }}>
        <Canvas style={{ width: size, height: size }}>
          {trailState && (<Circle cx={CX} cy={CY} r={size * trailState.auraSize * 0.9} color={trailState.auraColor} opacity={trailState.auraOpacity * 0.25}><BlurMask blur={30} style="solid" /></Circle>)}
          <Circle cx={CX} cy={CY} r={r1} color={accent} style="stroke" strokeWidth={3} opacity={a1} />
          <Circle cx={CX} cy={CY} r={r2} color={accent} style="stroke" strokeWidth={2.5} opacity={a2} />
          <Circle cx={CX} cy={CY} r={r3} color={accent} style="stroke" strokeWidth={2} opacity={a3} />
          <Group>{Array.from({ length: auraLayers }).map((_, i) => { const r = as * (1 - i * 0.1); const opacity = ao * (0.6 - i * 0.08); return (<Circle key={i} cx={CX} cy={CY} r={r} color={accent} opacity={Math.max(0.06, opacity)}><BlurMask blur={25 - i * 3} style="solid" /></Circle>); })}</Group>
          {af > 0 && (<Circle cx={CX} cy={CY} r={as * 1.1} color="#FFFFFF" opacity={af * 0.35}><BlurMask blur={20} style="solid" /></Circle>)}
          <Circle cx={CX} cy={CY} r={as * 0.75} color="#E9D5FF" style="stroke" strokeWidth={4} opacity={ao * 0.9}><BlurMask blur={8} style="normal" /></Circle>
          {waveCount > 0 && Array.from({ length: waveCount }).map((_, i) => { const radius = size * 0.5 + (i * 15); const opacity = 0.35 * (1 - i / waveCount) * ao; return (<Circle key={`w-${i}`} cx={CX} cy={CY} r={radius} color={accent} opacity={opacity} style="stroke" strokeWidth={strokeWidth - i} />); })}
          <Circle cx={CX} cy={CY} r={size * 0.2} opacity={0.9}><Paint><RadialGradient c={vec(CX, CY)} r={size * 0.2} colors={['#FFFFFF', accent, '#00000000']} /></Paint></Circle>
          <Circle cx={CX} cy={CY} r={size * 0.18} color="#1a1a2e" />
          <LivingEyes size={size} expression={eyeExpression} eyeOpenness={eyeOpenness} pupilSize={pupilSize} gazeX={gazeX} gazeY={gazeY} />
        </Canvas>
      </View>
    </View>
  );
};
const styles = StyleSheet.create({ container: { justifyContent: 'center', alignItems: 'center' } });
