import React, { useEffect, useState } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { presenceBridge, presenceEngine } from '../../core/PresenceBridge';
import { useAppTheme } from '../../../engine/colors';
import type { PresenceState } from '../../../engine/presence/PresenceTypes';
import DigitalBeing from './DigitalBeing';
export default function ConsciousBeing({ size = 360, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const { isDark } = useAppTheme();
  const [presence, setPresence] = useState<PresenceState>(() => presenceEngine.getSnapshot());
  useEffect(() => {
    presenceBridge.start();
    return presenceEngine.subscribe((next) => setPresence(next));
  }, []);
  return (
    <View pointerEvents="none" style={[styles.container, { width: size, height: size }, style]}>
      <DigitalBeing presence={presence} size={size} isDark={isDark} />
    </View>
  );
}
const styles = StyleSheet.create({ container: { alignItems: 'center', justifyContent: 'center', overflow: 'visible' } });
