import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ViewStyle } from 'react-native';
import { Sparkles, Brain, Zap, Star, Cloud } from 'lucide-react-native';
import { LivingSurface } from './LivingSurface';
import type { Status, Variant, Emotion } from './LivingSurface';

// ── LivingBubble ──
export const LivingBubble = ({ children, isTwin = false, style, status = 'idle' as Status, emotion = 'neutral' as Emotion }: { children: React.ReactNode; isTwin?: boolean; style?: ViewStyle; status?: Status; emotion?: Emotion }) => (
  <LivingSurface
    variant={isTwin ? 'twin' : 'user'}
    style={StyleSheet.flatten([
      { maxWidth: '85%', alignSelf: isTwin ? 'flex-start' : 'flex-end' },
      isTwin ? { borderBottomLeftRadius: 4 } : { borderBottomRightRadius: 4 },
      style,
    ])}
  >
    {children}
  </LivingSurface>
);

// ── LivingCard ──
export const LivingCard = (props: any) => (
  <LivingSurface {...props} style={StyleSheet.flatten([{ width: '100%' }, props.style])}>
    {props.children}
  </LivingSurface>
);

// ── LivingPanel ──
export const LivingPanel = (props: any) => (
  <LivingSurface {...props} style={StyleSheet.flatten([{ width: '100%', padding: 20 }, props.style])}>
    {props.children}
  </LivingSurface>
);

// ── LivingStatus ──
export const LivingStatus = ({ status = 'idle' as Status, variant = 'twin' as Variant }) => {
  const labels: Record<Status, string> = { idle: 'متصل', thinking: 'يفكر...', analyzing: 'يحلل...', learning: 'يتعلم...', remembering: 'يتذكر...', speaking: 'يتحدث...', connecting: 'يربط الذكريات...', planning: 'يبني خطة...', researching: 'يبحث في الذاكرة...' };
  return (
    <LivingSurface variant={variant}  style={StyleSheet.flatten([st.status, { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }])}>
      <Sparkles size={14} stroke="#A78BFA" />
      <Text style={{ color: '#A78BFA', fontSize: 12, fontWeight: '600', marginLeft: 6 }}>{labels[status]}</Text>
    </LivingSurface>
  );
};

// ── LivingPulse ──
export const LivingPulse = ({ color = '#A78BFA', size = 8 }: { color?: string; size?: number }) => {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => { const loop = Animated.loop(Animated.sequence([Animated.timing(anim, { toValue: 1, duration: 800, useNativeDriver: true }), Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true })])); loop.start(); return () => loop.stop(); }, []);
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: anim }} />;
};

// ── LivingWave ──
export const LivingWave = ({ color = '#A78BFA', count = 5 }: { color?: string; count?: number }) => {
  const waves = useRef(Array.from({ length: count }, () => new Animated.Value(0))).current;
  useEffect(() => { const loops = waves.map((w, i) => Animated.loop(Animated.sequence([Animated.delay(i * 150), Animated.timing(w, { toValue: 1, duration: 1000, useNativeDriver: true }), Animated.timing(w, { toValue: 0, duration: 1000, useNativeDriver: true })]))); Animated.parallel(loops).start(); }, []);
  return <View style={st.waveRow}>{waves.map((w, i) => <Animated.View key={i} style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: color, opacity: w, marginHorizontal: 2, transform: [{ scaleY: w.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }} />)}</View>;
};

const st = StyleSheet.create({ status: {}, waveRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 24 } });
