import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { DigitalBeing } from './DigitalBeing';
import { presenceMind } from '../../../engine/presence/PresenceMind';
import { presenceEngine } from '../../../engine/presence/PresenceEngine';
import { microBehaviorEngine } from '../../../engine/presence/MicroBehaviorEngine';
import { presenceMemory } from '../../../engine/presence/PresenceMemory';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';

interface ConsciousBeingProps {
  size?: number;
  onPress?: () => void;
  onLongPress?: () => void;
}

export const ConsciousBeing: React.FC<ConsciousBeingProps> = ({
  size,
  onPress,
  onLongPress,
}) => {
  const [visualState, setVisualState] = useState({
    eyeOpenness: 1, pupilSize: 0.5, auraSize: 0.65, auraOpacity: 0.6,
    membraneAmplitude: 0.3, membraneSpeed: 1, waveSpeed: 1,
    energyLevel: 0.5, warmth: 0.5, auraFlicker: 0.1,
    gazeX: 0, gazeY: 0, eyeExpression: 'normal', headTilt: 0,
    trailState: null as any,
  });

  const animValues = useRef({
    eyeOpenness: useSharedValue(1),
    pupilSize: useSharedValue(0.5),
    auraSize: useSharedValue(0.65),
    auraOpacity: useSharedValue(0.6),
    membraneAmplitude: useSharedValue(0.3),
    membraneSpeed: useSharedValue(1),
    waveSpeed: useSharedValue(1),
    energyLevel: useSharedValue(0.5),
    warmth: useSharedValue(0.5),
    auraFlicker: useSharedValue(0.1),
    gazeX: useSharedValue(0),
    gazeY: useSharedValue(0),
    eyeExpression: useSharedValue('normal' as any),
    headTilt: useSharedValue(0),
  }).current;

  useEffect(() => {
    const interval = setInterval(() => {
      const intent = presenceMind.evaluate();
      // const target = presenceEngine.translate(intent);
      const target = presenceEngine.translate(intent);
      const enhanced = microBehaviorEngine.enhance(target, 1000);
      presenceMemory.remember(enhanced);

      const a = animValues;
      a.eyeOpenness.value = withTiming(enhanced.eyeOpenness, { duration: 800, easing: Easing.inOut(Easing.ease) });
      a.pupilSize.value = withTiming(enhanced.pupilSize, { duration: 800 });
      a.auraSize.value = withTiming(enhanced.auraSize, { duration: 800 });
      a.auraOpacity.value = withTiming(enhanced.auraOpacity, { duration: 800 });
      a.membraneAmplitude.value = withTiming(enhanced.membraneAmplitude, { duration: 800 });
      a.membraneSpeed.value = withTiming(enhanced.membraneSpeed, { duration: 800 });
      a.waveSpeed.value = withTiming(enhanced.waveSpeed, { duration: 800 });
      a.energyLevel.value = withTiming(enhanced.energyLevel, { duration: 800 });
      a.warmth.value = withTiming(enhanced.warmth, { duration: 800 });
      a.auraFlicker.value = withTiming(enhanced.auraFlicker, { duration: 800 });
      a.gazeX.value = withTiming(enhanced.gazeDirection.x, { duration: 500 });
      a.gazeY.value = withTiming(enhanced.gazeDirection.y, { duration: 500 });
      a.eyeExpression.value = enhanced.eyeExpression as any;
      a.headTilt.value = withTiming(enhanced.headTilt, { duration: 600 });

      setVisualState({
        eyeOpenness: a.eyeOpenness.value,
        pupilSize: a.pupilSize.value,
        auraSize: a.auraSize.value,
        auraOpacity: a.auraOpacity.value,
        membraneAmplitude: a.membraneAmplitude.value,
        membraneSpeed: a.membraneSpeed.value,
        waveSpeed: a.waveSpeed.value,
        energyLevel: a.energyLevel.value,
        warmth: a.warmth.value,
        auraFlicker: a.auraFlicker.value,
        gazeX: a.gazeX.value,
        gazeY: a.gazeY.value,
        eyeExpression: a.eyeExpression.value,
        headTilt: a.headTilt.value,
        trailState: presenceMemory.getTrailState(),
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.container}>
        <DigitalBeing
          size={size}
          eyeOpenness={visualState.eyeOpenness}
          pupilSize={visualState.pupilSize}
          auraSize={visualState.auraSize}
          auraOpacity={visualState.auraOpacity}
          membraneAmplitude={visualState.membraneAmplitude}
          membraneSpeed={visualState.membraneSpeed}
          waveSpeed={visualState.waveSpeed}
          energyLevel={visualState.energyLevel}
          warmth={visualState.warmth}
          auraFlicker={visualState.auraFlicker}
          gazeX={visualState.gazeX}
          gazeY={visualState.gazeY}
          eyeExpression={visualState.eyeExpression as any}
          headTilt={visualState.headTilt}
          trailState={visualState.trailState}
        />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
