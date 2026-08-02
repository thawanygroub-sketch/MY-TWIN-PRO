import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group, BlurMask, Path } from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ENTITY_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.8;
const CX = ENTITY_SIZE / 2;
const CY = ENTITY_SIZE / 2;

type EmotionalState = 
  | 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised'
  | 'thinking' | 'love' | 'reject' | 'excited';

interface DigitalBeingProps {
  size?: number;
  emotionalState?: EmotionalState;
  auraIntensity?: number;
  waveCount?: number;
}

export const DigitalBeing: React.FC<DigitalBeingProps> = ({
  size = ENTITY_SIZE,
  emotionalState = 'neutral',
  auraIntensity = 7,
  waveCount = 6,
}) => {
  const pulse = useSharedValue(1);
  const waveProgress = useSharedValue(0);
  const eyeBlink = useSharedValue(1);
  const pupilX = useSharedValue(0);
  const pupilY = useSharedValue(0);

  const auraColors: Record<EmotionalState, string[]> = {
    neutral: ['#8B5CF6', '#A855F7', '#C084FC'],
    happy: ['#FCD34D', '#F59E0B', '#FBBF24'],
    sad: ['#3B82F6', '#60A5FA', '#93C5FD'],
    angry: ['#EF4444', '#DC2626', '#F87171'],
    surprised: ['#A78BFA', '#8B5CF6', '#C4B5FD'],
    thinking: ['#06B6D4', '#0891B2', '#22D3EE'],
    love: ['#EC4899', '#DB2777', '#F472B6'],
    reject: ['#64748B', '#475569', '#94A3B8'],
    excited: ['#10B981', '#059669', '#34D399'],
  };

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1 + (auraIntensity * 0.05), { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1, true
    );
  }, [auraIntensity]);

  useEffect(() => {
    const animateWave = () => {
      waveProgress.value = 0;
      waveProgress.value = withTiming(1, { duration: 3000, easing: Easing.out(Easing.ease) });
    };
    animateWave();
    const interval = setInterval(animateWave, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const blinkInterval = setInterval(() => {
      eyeBlink.value = withSequence(
        withTiming(0.1, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
    }, 4000);
    return () => clearInterval(blinkInterval);
  }, []);

  useEffect(() => {
    const moveInterval = setInterval(() => {
      pupilX.value = withTiming((Math.random() - 0.5) * 15, { duration: 1500, easing: Easing.out(Easing.ease) });
      pupilY.value = withTiming((Math.random() - 0.5) * 10, { duration: 1500, easing: Easing.out(Easing.ease) });
    }, 2000);
    return () => clearInterval(moveInterval);
  }, []);

  const auraSize = useDerivedValue(() => size * 0.65 * pulse.value);
  const wave1Radius = useDerivedValue(() => size * 0.4 + (size * 0.35 * waveProgress.value));
  const wave1Opacity = useDerivedValue(() => 0.5 * (1 - waveProgress.value));
  const wave2Radius = useDerivedValue(() => size * 0.4 + (size * 0.35 * Math.max(0, waveProgress.value - 0.33)));
  const wave2Opacity = useDerivedValue(() => 0.4 * Math.max(0, 1 - (waveProgress.value - 0.33) * 1.5));
  const wave3Radius = useDerivedValue(() => size * 0.4 + (size * 0.35 * Math.max(0, waveProgress.value - 0.66)));
  const wave3Opacity = useDerivedValue(() => 0.3 * Math.max(0, 1 - (waveProgress.value - 0.66) * 3));
  const eyeScale = useDerivedValue(() => eyeBlink.value);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Canvas style={{ width: size, height: size }}>
        {/* الهالة الخارجية السميكة */}
        <Group>
          <Circle cx={CX} cy={CY} r={auraSize} color={auraColors[emotionalState][0]} opacity={0.25}>
            <BlurMask blur={30} style="solid" />
          </Circle>
          <Circle cx={CX} cy={CY} r={auraSize * 0.85} color={auraColors[emotionalState][1]} opacity={0.4}>
            <BlurMask blur={20} style="solid" />
          </Circle>
          <Circle cx={CX} cy={CY} r={auraSize * 0.7} color={auraColors[emotionalState][2]} opacity={0.6}>
            <BlurMask blur={15} style="solid" />
          </Circle>
        </Group>

        {/* الموجات */}
        <Circle cx={CX} cy={CY} r={wave1Radius} color={auraColors[emotionalState][0]} opacity={wave1Opacity} style="stroke" strokeWidth={8} />
        <Circle cx={CX} cy={CY} r={wave2Radius} color={auraColors[emotionalState][1]} opacity={wave2Opacity} style="stroke" strokeWidth={6} />
        <Circle cx={CX} cy={CY} r={wave3Radius} color={auraColors[emotionalState][2]} opacity={wave3Opacity} style="stroke" strokeWidth={4} />

        {/* النواة المركزية */}
        <Circle cx={CX} cy={CY} r={size * 0.18} color="#1a1a2e" />

        {/* العين اليسرى */}
        <Group transform={[{ scale: eyeScale }]}>
          <Circle cx={size * 0.38} cy={size * 0.48} r={size * 0.08} color="#ffffff" />
          <Circle cx={size * 0.38 + pupilX.value} cy={size * 0.48 + pupilY.value} r={size * 0.04} color="#000000" />
        </Group>

        {/* العين اليمنى */}
        <Group transform={[{ scale: eyeScale }]}>
          <Circle cx={size * 0.62} cy={size * 0.48} r={size * 0.08} color="#ffffff" />
          <Circle cx={size * 0.62 + pupilX.value} cy={size * 0.48 + pupilY.value} r={size * 0.04} color="#000000" />
        </Group>

        {/* X للرفض */}
        {emotionalState === 'reject' && (
          <>
            <Path path={`M ${size * 0.3} ${size * 0.42} L ${size * 0.42} ${size * 0.54}`} color="#EF4444" style="stroke" strokeWidth={4} />
            <Path path={`M ${size * 0.42} ${size * 0.42} L ${size * 0.3} ${size * 0.54}`} color="#EF4444" style="stroke" strokeWidth={4} />
            <Path path={`M ${size * 0.58} ${size * 0.42} L ${size * 0.7} ${size * 0.54}`} color="#EF4444" style="stroke" strokeWidth={4} />
            <Path path={`M ${size * 0.7} ${size * 0.42} L ${size * 0.58} ${size * 0.54}`} color="#EF4444" style="stroke" strokeWidth={4} />
          </>
        )}
      </Canvas>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
