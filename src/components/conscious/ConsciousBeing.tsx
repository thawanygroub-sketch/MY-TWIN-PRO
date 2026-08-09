import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { presenceEngine } from '../../core/PresenceBridge';
import { useAppTheme } from '../../../engine/colors';
import type { PresenceState } from '../../../engine/presence/PresenceTypes';
import DigitalBeing from './DigitalBeing';
export default function ConsciousBeing({ size = 340, style }: { size?: number; style?: object }) {
  const { isDark } = useAppTheme();
  const [presence, setPresence] = useState<PresenceState>(() => presenceEngine.getSnapshot());
  useEffect(() => { presenceEngine.start(); return presenceEngine.subscribe(setPresence); }, []);
  return (
    <View style={[styles.container, style]}>
      <DigitalBeing presence={presence} size={size} isDark={isDark} />
    </View>
  );
}
const styles = StyleSheet.create({ container: { alignItems: 'center', justifyContent: 'center' } });
