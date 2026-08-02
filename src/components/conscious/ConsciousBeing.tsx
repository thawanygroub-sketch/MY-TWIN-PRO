import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DigitalBeing } from './DigitalBeing';

type EmotionalState = 
  | 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised'
  | 'thinking' | 'love' | 'reject' | 'excited';

interface ConsciousBeingProps {
  size?: number;
  emotionalState?: EmotionalState;
  isListening?: boolean;
  isThinking?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

export const ConsciousBeing: React.FC<ConsciousBeingProps> = ({
  size,
  emotionalState = 'neutral',
  isListening = false,
  isThinking = false,
  onPress,
  onLongPress,
}) => {
  const derivedState: EmotionalState = isThinking ? 'thinking' : isListening ? 'neutral' : emotionalState;
  const auraIntensity = isThinking ? 9 : isListening ? 5 : 7;

  return (
    <View style={styles.container}>
      <DigitalBeing
        size={size}
        emotionalState={derivedState}
        auraIntensity={auraIntensity}
        waveCount={6}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
