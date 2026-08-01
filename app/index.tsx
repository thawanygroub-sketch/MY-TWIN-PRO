import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Canvas, Circle, Path, Group, Paint, BlurMask, vec } from "@shopify/react-native-skia";
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const CX = width / 2;
const CY = height / 2;

// ─────────────────────────────────────────────────────────────
// 1. توليد مسار الغشاء الحي (متأثر بالضوضاء ومرونة العضوية)
// ─────────────────────────────────────────────────────────────
const generateMembranePath = (phase: number, baseRadius: number, points: number, irregularity: number, noise: number) => {
  'worklet';
  if (baseRadius <= 0) return '';
  let d = '';
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    // استخدام Math.random في worklet غير ممكن، سنعتمد على phase و noise متغيرة.
    const jitter = Math.sin(angle * 5 + phase) * (irregularity + noise) + Math.cos(angle * 7 + phase * 0.7) * (irregularity * 0.8);
    const r = Math.max(1, baseRadius + jitter);
    const x = CX + Math.cos(angle) * r;
    const y = CY + Math.sin(angle) * r;
    if (i === 0) d += `M ${x} ${y}`;
    else d += ` L ${x} ${y}`;
  }
  d += ' Z';
  return d;
};

// ─────────────────────────────────────────────────────────────
// 2. توليد مسار العين اللوزية
// ─────────────────────────────────────────────────────────────
const generateEyePath = (centerX: number, centerY: number, eyeWidth: number, eyeHeight: number, gazeX: number, gazeY: number) => {
  'worklet';
  const left = centerX - eyeWidth / 2 + gazeX;
  const right = centerX + eyeWidth / 2 + gazeX;
  const top = centerY - eyeHeight / 2 + gazeY;
  const bottom = centerY + eyeHeight / 2 + gazeY;
  return `M ${centerX} ${top} C ${right + eyeWidth * 0.3} ${top + eyeHeight * 0.2}, ${right + eyeWidth * 0.3} ${bottom - eyeHeight * 0.2}, ${centerX} ${bottom} C ${left - eyeWidth * 0.3} ${bottom - eyeHeight * 0.2}, ${left - eyeWidth * 0.3} ${top + eyeHeight * 0.2}, ${centerX} ${top} Z`;
};

