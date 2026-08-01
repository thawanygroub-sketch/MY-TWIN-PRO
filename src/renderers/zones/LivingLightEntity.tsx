import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Pressable } from 'react-native';
import {
  Canvas, Circle, Path, Group, Paint, BlurMask,
  RadialGradient, SweepGradient, vec
} from "@shopify/react-native-skia";
import { useSharedValue, withTiming, useDerivedValue, withSequence, withRepeat, Easing } from "react-native-reanimated";
import { stateBus } from '../../../src/core/StateBus';
import { audioMixer } from '../../../src/core/AudioMixer';
import { useAppTheme } from '../../../engine/colors';
import { devicePresenceEngine } from '../../../engine/device/DevicePresenceEngine';

interface LivingLightEntityProps {
  isThinking?: boolean;
  isSpeaking?: boolean;
  isListening?: boolean;
  onLongPress?: () => void;
  onPress?: () => void;
}

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

export default function LivingLightEntity({ isThinking, isSpeaking, isListening, onLongPress, onPress }: LivingLightEntityProps) {
  const { colors } = useAppTheme();
  const [emotionColor, setEmotionColor] = useState(colors.accent);
  const [isReady, setIsReady] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState('neutral');
  const [headTilt, setHeadTilt] = useState(0);
  const [touchPosition, setTouchPosition] = useState<{x: number, y: number} | null>(null);
  const [weather, setWeather] = useState<'clear'|'rain'|'storm'>('clear');
  const [batteryLow, setBatteryLow] = useState(false);
  const [surpriseActive, setSurpriseActive] = useState(false);

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

  useEffect(() => {
    const unsub = stateBus.on('presence:state_updated', (_: string, data: any) => {
      if (!data) return;
      if (!isReady) setIsReady(true);
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
      const newColor = emotionColors[data.emotion] || colors.accent;
      setEmotionColor(newColor);
      setCurrentEmotion(data.emotion || 'neutral');

      if (data.isThinking) setHeadTilt(-3);
      else if (data.microExpressions?.some((m: any) => m.type === 'core_tilt')) {
        setHeadTilt(2);
        setTimeout(() => setHeadTilt(0), 1500);
        audioMixer.playEffect('head_nod');
      } else setHeadTilt(0);

      membranePhase.value = withTiming(membranePhase.value + 0.5, { duration: 2000 });
      if (data.memoryEchoIntensity > 0.5) {
        audioMixer.playMemoryEcho();
        setSurpriseActive(true);
        setTimeout(() => setSurpriseActive(false), 1200);
      }
    });
    const sensorInterval = setInterval(() => {
      const s = devicePresenceEngine.getSensors();
      audioLevel.value = withTiming(s.audioLevel, { duration: 200 });
      const w = s.weatherCondition; if (w === 'clear' || w === 'rain' || w === 'storm') setWeather(w);
      setBatteryLow(s.isBatteryLow);
    }, 1000);
    return () => { unsub(); clearInterval(sensorInterval); };
  }, [colors]);

  // رمشات متغيرة حسب المشاعر
  useEffect(() => {
    const blinkDelay = currentEmotion === 'joy' ? 1500 : currentEmotion === 'sadness' ? 4000 : 2500;
    const blinkSpeed = currentEmotion === 'joy' ? 50 : currentEmotion === 'fear' ? 80 : 60;
    const timer = setInterval(() => {
      eyeBlink.value = withSequence(
        withTiming(1, { duration: blinkSpeed }),
        withTiming(0, { duration: blinkSpeed * 2 }),
      );
    }, blinkDelay + Math.random() * 2000);
    return () => clearInterval(timer);
  }, [currentEmotion]);

  // حجم الكيان يتأثر بالبطارية
  const batteryScale = batteryLow ? 0.85 : 1.0;
  const batteryOpacity = batteryLow ? 0.5 : 0.9;

  // جسيمات المطر (إذا كان الطقس ممطراً)
  const rainDrops = useRef(
    Array.from({ length: 30 }, (_, i) => ({
      x: Math.random() * ENTITY_SIZE,
      y: Math.random() * -ENTITY_SIZE,
      speed: 2 + Math.random() * 4,
      size: 1 + Math.random() * 2,
      opacity: 0.3 + Math.random() * 0.4,
    }))
  ).current;

  const membranePath = useDerivedValue(() => generateMembranePath(membranePhase.value, 1.0, 60, focusLevel.value, Math.abs(warmth.value - 0.5) * 2));
  const coreRadius = useDerivedValue(() => 14 + breathPhase.value * 10 + energyLevel.value * 4);
  const leftEyePath = useDerivedValue(() => generateEyePath(CX - 22, CY - 8, 18 + eyeScale.value * 3, Math.max(1, 10 + eyeScale.value * 2), eyeGazeX.value, eyeGazeY.value));
  const rightEyePath = useDerivedValue(() => generateEyePath(CX + 22, CY - 8, 18 + eyeScale.value * 3, Math.max(1, 10 + eyeScale.value * 2), eyeGazeX.value, eyeGazeY.value));

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}
      onTouchMove={(e) => {
        const touch = e.nativeEvent;
        if (touch) {
          const centerX = ENTITY_SIZE / 2;
          const centerY = ENTITY_SIZE / 2;
          const dx = (touch.pageX - centerX) / centerX * 8;
          const dy = (touch.pageY - centerY) / centerY * 5;
          setTouchPosition({ x: dx, y: dy });
        }
      }}
      onTouchEnd={() => setTouchPosition(null)} style={[styles.container, { transform: [{ rotate: `${headTilt}deg` }, { scale: batteryScale }] }]}>
      {isReady ? (<Canvas style={{ width: ENTITY_SIZE, height: ENTITY_SIZE }}>
        <Group opacity={batteryOpacity}>
          {/* طبقات الضوء الأساسية */}
          <Circle cx={CX} cy={CY} r={ENTITY_SIZE * 0.5} opacity={0.04 + energyLevel.value * 0.05}>
            <Paint><BlurMask blur={60} style="normal" /></Paint>
            <RadialGradient c={vec(CX, CY)} r={ENTITY_SIZE * 0.5} colors={[emotionColor + '25', 'transparent']} />
          </Circle>
          <Path path={membranePath} color={emotionColor} opacity={0.1 + focusLevel.value * 0.08} style="fill"><Paint><BlurMask blur={14} style="normal" /></Paint></Path>
          <Path path={membranePath} color={emotionColor} opacity={0.2 + energyLevel.value * 0.15} style="stroke" strokeWidth={1.5}><Paint><BlurMask blur={4} style="solid" /></Paint></Path>
          
          {/* جسيمات المطر */}
          {weather === 'rain' || weather === 'storm' ? rainDrops.map((drop, i) => {
            const progress = (Date.now() / 1000 * drop.speed + i * 10) % (ENTITY_SIZE + 100);
            const yPos = progress - 50;
            return <Circle key={i} cx={drop.x} cy={yPos} r={drop.size} color="#A0C0FF" opacity={drop.opacity * 0.6} />;
          }) : null}

          {/* نبضة المفاجأة الذهبية */}
          {surpriseActive && (
            <Circle cx={CX} cy={CY} r={80} opacity={0.3}>
              <Paint><BlurMask blur={20} style="normal" /></Paint>
              <RadialGradient c={vec(CX, CY)} r={80} colors={['#FFD700', 'transparent']} />
            </Circle>
          )}

          {/* العينان */}
          <Path path={leftEyePath} color={emotionColor} opacity={0.9} style="fill" />
          <Path path={rightEyePath} color={emotionColor} opacity={0.9} style="fill" />
        </Group>
      </Canvas>) : (<View style={{ width: ENTITY_SIZE, height: ENTITY_SIZE, justifyContent: 'center', alignItems: 'center' }}><View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#A855F740' }} /></View>)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { width: ENTITY_SIZE, height: ENTITY_SIZE, alignSelf: 'center', justifyContent: 'center', alignItems: 'center' },
});
