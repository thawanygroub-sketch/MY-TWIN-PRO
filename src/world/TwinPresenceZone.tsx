import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { usePresence } from '../hooks/usePresence';
import { useBreathAnimation } from '../hooks/useBreathAnimation';
import { useEmotionalState } from '../hooks/useEmotionalState';
import { useBondLevel } from '../hooks/useBondLevel';
import RelationshipAura from '../renderers/zones/RelationshipAura';
import TrustPulse from '../renderers/zones/TrustPulse';
import DigitalSoulPulse from '../renderers/zones/DigitalSoulPulse';
import MemoryEcho from '../renderers/zones/MemoryEcho';
import LivingLightEntity from '../renderers/zones/LivingLightEntity';
import { SPACE } from '../../src/design/tokens/spacing';

interface TwinPresenceZoneProps {
  memoryEchoVisible: boolean;
  echoColor: string;
  awakeningEyesOpen: boolean;
  onLongPress?: () => void;
}

export default function TwinPresenceZone({
  memoryEchoVisible, echoColor, awakeningEyesOpen, onLongPress,
}: TwinPresenceZoneProps) {
  const presence = usePresence();
  const breath = useBreathAnimation();
  const emotion = useEmotionalState();
  const bond = useBondLevel();

  return (
    <TouchableOpacity
      style={styles.container}
      onLongPress={onLongPress}
      disabled={!onLongPress}
      activeOpacity={1}
    >
      <DigitalSoulPulse/>
      <RelationshipAura size={240}/>
      <TrustPulse size={14}/>
      <MemoryEcho visible={memoryEchoVisible} color={echoColor}/>
      <View style={styles.avatarWrap}>
        <LivingLightEntity isListening={true} / onLongPress={() => {}} onPress={() => {}} isThinking={false} isSpeaking={false}>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: SPACE.xl,
  },
  avatarWrap: {
    zIndex: 5,
  },
});
