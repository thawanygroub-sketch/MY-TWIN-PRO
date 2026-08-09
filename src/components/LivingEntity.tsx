import React, { useEffect } from 'react';
import { Dimensions } from 'react-native';
import { Canvas, Circle, Group, RadialGradient, vec, Path } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withTiming, withSequence, useFrameCallback } from 'react-native-reanimated';
import { useAppTheme } from '../../engine/colors';
const W = Dimensions.get('window').width;
const noise = (x: number, y: number, s: number) => { 'worklet'; const n = Math.sin(x * 12.9898 + y * 78.233 + s * 43758.5453) * 43758.5453; return n - Math.floor(n); };
const genSparks = (t: number, R: number, boost: number, cx: number, cy: number) => {
  'worklet';
  let d = '';
  for (let i = 0; i < 10; i++) {
    const seed = i * 41.3;
    const ang = seed + t * 0.00012 * (1 + (i % 3) * 0.4) * (1 + boost);
    const rr = R * (0.2 + (((seed * 7.3) % 100) / 100) * 0.5);
    d += 'M ' + (cx + Math.cos(ang) * rr) + ' ' + (cy + Math.sin(ang) * rr * 0.9 + Math.sin(t * 0.0004 + i) * 2) + ' l 0.7 0.7 ';
  }
  return d;
};
export type EntityEmotion = 'neutral' | 'love' | 'joy' | 'concern' | 'surprise' | 'thinking';
export const LivingEntity = ({ radius = 70, height, formed = true, eyesOpen = true, emotion = 'neutral' }: { radius?: number; height?: number; formed?: boolean; eyesOpen?: boolean; emotion?: EntityEmotion }) => {
  const H = height ?? radius * 3; const CX = W / 2; const CY = H / 2; const eyeY = CY - radius * 0.08;
  const { isDark } = useAppTheme();
  const C = isDark
    ? { core1: '#F5F3FF', core2: '#A78BFA', core3: '#6D28D9', fade: '#6D28D900', halo: '#8B5CF6', spark: '#E9D5FF', iris1: '#C4B5FD', iris2: '#5B21B6', pupil: '#140A2E', spec: '#FFFFFF' }
    : { core1: '#FFFFFF', core2: '#C4B5FD', core3: '#7C3AED', fade: '#7C3AED00', halo: '#7C3AED', spark: '#6D28D9', iris1: '#A78BFA', iris2: '#4C1D95', pupil: '#1E1B2E', spec: '#FFFFFF' };
  const time = useSharedValue(0);
  const form = useSharedValue(0);
  const lidL = useSharedValue(1); const lidR = useSharedValue(1);
  const baseL = useSharedValue(0); const baseR = useSharedValue(0);
  const irisS = useSharedValue(1);
  const gazeX = useSharedValue(0); const gazeY = useSharedValue(0);
  const boost = useSharedValue(0);
  useFrameCallback((fi) => { time.value = fi.timeSinceFirstFrame; });
  useEffect(() => { form.value = withTiming(formed ? 1 : 0, { duration: 1400 }); }, [formed]);
  useEffect(() => {
    if (eyesOpen) { lidL.value = withTiming(baseL.value, { duration: 800 }); lidR.value = withTiming(baseR.value, { duration: 800 }); }
    else { lidL.value = withTiming(1, { duration: 400 }); lidR.value = withTiming(1, { duration: 400 }); }
  }, [eyesOpen]);
  useEffect(() => {
    let bl = 0, br = 0, ir = 1, bo = 0.6, gy = 0;
    if (emotion === 'love' || emotion === 'joy') { bl = 0.55; br = 0.55; ir = 1.2; bo = 1.4; }
    else if (emotion === 'surprise') { bl = 0; br = 0; ir = 1.35; bo = 0.2; }
    else if (emotion === 'concern') { bl = 0.7; br = 0.7; ir = 0.9; bo = 0.3; gy = 3; }
    else if (emotion === 'thinking') { bl = 0.6; br = 0; ir = 1; bo = 0.8; gy = -2; }
    baseL.value = bl; baseR.value = br;
    lidL.value = withTiming(bl, { duration: 400 }); lidR.value = withTiming(br, { duration: 400 });
    irisS.value = withTiming(ir, { duration: 500 });
    boost.value = withTiming(bo, { duration: 700 });
    gazeY.value = withTiming(gy, { duration: 600 });
  }, [emotion]);
  useEffect(() => {
    const blink = setInterval(() => {
      lidL.value = withSequence(withTiming(1, { duration: 110 }), withTiming(baseL.value, { duration: 160 }));
      lidR.value = withSequence(withTiming(1, { duration: 110 }), withTiming(baseR.value, { duration: 160 }));
    }, 4200);
    const gaze = setInterval(() => { gazeX.value = withTiming((Math.random() - 0.5) * 6, { duration: 1200 }); }, 2600);
    return () => { clearInterval(blink); clearInterval(gaze); };
  }, []);
  const R = useDerivedValue(() => radius * form.value * (1 + 0.05 * Math.sin(time.value * 0.0006)));
  const h1 = useDerivedValue(() => R.value * 1.28 + Math.sin(time.value * 0.0004) * 6);
  const h2 = useDerivedValue(() => R.value * 1.52 + Math.sin(time.value * 0.0004 + 2) * 8);
  const h3 = useDerivedValue(() => R.value * 1.78 + Math.sin(time.value * 0.0004 + 4) * 10);
  const o1 = useDerivedValue(() => 0.35 * form.value);
  const o2 = useDerivedValue(() => 0.2 * form.value);
  const o3 = useDerivedValue(() => 0.1 * form.value);
  const sparks = useDerivedValue(() => genSparks(time.value, radius * 0.9, boost.value, CX, CY));
  const gLX = useDerivedValue(() => gazeX.value);
  const gRX = useDerivedValue(() => gazeX.value * 0.8);
  const gY = useDerivedValue(() => gazeY.value);
  const irL = useDerivedValue(() => 6 * irisS.value);
  const irR = useDerivedValue(() => 6 * irisS.value);
  const opF = useDerivedValue(() => form.value);
  return (
    <Canvas style={{ width: W, height: H }}>
      <Circle cx={CX} cy={CY} r={h3} style="stroke" strokeWidth={0.8} color={C.halo} opacity={o3} />
      <Circle cx={CX} cy={CY} r={h2} style="stroke" strokeWidth={1} color={C.halo} opacity={o2} />
      <Circle cx={CX} cy={CY} r={h1} style="stroke" strokeWidth={1.2} color={C.halo} opacity={o1} />
      <Circle cx={CX} cy={CY} r={R} opacity={opF}>
        <RadialGradient c={vec(CX, CY)} r={R} colors={[C.core1, C.core2, C.core3, C.fade]} />
      </Circle>
      <Path path={sparks} style="stroke" strokeWidth={1.6} strokeCap="round" color={C.spark} opacity={o1} />
      <Group transform={[{ translateX: CX - 16 + gLX }, { translateY: eyeY + gY }, { scaleY: lidL }]}>
        <Circle cx={0} cy={0} r={9} opacity={0.5}><RadialGradient c={vec(0, 0)} r={9} colors={[C.iris1, '#00000000']} /></Circle>
        <Circle cx={0} cy={0} r={irL}><RadialGradient c={vec(0, 0)} r={6} colors={[C.iris1, C.iris2]} /></Circle>
        <Circle cx={0} cy={0} r={2.6} color={C.pupil} />
        <Circle cx={-1.6} cy={-1.6} r={1.2} color={C.spec} />
      </Group>
      <Group transform={[{ translateX: CX + 16 + gRX }, { translateY: eyeY + gY }, { scaleY: lidR }]}>
        <Circle cx={0} cy={0} r={9} opacity={0.5}><RadialGradient c={vec(0, 0)} r={9} colors={[C.iris1, '#00000000']} /></Circle>
        <Circle cx={0} cy={0} r={irR}><RadialGradient c={vec(0, 0)} r={6} colors={[C.iris1, C.iris2]} /></Circle>
        <Circle cx={0} cy={0} r={2.6} color={C.pupil} />
        <Circle cx={-1.6} cy={-1.6} r={1.2} color={C.spec} />
      </Group>
    </Canvas>
  );
};
export default LivingEntity;
