import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { DigitalBeing } from './DigitalBeing';

type EmotionalState = 
  | 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised'
  | 'thinking' | 'love' | 'reject' | 'excited';

interface ConsciousBeingProps {
  size?: number;
  emotionalState?: EmotionalState;
  isListening?: boolean;
  isThinking?: boolean;
  isSpeaking?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

export const ConsciousBeing: React.FC<ConsciousBeingProps> = ({
  size,
  emotionalState = 'neutral',
  isListening = false,
  isThinking = false,
  isSpeaking = false,
  onPress,
  onLongPress,
}) => {
  const derivedState: EmotionalState = isThinking ? 'thinking' : isSpeaking ? 'excited' : isListening ? 'neutral' : emotionalState;
  const auraIntensity = isThinking ? 9 : isSpeaking ? 8 : isListening ? 5 : 7;

  return (
    <Pressable onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.container}>
        <DigitalBeing
          size={size}
          emotionalState={derivedState}
          auraIntensity={auraIntensity}
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
