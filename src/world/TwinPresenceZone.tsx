import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ConsciousBeing } from '../components/conscious/ConsciousBeing';
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
  return (
    <TouchableOpacity
      style={styles.container}
      onLongPress={onLongPress}
      disabled={!onLongPress}
      activeOpacity={1}
    >
      <View style={styles.avatarWrap}>
        <ConsciousBeing onLongPress={onLongPress} />
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
