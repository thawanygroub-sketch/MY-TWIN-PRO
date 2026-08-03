import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, Group, BlurMask } from '@shopify/react-native-skia';
import { LivingEyes } from './LivingEyes';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ENTITY_SIZE = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT) * 0.9;
const CX = ENTITY_SIZE / 2;
const CY = ENTITY_SIZE / 2;

interface DigitalBeingProps {
  size?: number;
  eyeOpenness: number;
  pupilSize: number;
  auraSize: number;
  auraOpacity: number;
  membraneAmplitude: number;
  membraneSpeed: number;
  waveSpeed: number;
  energyLevel: number;
  warmth: number;
  auraFlicker: number;
  gazeX: number;
  gazeY: number;
  eyeExpression: string;
  headTilt: number;
  trailState: any;
}

export const DigitalBeing: React.FC<DigitalBeingProps> = ({
  size = ENTITY_SIZE,
  eyeOpenness, pupilSize, auraSize, auraOpacity,
  membraneAmplitude, membraneSpeed, waveSpeed,
  energyLevel, warmth, auraFlicker, gazeX, gazeY,
  eyeExpression, headTilt, trailState,
}) => {
  const as = auraSize * 1.5;  // 3x larger
  const ao = auraOpacity;
  const af = auraFlicker;
  const el = energyLevel;
  const wm = warmth;

  const auraColor = el > 0.7 ? '#FCD34D' : el > 0.4 ? '#A855F7' : '#3B82F6';
  const waveCount = Math.round(el * 6);
  const auraLayers = Math.round(el * 5);
  const strokeWidth = 12 + wm * 8;  // thick strokes

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Head tilt */}
      <View style={{ transform: [{ rotate: `${headTilt}deg` }] }}>
        <Canvas style={{ width: size, height: size }}>
          {/* Trail */}
          {trailState && (
            <Circle cx={CX} cy={CY} r={size * trailState.auraSize * 0.9} color={trailState.auraColor} opacity={trailState.auraOpacity * 0.2}>
              <BlurMask blur={30} style="solid" />
            </Circle>
          )}

          {/* Aura layers - thick */}
          <Group>
            {Array.from({ length: auraLayers }).map((_, i) => {
              const r = as * (1 - i * 0.1);
              const opacity = ao * (0.5 - i * 0.08);
              return (
                <Circle key={i} cx={CX} cy={CY} r={r} color={auraColor} opacity={Math.max(0.03, opacity)}>
                  <BlurMask blur={25 - i * 3} style="solid" />
                </Circle>
              );
            })}
          </Group>

          {/* Flicker */}
          {af > 0 && (
            <Circle cx={CX} cy={CY} r={as * 1.1} color="#FFFFFF" opacity={af * 0.3}>
              <BlurMask blur={20} style="solid" />
            </Circle>
          )}

          {/* Waves - thick */}
          {waveCount > 0 && Array.from({ length: waveCount }).map((_, i) => {
            const radius = size * 0.5 + (i * 15);
            const opacity = 0.3 * (1 - i / waveCount) * ao;
            return (
              <Circle key={`w-${i}`} cx={CX} cy={CY} r={radius} color={auraColor} opacity={opacity} style="stroke" strokeWidth={strokeWidth - i} />
            );
          })}

          {/* Core */}
          <Circle cx={CX} cy={CY} r={size * 0.18} color="#1a1a2e" />

          {/* Living Eyes */}
          <LivingEyes
            size={size}
            expression={eyeExpression}
            eyeOpenness={eyeOpenness}
            pupilSize={pupilSize}
            gazeX={gazeX}
            gazeY={gazeY}
          />
        </Canvas>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
