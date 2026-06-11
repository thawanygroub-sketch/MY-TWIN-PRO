import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Text } from 'react-native';
import { useTwinStore } from '../store/useTwinStore';
import { Brain, Heart, Target, Search, Database } from 'lucide-react-native';

interface ThinkingStageConfig {
  icon: React.ElementType;
  label_ar: string;
  label_en: string;
  color: string;
  animationSpeed: number;
}

// تكوين مراحل التفكير
const THINKING_STAGES: Record<string, ThinkingStageConfig> = {
  thinking:   { icon: Brain,    label_ar: 'أفكر...',          label_en: 'Thinking...',          color: '#A855F7', animationSpeed: 400 },
  memory:     { icon: Database, label_ar: 'أسترجع ذكرياتنا...', label_en: 'Recalling memories...', color: '#3B82F6', animationSpeed: 500 },
  emotion:    { icon: Heart,    label_ar: 'أفهم مشاعرك...',    label_en: 'Understanding you...',  color: '#EC4899', animationSpeed: 350 },
  planning:   { icon: Target,   label_ar: 'أخطط للرد...',      label_en: 'Planning response...', color: '#F59E0B', animationSpeed: 300 },
  searching:  { icon: Search,   label_ar: 'أبحث...',           label_en: 'Searching...',         color: '#10B981', animationSpeed: 450 },
};

// أوصاف الشخصية
const PERSONALITY_LABELS: Record<string, { ar: string; en: string }> = {
  wise:        { ar: 'الحكيم',   en: 'Wise' },
  fun:         { ar: 'المرح',    en: 'Fun' },
  supportive:  { ar: 'الداعم',   en: 'Supportive' },
  coach:       { ar: 'المدرب',   en: 'Coach' },
  calm:        { ar: 'الهادئ',   en: 'Calm' },
  romantic:    { ar: 'الرومانسي', en: 'Romantic' },
};

export default function TypingIndicator() {
  const {
    lang, theme, twinName, twinStyle, isThinking, thinkingStage
  } = useTwinStore((s) => ({
    lang: s.lang,
    theme: s.theme,
    twinName: s.twinName,
    twinStyle: s.twinStyle,
    isThinking: s.isThinking,
    thinkingStage: s.thinkingStage || 'thinking',
  }));

  const isAr = lang === 'ar';
  const isDark = theme === 'dark';

  // النقاط المتحركة
  const dots = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [dots]);

  // استخراج تكوين المرحلة الحالية
  const stage = THINKING_STAGES[thinkingStage] || THINKING_STAGES.thinking;
  const StageIcon = stage.icon;
  const stageLabel = isAr ? stage.label_ar : stage.label_en;

  // وصف الشخصية
  const personality = PERSONALITY_LABELS[twinStyle] || null;
  const personalityLabel = personality ? (isAr ? personality.ar : personality.en) : '';
  const displayName = twinName || (isAr ? 'توأمك' : 'Your Twin');
  const fullLabel = personalityLabel
    ? `${displayName} ${personalityLabel}`
    : displayName;

  return (
    <View style={styles.container} accessibilityRole="status" accessibilityLabel={stageLabel}>
      <View style={[
        styles.bubble,
        { backgroundColor: isDark ? '#2A2A2A' : '#F3F0FF', borderColor: isDark ? '#444' : '#E0D9F5' },
        isAr && styles.bubbleRTL
      ]}>
        {/* أيقونة مرحلة التفكير */}
        <StageIcon size={20} stroke={stage.color} />

        {/* نقاط متحركة */}
        <View style={[styles.dotsRow, isAr && styles.dotsRowRTL]}>
          {dots.map((dot, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: stage.color },
                {
                  opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                  transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }],
                },
              ]}
            />
          ))}
        </View>

        {/* النص */}
        <Text style={[styles.text, { color: isDark ? '#CCC' : '#666' }]} numberOfLines={1}>
          {fullLabel} {stageLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignSelf: 'flex-start',
    borderWidth: 1,
    gap: 8,
  },
  bubbleRTL: {
    flexDirection: 'row-reverse',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
  },
  dotsRowRTL: {
    flexDirection: 'row-reverse',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
  },
});
