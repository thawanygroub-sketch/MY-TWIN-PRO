import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, Path, RadialGradient, vec } from '@shopify/react-native-skia';
import { useDerivedValue, useSharedValue, withTiming, useFrameCallback } from 'react-native-reanimated';
import type { PresenceState } from '../../../engine/presence/PresenceTypes';
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const rgba = (c: { r: number; g: number; b: number }, a = 1) => `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${clamp(a, 0, 1)})`;
export default function DigitalBeing({ presence, size = 340, isDark = true }: { presence: PresenceState; size?: number; isDark?: boolean }) {
  const [colA, setColA] = useState(rgba(presence.colorA));
  const [colB, setColB] = useState(rgba(presence.colorB));
  useEffect(() => { setColA(rgba(presence.colorA)); setColB(rgba(presence.colorB)); }, [presence.colorA, presence.colorB]);
  const clock = useSharedValue(0);
  useFrameCallback((fi) => { clock.value = fi.timeSinceFirstFrame; });
  const energy = useSharedValue(presence.energy); const speed = useSharedValue(presence.fieldSpeed);
  const turb = useSharedValue(presence.turbulence); const att = useSharedValue(presence.attention);
  const breath = useSharedValue(presence.breathing); const pulse = useSharedValue(presence.pulse);
  const eyeOpen = useSharedValue(presence.eyeOpenness); const eyeGlow = useSharedValue(presence.eyeGlow);
  const pupil = useSharedValue(presence.pupilSize); const gX = useSharedValue(presence.gazeX);
  const gY = useSharedValue(presence.gazeY); const touch = useSharedValue(presence.touch);
  const voice = useSharedValue(presence.voiceLevel); const warmth = useSharedValue(presence.warmth);
  const orbit = useSharedValue(presence.orbitality); const ant = useSharedValue(presence.anticipation);
  useEffect(() => {
    energy.value = withTiming(presence.energy, { duration: 140 }); speed.value = withTiming(presence.fieldSpeed, { duration: 180 });
    turb.value = withTiming(presence.turbulence, { duration: 180 }); att.value = withTiming(presence.attention, { duration: 180 });
    breath.value = withTiming(presence.breathing, { duration: 220 }); pulse.value = withTiming(presence.pulse, { duration: 160 });
    eyeOpen.value = withTiming(presence.eyeOpenness, { duration: 160 }); eyeGlow.value = withTiming(presence.eyeGlow, { duration: 160 });
    pupil.value = withTiming(presence.pupilSize, { duration: 160 }); gX.value = withTiming(presence.gazeX, { duration: 220 });
    gY.value = withTiming(presence.gazeY, { duration: 220 }); touch.value = withTiming(presence.touch, { duration: 120 });
    voice.value = withTiming(presence.voiceLevel, { duration: 100 }); warmth.value = withTiming(presence.warmth, { duration: 260 });
    orbit.value = withTiming(presence.orbitality, { duration: 220 }); ant.value = withTiming(presence.anticipation, { duration: 220 });
  }, [presence]);
  const cx = size / 2, cy = size / 2, base = size * 0.285;
  const mem = (R: number, seed: number, dir: number) => useDerivedValue(() => {
    'worklet';
    const t = clock.value / 1000;
    const phase = t * (0.35 + speed.value) * dir + seed;
    const wob = base * (0.025 + turb.value * 0.11 + voice.value * 0.04 + touch.value * 0.025);
    const br = 1 + Math.sin(t * (1.0 + breath.value * 0.5)) * 0.025 * breath.value + Math.max(0, Math.sin(t * (4 + pulse.value * 3))) * 0.03 * pulse.value;
    const pts = 48; let d = '';
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2 + seed;
      const h = Math.sin(a * 3 + phase) * wob + Math.cos(a * 5 - phase * 0.7) * wob * 0.55 + Math.sin(a * 7 + phase * 0.35) * wob * 0.22;
      const r = R * br + h;
      d += (i === 0 ? 'M ' : ' L ') + (cx + Math.cos(a) * r) + ' ' + (cy + Math.sin(a) * r * 0.88);
    }
    return d + ' Z';
  });
  const m1 = mem(base * 1.22, 0, 1); const m2 = mem(base * 1.38, 0.95, -1); const m3 = mem(base * 1.55, 2.1, 1);
  const eyeH = useDerivedValue(() => {
    'worklet';
    const t = clock.value / 1000;
    const b1 = Math.pow(Math.max(0, Math.sin(t * 0.71 + 1.3)), 30);
    const b2 = Math.pow(Math.max(0, Math.sin(t * 0.37 + 4.9)), 42);
    return Math.max(0.8, size * 0.055 * eyeOpen.value * (1 - Math.max(b1, b2 * 0.75)));
  });
  const eye = (side: number) => useDerivedValue(() => {
    'worklet';
    const gap = size * 0.048 * (0.92 + orbit.value * 0.14);
    const cX = cx + side * gap, cY = cy - size * 0.015, w = size * 0.105, h = eyeH.value;
    const gx = gX.value * size * 0.025, gy = gY.value * size * 0.018, dx = Math.sin(side * 0.018) * h;
    return 'M ' + (cX - w + gx) + ' ' + (cY + dx) +
      ' C ' + (cX - w * 0.35 + gx) + ' ' + (cY - h + gy) + ' ' + (cX + w * 0.35 + gx) + ' ' + (cY - h + gy) + ' ' + (cX + w + gx) + ' ' + (cY - dx) +
      ' C ' + (cX + w * 0.35 + gx) + ' ' + (cY + h + gy) + ' ' + (cX - w * 0.35 + gx) + ' ' + (cY + h + gy) + ' ' + (cX - w + gx) + ' ' + (cY + dx) + ' Z';
  });
  const eL = eye(-1); const eR = eye(1);
  const pR = useDerivedValue(() => size * (0.014 + pupil.value * 0.014));
  const lX = useDerivedValue(() => cx - size * 0.048 + gX.value * size * 0.025);
  const rX = useDerivedValue(() => cx + size * 0.048 + gX.value * size * 0.025);
  const pY = useDerivedValue(() => cy - size * 0.015 + gY.value * size * 0.018);
  const eyeOp = useDerivedValue(() => clamp(0.7 + eyeGlow.value * 0.3, 0, 1));
  const fieldOp = useDerivedValue(() => clamp(0.26 + energy.value * 0.46 + att.value * 0.18, 0, 0.92));
  const auraOp = useDerivedValue(() => clamp(0.06 + warmth.value * 0.16 + touch.value * 0.15, 0, 0.42));
  const rippleR = useDerivedValue(() => base * (1.08 + voice.value * 0.45 + touch.value * 0.55));
  const lashes = useDerivedValue(() => {
    'worklet';
    let d = '';
    const gy = gY.value * size * 0.018;
    for (const side of [-1, 1]) {
      const cX = cx + side * size * 0.048, cY = cy - size * 0.015 - eyeH.value + gy;
      for (let i = -1; i <= 1; i++) {
        const x0 = cX + i * size * 0.03;
        d += 'M ' + x0 + ' ' + (cY - Math.abs(i) * 1.5) + ' L ' + (x0 + i * size * 0.012) + ' ' + (cY - Math.abs(i) * 1.5 - size * 0.02 * eyeOpen.value) + ' ';
      }
    }
    return d;
  });
  const sparks = useDerivedValue(() => {
    'worklet';
    const t = clock.value / 1000; let d = '';
    for (let i = 0; i < 12; i++) {
      const seed = i * 41.3; const a = seed + t * (0.1 + (i % 3) * 0.05) * (1 + ant.value);
      const r = base * (1.5 + (((seed * 7.3) % 100) / 100) * 0.5);
      d += 'M ' + (cx + Math.cos(a) * r) + ' ' + (cy + Math.sin(a) * r * 0.9) + ' l 0.8 0.8 ';
    }
    return d;
  });
  const heart = useDerivedValue(() => {
    'worklet';
    const s = pR.value * 2.2; let d = '';
    for (const px of [lX.value, rX.value]) {
      const py = pY.value;
      d += 'M ' + px + ' ' + (py + s * 0.35) +
        ' C ' + (px - s * 0.5) + ' ' + (py - s * 0.15) + ' ' + (px - s * 0.2) + ' ' + (py - s * 0.5) + ' ' + px + ' ' + (py - s * 0.15) +
        ' C ' + (px + s * 0.2) + ' ' + (py - s * 0.5) + ' ' + (px + s * 0.5) + ' ' + (py - s * 0.15) + ' ' + px + ' ' + (py + s * 0.35) + ' Z ';
    }
    return d;
  });
  const isHeart = presence.emotion === 'caring' || (presence.emotion === 'happy' && presence.warmth > 0.6);
  const sparkOp = useDerivedValue(() => clamp(0.15 + ant.value * 0.5, 0, 0.7));
  const lashOp = useDerivedValue(() => eyeOp.value * 0.8);
  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={StyleSheet.absoluteFill}>
        {!isDark && <Circle cx={cx} cy={cy} r={base * 1.9} opacity={0.28}><RadialGradient c={vec(cx, cy)} r={base * 1.9} colors={['rgba(18,11,30,0.9)', 'rgba(18,11,30,0)']} /></Circle>}
        <Circle cx={cx} cy={cy} r={base * 1.05} opacity={fieldOp}><RadialGradient c={vec(cx, cy)} r={base * 1.05} colors={[colA, colB, 'rgba(0,0,0,0)']} /></Circle>
        <Path path={m3} style="stroke" strokeWidth={1} color={colB} opacity={0.2} />
        <Path path={m2} style="stroke" strokeWidth={1.55} color={colA} opacity={0.34} />
        <Path path={m1} style="stroke" strokeWidth={2} color={colA} opacity={0.54} />
        <Path path={m2} style="stroke" strokeWidth={0.75} color={colB} opacity={0.62} />
        <Path path={m1} style="stroke" strokeWidth={0.65} color={colA} opacity={0.76} />
        <Path path={sparks} style="stroke" strokeWidth={1.4} strokeCap="round" color={colB} opacity={sparkOp} />
        <Circle cx={cx} cy={cy} r={rippleR} style="stroke" strokeWidth={0.8} color={colB} opacity={auraOp} />
        <Path path={eL} color={colA} opacity={eyeOp} />
        <Path path={eR} color={colA} opacity={eyeOp} />
        <Circle cx={lX} cy={pY} r={pR} opacity={eyeOp}><RadialGradient c={vec(cx - size * 0.048, cy - size * 0.015)} r={pR} colors={[colA, 'rgba(0,0,0,0)']} /></Circle>
        <Circle cx={rX} cy={pY} r={pR} opacity={eyeOp}><RadialGradient c={vec(cx + size * 0.048, cy - size * 0.015)} r={pR} colors={[colA, 'rgba(0,0,0,0)']} /></Circle>
        <Circle cx={lX} cy={pY} r={pR} style="stroke" strokeWidth={0.8} color={colB} opacity={eyeOp} />
        <Circle cx={rX} cy={pY} r={pR} style="stroke" strokeWidth={0.8} color={colB} opacity={eyeOp} />
        {isHeart
          ? <Path path={heart} color="#FF82DC" opacity={0.96} />
          : <>
              <Circle cx={lX} cy={pY} r={pR} color="#FFFFFF" opacity={0.96} />
              <Circle cx={rX} cy={pY} r={pR} color="#FFFFFF" opacity={0.96} />
            </>}
        <Path path={lashes} style="stroke" strokeWidth={0.9} strokeCap="round" color={colA} opacity={lashOp} />
        <Circle cx={cx} cy={cy + base * 1.34} r={base * (0.75 + 0.3)} style="stroke" strokeWidth={0.65} color={colA} opacity={0.2} />
      </Canvas>
    </View>
  );
}
