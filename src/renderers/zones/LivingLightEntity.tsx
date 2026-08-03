import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Dimensions, Pressable } from 'react-native';
import {
  Canvas, Circle, Path, Group, Paint, BlurMask,
  RadialGradient, SweepGradient, vec
} from "@shopify/react-native-skia";
import {
  useSharedValue, withTiming, useDerivedValue,
  withSequence, withRepeat, Easing,
  useAnimatedStyle,
} from "react-native-reanimated";
import { stateBus } from '../../../src/core/StateBus';
import { audioMixer } from '../../../src/core/AudioMixer';
import { useAppTheme } from '../../../engine/colors';
import { devicePresenceEngine } from '../../../engine/device/DevicePresenceEngine';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ENTITY_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.9;
const CX = ENTITY_SIZE / 2;
const CY = ENTITY_SIZE / 2;

const generateMembranePath = (phase: number, scale: number, points: number, focusLevel: number, emotionIntensity: number) => {
  const radius = (ENTITY_SIZE * 0.22) * scale;
  let d = '';
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const distortion = Math.sin(angle * 4 + phase) * (12 + emotionIntensity * 8) + Math.cos(angle * 6 + phase * 0.7) * (8 + focusLevel * 6);
    const r = radius + distortion;
    const x = CX + Math.cos(angle) * r;
    const y = CY + Math.sin(angle) * r;
    if (i === 0) d += `M ${x} ${y}`;
    else d += ` L ${x} ${y}`;
  }
  d += ' Z';
  return d;
};

const generateEyePath = (centerX: number, centerY: number, eyeWidth: number, eyeHeight: number, gazeX: number, gazeY: number) => {
  const left = centerX - eyeWidth / 2 + gazeX;
  const right = centerX + eyeWidth / 2 + gazeX;
  const top = centerY - eyeHeight / 2 + gazeY;
  const bottom = centerY + eyeHeight / 2 + gazeY;
  return `M ${centerX} ${top} C ${right + eyeWidth * 0.3} ${top + eyeHeight * 0.2}, ${right + eyeWidth * 0.3} ${bottom - eyeHeight * 0.2}, ${centerX} ${bottom} C ${left - eyeWidth * 0.3} ${bottom - eyeHeight * 0.2}, ${left - eyeWidth * 0.3} ${top + eyeHeight * 0.2}, ${centerX} ${top} Z`;
};

export default function LivingLightEntity({ isThinking, isSpeaking, isListening, onLongPress, onPress }: any) {
  const { colors } = useAppTheme();

  const breathPhase = useSharedValue(0);
  const focusLevel = useSharedValue(0.5);
  const energyLevel = useSharedValue(0.5);
  const warmth = useSharedValue(0.5);
  const memoryEchoIntensity = useSharedValue(0);
  const intentIntensity = useSharedValue(0);
  const membranePhase = useSharedValue(0);
  const silenceLevel = useSharedValue(0);
  const audioLevel = useSharedValue(0);
  const eyeBlink = useSharedValue(0);
  const eyeGazeX = useSharedValue(0);
  const eyeGazeY = useSharedValue(0);
  const eyeScale = useSharedValue(1);
  const batteryLow = useSharedValue(0);
  const weatherCondition = useSharedValue(0);
  const surpriseActive = useSharedValue(0);
  const headTilt = useSharedValue(0);
  const emotionColor = useSharedValue(colors.accent);
  const isReady = useSharedValue(0);

  useEffect(() => {
    const unsub = stateBus.on('presence:state_updated', (_: string, data: any) => {
      if (!data) return;
      isReady.value = 1;
      breathPhase.value = data.breathPhase || 0;
      focusLevel.value = withTiming(data.focusLevel || 0.5, { duration: 300 });
      energyLevel.value = withTiming(data.energyLevel || 0.5, { duration: 300 });
      warmth.value = withTiming(data.warmth || 0.5, { duration: 500 });
      memoryEchoIntensity.value = withTiming(data.memoryEchoIntensity || 0, { duration: 300 });
      intentIntensity.value = withTiming(data.intentIntensity || 0, { duration: 300 });
      silenceLevel.value = withTiming(data.silenceLevel || 0, { duration: 1000 });

      const emotionColors: Record<string, string> = {
        joy: '#F59E0B', sadness: '#3B82F6', calm: '#10B981', love: '#EC4899',
        anger: '#EF4444', fear: '#A78BFA', neutral: colors.accent,
      };
      emotionColor.value = withTiming(emotionColors[data.emotion] || colors.accent, { duration: 2000 });

      if (data.memoryEchoIntensity > 0.5) {
        surpriseActive.value = withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0, { duration: 900 })
        );
      }
    });
    const sensorInterval = setInterval(() => {
      const s = devicePresenceEngine.getSensors();
      audioLevel.value = withTiming(s.audioLevel, { duration: 200 });
      batteryLow.value = s.isBatteryLow ? 1 : 0;
    }, 1000);
    return () => { unsub(); clearInterval(sensorInterval); };
  }, [colors]);

  const membranePath = useDerivedValue(() => {
    return generateMembranePath(membranePhase.value, 1.0, 60, focusLevel.value, Math.abs(warmth.value - 0.5) * 2);
  });

  const leftEyePath = useDerivedValue(() => {
    return generateEyePath(CX - 22, CY - 8, 18 + eyeScale.value * 3, Math.max(1, 10 + eyeScale.value * 2), eyeGazeX.value, eyeGazeY.value);
  });

  const rightEyePath = useDerivedValue(() => {
    return generateEyePath(CX + 22, CY - 8, 18 + eyeScale.value * 3, Math.max(1, 10 + eyeScale.value * 2), eyeGazeX.value, eyeGazeY.value);
  });

  

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.container}
    >
      <Canvas style={{ width: ENTITY_SIZE, height: ENTITY_SIZE }}>
        <Group>
          <Circle cx={CX} cy={CY} r={ENTITY_SIZE * 0.5} opacity={0.04 + energyLevel.value * 0.05}>
            <Paint><BlurMask blur={60} style="normal" /></Paint>
            <RadialGradient c={vec(CX, CY)} r={ENTITY_SIZE * 0.5} colors={[emotionColor.value + '25', 'transparent']} />
          </Circle>
          <Path path={membranePath} color={emotionColor.value} opacity={0.1 + focusLevel.value * 0.08} style="fill">
            <Paint><BlurMask blur={14} style="normal" /></Paint>
          </Path>
          <Path path={membranePath} color={emotionColor.value} opacity={0.2 + energyLevel.value * 0.15} style="stroke" strokeWidth={1.5}>
            <Paint><BlurMask blur={4} style="solid" /></Paint>
          </Path>
          {surpriseActive.value > 0 && (
            <Circle cx={CX} cy={CY} r={80} opacity={surpriseActive.value * 0.3}>
              <Paint><BlurMask blur={20} style="normal" /></Paint>
              <RadialGradient c={vec(CX, CY)} r={80} colors={['#FFD700', 'transparent']} />
            </Circle>
          )}
          <Path path={leftEyePath} color={emotionColor.value} opacity={0.9} style="fill" />
          <Path path={rightEyePath} color={emotionColor.value} opacity={0.9} style="fill" />
        </Group>
      </Canvas>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: ENTITY_SIZE,
    height: ENTITY_SIZE,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