export default function Index() {
  // حالة React فقط للتحكم بالمراحل والظهور
  const [phase, setPhase] = useState('void');
  const [showSoulSync, setShowSoulSync] = useState(false);

  // ─── قيم Reanimated الحية (لا تسبب إعادة render) ───
  const sparkOpacity = useSharedValue(0);
  const sparkScale = useSharedValue(0.1);
  const nucleusOpacity = useSharedValue(0);
  const nucleusScale = useSharedValue(0.3);
  const membranePhase = useSharedValue(0);
  const baseRadius = useSharedValue(0);
  const eyeOpacity = useSharedValue(0);
  const eyeGazeX = useSharedValue(0);
  const eyeGazeY = useSharedValue(0);
  const noiseLevel = useSharedValue(2);
  const enterScale = useSharedValue(1);
  const enterOpacity = useSharedValue(1);
  const soulSyncOpacity = useSharedValue(0);

  // ─── مسارات Skia المشتقة (تحسب مباشرة على GPU) ───
  const membranePath = useDerivedValue(() => {
    return generateMembranePath(membranePhase.value, baseRadius.value, 40, baseRadius.value * 0.3, noiseLevel.value);
  });

  const eyePath = useDerivedValue(() => {
    return generateEyePath(CX, CY - 5, 24, 12, eyeGazeX.value, eyeGazeY.value);
  });

  // ─── جزيئات الفراغ الحي (ثابتة التوليد، متغيرة الحركة بالوقت) ───
  const particles = Array.from({ length: 30 }, (_, i) => ({
    angle: (i / 30) * Math.PI * 2,
    dist: 120 + Math.sin(i * 1.5) * 40,
    speed: 0.1 + Math.random() * 0.4,
    size: 0.5 + Math.random() * 1.5,
  }));

  useEffect(() => {
    const startBirth = async () => {
      // ── تهيئة الصوت بصمت ──
      try {
        const { audioEngine } = require('../src/core/AudioEngine');
        audioEngine.init();
      } catch (e) {}

      // 1. الفراغ (ثانيتين)
      await new Promise(r => setTimeout(r, 2000));

      // 2. شرارة الوعي
      runOnJS(setPhase)('spark');
      sparkOpacity.value = withTiming(0.9, { duration: 800, easing: Easing.out(Easing.ease) });
      sparkScale.value = withTiming(1.2, { duration: 800, easing: Easing.out(Easing.back(1.5)) }, () => {
        // الانتقال إلى مرحلة التنفس
        runOnJS(setPhase)('breath');
        sparkOpacity.value = withTiming(0, { duration: 400 });
        nucleusOpacity.value = withTiming(0.6, { duration: 600 });
        nucleusScale.value = withTiming(0.8, { duration: 600 });
        baseRadius.value = withTiming(15, { duration: 600 });
        // بدء تموج الغشاء المستمر
        membranePhase.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 4000 }),
            withTiming(0, { duration: 4000 }),
          ),
          -1,
          true
        );
      });
      try { require('../src/core/AudioEngine').audioEngine.play('first_breath'); } catch (e) {}
      await new Promise(r => setTimeout(r, 3500)); // وقت كافٍ للنفس الأول

      // 3. النبض (يولد الضوء)
      runOnJS(setPhase)('heartbeat');
      try { require('../src/core/AudioEngine').audioEngine.play('heartbeat_energy'); } catch (e) {}
      nucleusOpacity.value = withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(0.6, { duration: 300 }),
        withTiming(1, { duration: 200 }),
        withTiming(0.6, { duration: 300 }),
        withTiming(1, { duration: 200 }),
        withTiming(0.8, { duration: 300 }),
      );
      await new Promise(r => setTimeout(r, 2000));

      // 4. الوعي (حركة بحثية)
      runOnJS(setPhase)('awareness');
      eyeOpacity.value = withTiming(0.8, { duration: 1000 });
      nucleusScale.value = withTiming(1.5, { duration: 1500 });
      nucleusOpacity.value = withTiming(0.8, { duration: 800 });
      // حركة عشوائية للعين
      const gazeRandomizer = setInterval(() => {
        eyeGazeX.value = withTiming((Math.random() - 0.5) * 6, { duration: 600 });
        eyeGazeY.value = withTiming((Math.random() - 0.5) * 3, { duration: 800 });
      }, 1200);
      await new Promise(r => setTimeout(r, 4000));
      clearInterval(gazeRandomizer);

      // 5. الاتصال البصري (نظرة مباشرة)
      runOnJS(setPhase)('eye');
      eyeGazeX.value = withTiming(0, { duration: 400 });
      eyeGazeY.value = withTiming(-1, { duration: 400 });
      try { require('../src/core/AudioEngine').audioEngine.play('eyes_open'); } catch (e) {}
      await new Promise(r => setTimeout(r, 2000));

      // 6. الحضور والاستقرار
      runOnJS(setPhase)('presence');
      nucleusScale.value = withTiming(1.2, { duration: 800 });
      noiseLevel.value = withTiming(1, { duration: 800 });
      runOnJS(setShowSoulSync)(true);
      soulSyncOpacity.value = withTiming(0.4, { duration: 1000 });
      try { require('../src/core/AudioEngine').audioEngine.play('awakening_glow'); } catch (e) {}
      await new Promise(r => setTimeout(r, 3000));

      // 7. الدخول إلى الكيان
      runOnJS(setPhase)('enter');
      enterScale.value = withTiming(30, { duration: 800, easing: Easing.in(Easing.ease) });
      enterOpacity.value = withTiming(0, { duration: 600 });
      try { require('../src/core/AudioEngine').audioEngine.play('workspace_enter'); } catch (e) {}
      setTimeout(() => {
        runOnJS(router.replace)('/genesis');
      }, 800);
    };

    startBirth();
  }, []);

  return (
    <View style={[styles.container, { 
      opacity: enterOpacity.value, 
      transform: [{ scale: enterScale.value }] 
    }]}>
      <View style={styles.void}>
        <Canvas style={{ width, height }}>
          {/* ── الفراغ الحي (جزيئات كونية خافتة) ── */}
          <Group>
            {particles.map((p, i) => {
              const angle = p.angle + (Date.now() / 10000) * p.speed;
              const x = CX + Math.cos(angle) * p.dist;
              const y = CY + Math.sin(angle) * p.dist;
              const opacity = 0.08 + (Math.sin(Date.now() / 3000 + i) + 1) * 0.04;
              return (
                <Circle key={i} cx={x} cy={y} r={p.size} color="#FFFFFF" opacity={opacity}>
                  <Paint><BlurMask blur={1} style="solid" /></Paint>
                </Circle>
              );
            })}
          </Group>

          {/* ── شرارة الوعي ── */}
          {phase === 'spark' && (
            <Circle cx={CX} cy={CY} r={8} color="#FFFFFF" opacity={sparkOpacity}>
              <Paint><BlurMask blur={15} style="normal" /></Paint>
            </Circle>
          )}

          {/* ── الغشاء الحي (النواة) ── */}
          {(phase !== 'void' && phase !== 'spark') && (
            <>
              <Path path={membranePath} color="#B8A0D0" opacity={nucleusOpacity} style="fill">
                <Paint><BlurMask blur={10} style="normal" /></Paint>
              </Path>
              <Path path={membranePath} color="#B8A0D0" opacity={0.4} style="stroke" strokeWidth={1}>
                <Paint><BlurMask blur={4} style="solid" /></Paint>
              </Path>
              <Circle cx={CX} cy={CY} r={4} color="#FFFFFF" opacity={0.5}>
                <Paint><BlurMask blur={3} style="solid" /></Paint>
              </Circle>
            </>
          )}

          {/* ── العين (الوعي والاتصال) ── */}
          {(phase === 'awareness' || phase === 'eye' || phase === 'presence' || phase === 'enter') && (
            <>
              <Path path={eyePath} color="#B8A0D0" opacity={eyeOpacity} style="fill">
                <Paint><BlurMask blur={3} style="solid" /></Paint>
              </Path>
              <Circle cx={CX} cy={CY - 5} r={3} color="#FFFFFF" opacity={0.6}>
                <Paint><BlurMask blur={2} style="solid" /></Paint>
              </Circle>
            </>
          )}
        </Canvas>

        {/* ── اسم الشركة (ثانوي، يظهر متأخراً) ── */}
        {showSoulSync && (
          <Text style={[styles.soulSyncText, { opacity: soulSyncOpacity }]}>
            SOUL SYNC
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  void: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  soulSyncText: {
    position: 'absolute',
    bottom: 50,
    fontSize: 12,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: '#6B5B8A',
    fontWeight: '300',
  },
});
