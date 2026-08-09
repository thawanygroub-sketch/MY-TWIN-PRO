import React, { useEffect } from 'react';
import { Dimensions } from 'react-native';
import { Canvas, Path, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withTiming, withSequence, useFrameCallback } from 'react-native-reanimated';
import { useAppTheme } from '../../engine/colors';
const W = Dimensions.get('window').width;
const noise = (x: number, y: number, s: number) => { 'worklet'; const n = Math.sin(x * 12.9898 + y * 78.233 + s * 43758.5453) * 43758.5453; return n - Math.floor(n); };
const fbm = (x: number, y: number, s: number) => { 'worklet'; let v = 0, a = 0.5, f = 1; for (let i = 0; i < 2; i++) { v += a * noise(x * f, y * f, s + i); a *= 0.5; f *= 2; } return v; };
// أنبوب عضوي بتموجات غير منضبطة: تتمدد وتنكمش بلا نمط ثابت
const genTube = (t: number, R: number, seed: number, form: number, cx: number, cy: number) => {
  'worklet';
  if (form <= 0.01 || R <= 0) return '';
  const pts = 40; const xs: number[] = []; const ys: number[] = [];
  const swell = 1 + 0.1 * Math.sin(t * 0.5 + seed) + 0.07 * Math.sin(t * 0.23 + seed * 2) + 0.05 * Math.sin(t * 1.7 + seed * 3);
  for (let i = 0; i < pts; i++) {
    const ang = (i / pts) * Math.PI * 2;
    const org = Math.sin(ang * 3 + t * 0.9 + seed) * 0.34 + Math.cos(ang * 5 - t * 0.7 + seed) * 0.26 + Math.sin(ang * 8 + t * 1.3) * 0.16 + (fbm(Math.cos(ang) * 2.2, t * 0.22, seed) - 0.5) * 0.55;
    const r = Math.max(2, R * form * swell * (1 + org));
    xs.push(cx + Math.cos(ang) * r); ys.push(cy + Math.sin(ang) * r);
  }
  let d = 'M ' + (xs[0] + xs[1]) / 2 + ' ' + (ys[0] + ys[1]) / 2;
  for (let i = 1; i <= pts; i++) { const a = i % pts, b = (i + 1) % pts; d += ' Q ' + xs[a] + ' ' + ys[a] + ' ' + (xs[a] + xs[b]) / 2 + ' ' + (ys[a] + ys[b]) / 2; }
  return d + ' Z';
};
const genDots = (t: number, R: number, boost: number, cx: number, cy: number) => {
  'worklet';
  let d = '';
  for (let i = 0; i < 14; i++) {
    const seed = i * 37.7;
    const ang = seed + t * (0.12 + (i % 4) * 0.03) * (1 + boost);
    const rr = R * (0.18 + (((seed * 7.3) % 100) / 100) * 0.4);
    d += 'M ' + (cx + Math.cos(ang) * rr + Math.sin(t * 0.8 + i) * 3) + ' ' + (cy + Math.sin(ang) * rr * 0.9 + Math.cos(t * 0.6 + i * 2) * 3) + ' l 0.8 0.8 ';
  }
  return d;
};
export type EntityEmotion = 'neutral' | 'love' | 'joy' | 'concern' | 'surprise' | 'thinking';
export const LivingEntity = ({ radius = 70, height, formed = true, eyesOpen = true, emotion = 'neutral' }: { radius?: number; height?: number; formed?: boolean; eyesOpen?: boolean; emotion?: EntityEmotion }) => {
  const H = height ?? radius * 3.2; const CX = W / 2, CY = H / 2; const eyeY = CY - 4;
  const elX = CX - 18, erX = CX + 18;
  const { isDark } = useAppTheme();
  const P = isDark
    ? { tube1: '#C4B5FD', tube2: '#7C3AED', dot: '#E9D5FF', iris1: '#DDD6FE', iris2: '#6D28D9', pupil: '#140A2E', spec: '#FFFFFF', lid: '#05010A', lidLine: '#C4B5FD', eye: '#E9D5FF' }
    : { tube1: '#7C3AED', tube2: '#4F46E5', dot: '#6D28D9', iris1: '#A78BFA', iris2: '#4C1D95', pupil: '#1E1B2E', spec: '#FFFFFF', lid: '#FAF9FF', lidLine: '#6D28D9', eye: '#4C1D95' };
  const time = useSharedValue(0);
  const form = useSharedValue(0);
  const lidL = useSharedValue(1); const lidR = useSharedValue(1);
  const lidBaseL = useSharedValue(0); const lidBaseR = useSharedValue(0);
  const iris = useSharedValue(1);
  const gazeX = useSharedValue(0); const gazeY = useSharedValue(0);
  const boost = useSharedValue(0);
  useFrameCallback((fi) => { time.value = fi.timeSinceFirstFrame; });
  useEffect(() => { form.value = withTiming(formed ? 1 : 0, { duration: 1200 }); }, [formed]);
  useEffect(() => {
    if (eyesOpen) { lidL.value = withTiming(lidBaseL.value, { duration: 700 }); lidR.value = withTiming(lidBaseR.value, { duration: 700 }); }
    else { lidL.value = withTiming(1, { duration: 400 }); lidR.value = withTiming(1, { duration: 400 }); }
  }, [eyesOpen]);
  useEffect(() => {
    let bl = 0, br = 0, ir = 1, bo = 1, gy = 0;
    if (emotion === 'love' || emotion === 'joy') { bl = 0.45; br = 0.45; ir = 1.25; bo = 1.6; }
    else if (emotion === 'surprise') { bl = 0; br = 0; ir = 1.35; bo = 0.2; }
    else if (emotion === 'concern') { bl = 0.3; br = 0.3; ir = 0.9; bo = 0.4; gy = 3; }
    else if (emotion === 'thinking') { bl = 0.5; br = 0; ir = 1; bo = 0.8; gy = -2; }
    lidBaseL.value = bl; lidBaseR.value = br;
    lidL.value = withTiming(bl, { duration: 350 }); lidR.value = withTiming(br, { duration: 350 });
    iris.value = withTiming(ir, { duration: 400 });
    boost.value = withTiming(bo, { duration: 500 });
    gazeY.value = withTiming(gy, { duration: 500 });
  }, [emotion]);
  useEffect(() => {
    const blink = setInterval(() => {
      lidL.value = withSequence(withTiming(1, { duration: 90 }), withTiming(lidBaseL.value, { duration: 140 }));
      lidR.value = withSequence(withTiming(1, { duration: 90 }), withTiming(lidBaseR.value, { duration: 140 }));
    }, 3400);
    const gaze = setInterval(() => { gazeX.value = withTiming((Math.random() - 0.5) * 8, { duration: 800 }); }, 1900);
    return () => { clearInterval(blink); clearInterval(gaze); };
  }, []);
  const tubeA = useDerivedValue(() => genTube(time.value * 0.001, radius, 7, form.value, CX, CY));
  const tubeB = useDerivedValue(() => genTube(time.value * 0.0011 + 2.6, radius * 0.94, 29, form.value, CX, CY));
  const dots = useDerivedValue(() => genDots(time.value * 0.001, radius, boost.value, CX, CY));
  const tubeW = useDerivedValue(() => 10 + Math.sin(time.value * 0.0016) * 2.5);
  const opTube1 = useDerivedValue(() => 0.9 * form.value);
  const opTube2 = useDerivedValue(() => 0.6 * form.value);
  const opDots = useDerivedValue(() => 0.5 * form.value);
  const opEye = useDerivedValue(() => form.value);
  const opSoft = useDerivedValue(() => 0.85 * form.value);
  const irisRL = useDerivedValue(() => 5.5 * iris.value * (1 - lidL.value * 0.15));
  const irisRR = useDerivedValue(() => 5.5 * iris.value * (1 - lidR.value * 0.15));
  const gazeLX = useDerivedValue(() => elX + gazeX.value);
  const gazeRX = useDerivedValue(() => erX + gazeX.value * 0.8);
  const gazeYv = useDerivedValue(() => eyeY + gazeY.value);
  const lidPathL = useDerivedValue(() => { const h = 20 * lidL.value; return 'M ' + (elX - 15) + ' ' + (eyeY - 11) + ' L ' + (elX + 15) + ' ' + (eyeY - 11) + ' L ' + (elX + 15) + ' ' + (eyeY - 11 + h) + ' Q ' + elX + ' ' + (eyeY - 11 + h + 4) + ' ' + (elX - 15) + ' ' + (eyeY - 11 + h) + ' Z'; });
  const lidPathR = useDerivedValue(() => { const h = 20 * lidR.value; return 'M ' + (erX - 15) + ' ' + (eyeY - 11) + ' L ' + (erX + 15) + ' ' + (eyeY - 11) + ' L ' + (erX + 15) + ' ' + (eyeY - 11 + h) + ' Q ' + erX + ' ' + (eyeY - 11 + h + 4) + ' ' + (erX - 15) + ' ' + (eyeY - 11 + h) + ' Z'; });
  const lidLineL = useDerivedValue(() => { const h = 20 * lidL.value; return 'M ' + (elX - 15) + ' ' + (eyeY - 9 + h) + ' Q ' + elX + ' ' + (eyeY - 5 + h) + ' ' + (elX + 15) + ' ' + (eyeY - 9 + h); });
  const lidLineR = useDerivedValue(() => { const h = 20 * lidR.value; return 'M ' + (erX - 15) + ' ' + (eyeY - 9 + h) + ' Q ' + erX + ' ' + (eyeY - 5 + h) + ' ' + (erX + 15) + ' ' + (eyeY - 9 + h); });
  const almondL = 'M ' + (elX - 13) + ' ' + eyeY + ' Q ' + elX + ' ' + (eyeY - 9) + ' ' + (elX + 13) + ' ' + eyeY + ' Q ' + elX + ' ' + (eyeY + 9) + ' ' + (elX - 13) + ' ' + eyeY + ' Z';
  const almondR = 'M ' + (erX - 13) + ' ' + eyeY + ' Q ' + erX + ' ' + (eyeY - 9) + ' ' + (erX + 13) + ' ' + eyeY + ' Q ' + erX + ' ' + (eyeY + 9) + ' ' + (erX - 13) + ' ' + eyeY + ' Z';
  return (
    <Canvas style={{ width: W, height: H }}>
      <Path path={tubeA} style="stroke" strokeWidth={tubeW} strokeCap="round" strokeJoin="round" color={P.tube1} opacity={opTube1} />
      <Path path={tubeB} style="stroke" strokeWidth={tubeW} strokeCap="round" strokeJoin="round" color={P.tube2} opacity={opTube2} />
      <Path path={dots} style="stroke" strokeWidth={2} strokeCap="round" color={P.dot} opacity={opDots} />
      <Circle cx={gazeLX} cy={gazeYv} r={irisRL} opacity={opEye}><RadialGradient c={vec(elX, eyeY)} r={8} colors={[P.iris1, P.iris2]} /></Circle>
      <Circle cx={gazeRX} cy={gazeYv} r={irisRR} opacity={opEye}><RadialGradient c={vec(erX, eyeY)} r={8} colors={[P.iris1, P.iris2]} /></Circle>
      <Circle cx={gazeLX} cy={gazeYv} r={2.4} color={P.pupil} opacity={opEye} />
      <Circle cx={gazeRX} cy={gazeYv} r={2.4} color={P.pupil} opacity={opEye} />
      <Circle cx={gazeLX} cy={gazeYv} r={1.2} color={P.spec} opacity={opSoft} />
      <Circle cx={gazeRX} cy={gazeYv} r={1.2} color={P.spec} opacity={opSoft} />
      <Path path={almondL} style="stroke" strokeWidth={1.5} color={P.eye} opacity={opSoft} />
      <Path path={almondR} style="stroke" strokeWidth={1.5} color={P.eye} opacity={opSoft} />
      <Path path={lidPathL} color={P.lid} opacity={opEye} />
      <Path path={lidPathR} color={P.lid} opacity={opEye} />
      <Path path={lidLineL} style="stroke" strokeWidth={1.2} color={P.lidLine} opacity={opSoft} />
      <Path path={lidLineR} style="stroke" strokeWidth={1.2} color={P.lidLine} opacity={opSoft} />
    </Canvas>
  );
};
export default LivingEntity;
