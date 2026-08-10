import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Path, RadialGradient, vec } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import type { PresenceState } from '../../../engine/presence/PresenceTypes';
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
type RGB = { r: number; g: number; b: number };
const rgba = (c: RGB, alpha = 1) => `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${clamp(alpha)})`;
function useOrbitPath(cx: number, cy: number, radius: number, phaseSeed: number, direction: number, tilt: number,
  speed: SharedValue<number>, turbulence: SharedValue<number>, breathing: SharedValue<number>, pulse: SharedValue<number>, orbitality: SharedValue<number>, slow: SharedValue<number>) {
  return useDerivedValue(() => {
    'worklet';
    const t = slow.value / 1000;
    const phase = phaseSeed + t * direction * (0.12 + speed.value * 0.75) * (0.75 + orbitality.value);
    const points = 48;
    const wobble = radius * (0.012 + turbulence.value * 0.035 + pulse.value * 0.012);
    const breath = 1 + Math.sin(t * (0.65 + breathing.value * 0.55)) * 0.018 * breathing.value;
    let d = '';
    for (let i = 0; i <= points; i += 1) {
      const a = (i / points) * Math.PI * 2;
      const r = radius * breath + Math.sin(a * 3 + phase * 1.7) * wobble + Math.cos(a * 5 - phase * 0.9) * wobble * 0.42 + Math.sin(a * 9 + phase * 0.45) * wobble * 0.18;
      d += `${i === 0 ? 'M' : 'L'} ${cx + Math.cos(a + phase * 0.08) * r} ${cy + Math.sin(a + phase * 0.08) * r * (0.54 + tilt * 0.16)} `;
    }
    return `${d}Z`;
  });
}
function useParticlePath(cx: number, cy: number, radius: number, speed: SharedValue<number>, anticipation: SharedValue<number>, slow: SharedValue<number>) {
  return useDerivedValue(() => {
    'worklet';
    const t = slow.value / 1000;
    let d = '';
    for (let i = 0; i < 22; i += 1) {
      const seed = i * 17.271;
      const angle = seed + t * (0.025 + (i % 5) * 0.008) * (0.6 + speed.value * 1.5);
      const orbitRadius = radius * (1.02 + ((i * 37) % 100) / 100 * 0.95);
      const size = 0.55 + (((i * 13) % 10) / 10) * (0.8 + anticipation.value * 1.6);
      d += `M ${cx + Math.cos(angle) * orbitRadius} ${cy + Math.sin(angle) * orbitRadius * 0.58} l ${size} ${size * 0.35} `;
    }
    return d;
  });
}
function useEyePath(cx: number, cy: number, side: number, size: number, eyeOpen: SharedValue<number>, gazeX: SharedValue<number>, gazeY: SharedValue<number>, eyeTilt: SharedValue<number>, separation: SharedValue<number>, thinking: boolean, speaking: boolean, slow: SharedValue<number>) {
  return useDerivedValue(() => {
    'worklet';
    const t = slow.value / 1000;
    const blink = Math.max(Math.pow(Math.max(0, Math.sin(t * 0.73 + 1.7)), 34), Math.pow(Math.max(0, Math.sin(t * 0.41 + 4.4)), 48) * 0.72);
    const open = clamp(eyeOpen.value) * (1 - clamp(blink * 0.96)) * (thinking ? 0.86 : 1);
    const gap = size * 0.07 * separation.value;
    const centerX = cx + side * gap; const centerY = cy - size * 0.018;
    const width = size * 0.118;
    const height = Math.max(size * 0.012, size * 0.054 * open);
    const gx = gazeX.value * size * 0.026; const gy = gazeY.value * size * 0.018;
    const tilt = eyeTilt.value * size * 0.045;
    const leftX = centerX - width + gx; const rightX = centerX + width + gx;
    const leftY = centerY + tilt + gy; const rightY = centerY - tilt + gy;
    const upper = height * (speaking ? 0.92 : 1.08); const lower = height * (speaking ? 0.78 : 0.94);
    return `M ${leftX} ${leftY} C ${centerX - width * 0.45 + gx} ${centerY - upper + gy}, ${centerX + width * 0.45 + gx} ${centerY - upper + gy}, ${rightX} ${rightY} C ${centerX + width * 0.48 + gx} ${centerY + lower + gy}, ${centerX - width * 0.48 + gx} ${centerY + lower + gy}, ${leftX} ${leftY} Z`;
  });
}
export default function DigitalBeing({ presence, size = 360, isDark: _isDark = true }: { presence: PresenceState; size?: number; isDark?: boolean }) {
  const cx = size / 2; const cy = size / 2; const core = size * 0.285;
  const fast = useSharedValue(0);
  const slow = useSharedValue(0);
  useFrameCallback((f) => { fast.value = f.timeSinceFirstFrame; });
  useEffect(() => { const iv = setInterval(() => { slow.value = Date.now() % 100000000; }, 50); return () => clearInterval(iv); }, []);
  const energy = useSharedValue(presence.energy); const speed = useSharedValue(presence.fieldSpeed);
  const turbulence = useSharedValue(presence.turbulence); const attention = useSharedValue(presence.attention);
  const breathing = useSharedValue(presence.breathing); const pulse = useSharedValue(presence.pulse);
  const eyeOpen = useSharedValue(presence.eyeOpenness); const eyeGlow = useSharedValue(presence.eyeGlow);
  const pupilSize = useSharedValue(presence.pupilSize); const gazeX = useSharedValue(presence.gazeX);
  const gazeY = useSharedValue(presence.gazeY); const warmth = useSharedValue(presence.warmth);
  const anticipation = useSharedValue(presence.anticipation); const orbitality = useSharedValue(presence.orbitality);
  const touch = useSharedValue(presence.touch); const voice = useSharedValue(presence.voiceLevel);
  const proximity = useSharedValue(presence.proximity);
  const eyeTilt = useSharedValue(presence.eyeTilt); const separation = useSharedValue(presence.eyeSeparation);
  useEffect(() => {
    energy.value = withTiming(presence.energy, { duration: 180 }); speed.value = withTiming(presence.fieldSpeed, { duration: 220 });
    turbulence.value = withTiming(presence.turbulence, { duration: 220 }); attention.value = withTiming(presence.attention, { duration: 220 });
    breathing.value = withTiming(presence.breathing, { duration: 260 }); pulse.value = withTiming(presence.pulse, { duration: 180 });
    eyeOpen.value = withTiming(presence.eyeOpenness, { duration: 180 }); eyeGlow.value = withTiming(presence.eyeGlow, { duration: 180 });
    pupilSize.value = withTiming(presence.pupilSize, { duration: 180 }); gazeX.value = withTiming(presence.gazeX, { duration: 240 });
    gazeY.value = withTiming(presence.gazeY, { duration: 240 }); warmth.value = withTiming(presence.warmth, { duration: 280 });
    anticipation.value = withTiming(presence.anticipation, { duration: 240 }); orbitality.value = withTiming(presence.orbitality, { duration: 240 });
    touch.value = withTiming(presence.touch, { duration: 130 }); voice.value = withTiming(presence.voiceLevel, { duration: 100 });
    proximity.value = withTiming(presence.proximity, { duration: 220 });
    eyeTilt.value = withTiming(presence.eyeTilt, { duration: 220 }); separation.value = withTiming(presence.eyeSeparation, { duration: 220 });
  }, [presence]);
  const colorA = useMemo(() => rgba(presence.colorA), [presence.colorA]);
  const colorB = useMemo(() => rgba(presence.colorB), [presence.colorB]);
  const eyeColor = useMemo(() => rgba(presence.eyeColor), [presence.eyeColor]);
  const fadeA = useMemo(() => rgba(presence.colorA, 0), [presence.colorA]);
  const fadeB = useMemo(() => rgba(presence.colorB, 0), [presence.colorB]);
  const eyeOpacity = useDerivedValue(() => clamp(0.68 + eyeGlow.value * 0.3));
  const fieldOpacity = useDerivedValue(() => clamp(0.2 + energy.value * 0.34 + attention.value * 0.2 + warmth.value * 0.08 + proximity.value * 0.08, 0, 0.88));
  const coreRadius = useDerivedValue(() => core * (1 + Math.sin(fast.value / 1000 * (0.65 + breathing.value * 0.45)) * 0.035 * breathing.value + Math.max(0, Math.sin(fast.value / 1000 * (2.4 + pulse.value * 4))) * 0.025 * pulse.value));
  const haloRadius = useDerivedValue(() => coreRadius.value * (1.15 + energy.value * 0.12 + touch.value * 0.12));
  const rippleRadius = useDerivedValue(() => core * (1.56 + voice.value * 0.26 + touch.value * 0.46 + Math.sin(slow.value / 1000 * 0.7) * 0.035));
  const coreGlow = useDerivedValue(() => clamp(0.16 + energy.value * 0.22 + warmth.value * 0.12));
  const touchGlow = useDerivedValue(() => clamp(0.04 + touch.value * 0.42));
  const voiceRipple = useDerivedValue(() => clamp(0.03 + voice.value * 0.32));
  const particlePath = useParticlePath(cx, cy, core * 1.25, speed, anticipation, slow);
  const orbit1 = useOrbitPath(cx, cy, core * 1.05, 0.0, 1, 0.86, speed, turbulence, breathing, pulse, orbitality, slow);
  const orbit2 = useOrbitPath(cx, cy, core * 1.16, 0.8, -1, 0.72, speed, turbulence, breathing, pulse, orbitality, slow);
  const orbit3 = useOrbitPath(cx, cy, core * 1.3, 1.55, 1, 0.58, speed, turbulence, breathing, pulse, orbitality, slow);
  const orbit4 = useOrbitPath(cx, cy, core * 1.44, 2.25, -1, 0.48, speed, turbulence, breathing, pulse, orbitality, slow);
  const orbit5 = useOrbitPath(cx, cy, core * 1.58, 3.0, 1, 0.4, speed, turbulence, breathing, pulse, orbitality, slow);
  const orbit6 = useOrbitPath(cx, cy, core * 1.72, 3.65, -1, 0.34, speed, turbulence, breathing, pulse, orbitality, slow);
  const orbit7 = useOrbitPath(cx, cy, core * 1.86, 4.25, 1, 0.3, speed, turbulence, breathing, pulse, orbitality, slow);
  const leftEye = useEyePath(cx, cy, -1, size, eyeOpen, gazeX, gazeY, eyeTilt, separation, presence.thinking, presence.speaking, slow);
  const rightEye = useEyePath(cx, cy, 1, size, eyeOpen, gazeX, gazeY, eyeTilt, separation, presence.thinking, presence.speaking, slow);
  const liX = useDerivedValue(() => cx - size * 0.07 * separation.value + gazeX.value * size * 0.026);
  const riX = useDerivedValue(() => cx + size * 0.07 * separation.value + gazeX.value * size * 0.026);
  const iY = useDerivedValue(() => cy - size * 0.018 + gazeY.value * size * 0.018);
  const iR = useDerivedValue(() => size * (0.016 + pupilSize.value * 0.016));
  const browL = useDerivedValue(() => { 'worklet'; const y = cy - size * 0.095 + gazeY.value * size * 0.008; const tl = eyeTilt.value * size * 0.065; const x = cx - size * 0.07 + gazeX.value * size * 0.018; return `M ${x - size * 0.07} ${y + tl} Q ${x} ${y - size * 0.022} ${x + size * 0.07} ${y - tl}`; });
  const browR = useDerivedValue(() => { 'worklet'; const y = cy - size * 0.095 + gazeY.value * size * 0.008; const tl = eyeTilt.value * size * 0.065; const x = cx + size * 0.07 + gazeX.value * size * 0.018; return `M ${x - size * 0.07} ${y - tl} Q ${x} ${y - size * 0.022} ${x + size * 0.07} ${y + tl}`; });
  return (
    <View accessible accessibilityLabel={`MyTwin digital being: ${presence.emotion}`} style={[styles.container, { width: size, height: size }]}>
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={cx} cy={cy} r={coreRadius} opacity={fieldOpacity}>
          <RadialGradient c={vec(cx, cy)} r={core * 1.28} colors={[rgba(presence.colorA, 0.82), rgba(presence.colorB, 0.42), fadeA]} />
        </Circle>
        <Circle cx={cx} cy={cy} r={haloRadius} opacity={coreGlow}>
          <RadialGradient c={vec(cx, cy)} r={core * 1.72} colors={[rgba(presence.colorB, 0.38), rgba(presence.colorA, 0.18), fadeB]} />
        </Circle>
        <Path path={orbit7} style="stroke" strokeWidth={0.65} color={colorB} opacity={0.18} />
        <Path path={orbit6} style="stroke" strokeWidth={0.75} color={colorA} opacity={0.22} />
        <Path path={orbit5} style="stroke" strokeWidth={0.9} color={colorB} opacity={0.3} />
        <Path path={orbit4} style="stroke" strokeWidth={1.05} color={colorA} opacity={0.36} />
        <Path path={orbit3} style="stroke" strokeWidth={1.2} color={colorB} opacity={0.42} />
        <Path path={orbit2} style="stroke" strokeWidth={1.35} color={colorA} opacity={0.48} />
        <Path path={orbit1} style="stroke" strokeWidth={1.55} color={colorB} opacity={0.58} />
        <Circle cx={cx} cy={cy} r={rippleRadius} style="stroke" strokeWidth={0.75} color={colorB} opacity={voiceRipple} />
        <Circle cx={cx} cy={cy} r={core * 1.92} style="stroke" strokeWidth={0.55} color={colorA} opacity={0.12} />
        <Path path={particlePath} style="stroke" strokeWidth={1.05} strokeCap="round" color={colorB} opacity={0.34} />
        <Path path={leftEye} color={eyeColor} opacity={eyeOpacity} />
        <Path path={rightEye} color={eyeColor} opacity={eyeOpacity} />
        <Path path={leftEye} style="stroke" strokeWidth={0.75} color={colorB} opacity={0.82} />
        <Path path={rightEye} style="stroke" strokeWidth={0.75} color={colorB} opacity={0.82} />
        <Path path={browL} style="stroke" strokeWidth={1.15} strokeCap="round" color={eyeColor} opacity={0.48} />
        <Path path={browR} style="stroke" strokeWidth={1.15} strokeCap="round" color={eyeColor} opacity={0.48} />
        <Circle cx={liX} cy={iY} r={iR} opacity={eyeOpacity}>
          <RadialGradient c={vec(cx - size * 0.07, cy - size * 0.018)} r={size * 0.035} colors={[eyeColor, rgba(presence.colorB, 0.15), fadeB]} />
        </Circle>
        <Circle cx={riX} cy={iY} r={iR} opacity={eyeOpacity}>
          <RadialGradient c={vec(cx + size * 0.07, cy - size * 0.018)} r={size * 0.035} colors={[eyeColor, rgba(presence.colorB, 0.15), fadeB]} />
        </Circle>
        <Circle cx={liX} cy={iY} r={size * 0.01} color="#FFFFFF" opacity={0.96} />
        <Circle cx={riX} cy={iY} r={size * 0.01} color="#FFFFFF" opacity={0.96} />
        <Circle cx={cx} cy={cy + core * 0.66} r={core * 0.02} color={colorB} opacity={touchGlow} />
      </Canvas>
    </View>
  );
}
const styles = StyleSheet.create({ container: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' } });
