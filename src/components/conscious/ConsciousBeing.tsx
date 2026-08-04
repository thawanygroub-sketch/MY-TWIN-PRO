/** ConsciousBeing v2 — تنفس/نبض/رمش/تجوال عين + لون عاطفة → المُجسِّد المضيء. */
import React, { useEffect, useState } from 'react';
import { useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { EntityPresenceCanvas } from './EntityPresenceCanvas';
import { stateBus } from '../../core/StateBus';
const EMOTION_COLORS: Record<string, string> = {
  joy: '#F59E0B', sadness: '#38BDF8', fear: '#FB7185', anger: '#F87171', calm: '#A78BFA', neutral: '#A855F7',
};
export function ConsciousBeing() {
  const breath = useSharedValue(0.5); const pulse = useSharedValue(0);
  const blink = useSharedValue(0); const gazeX = useSharedValue(0); const gazeY = useSharedValue(0);
  const eyeOpacity = useSharedValue(0.95);
  const [accent, setAccent] = useState('#A855F7');
  useEffect(() => {
    breath.value = withRepeat(withSequence(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.sin) }),
      withTiming(0, { duration: 5200, easing: Easing.inOut(Easing.sin) })), -1, true);
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 900 })), -1, true);
    const gaze = setInterval(() => {
      gazeX.value = withTiming((Math.random() - 0.5) * 12, { duration: 900 });
      gazeY.value = withTiming((Math.random() - 0.5) * 7, { duration: 1100 });
      if (Math.random() > 0.72) blink.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 140 }));
    }, 2200);
    const off = stateBus.subscribeTo(s => s.emotion.primaryEmotion, e => setAccent(EMOTION_COLORS[e] || '#A855F7'));
    return () => { clearInterval(gaze); off(); };
  }, []);
  return <EntityPresenceCanvas breath={breath} pulse={pulse} blink={blink} gazeX={gazeX} gazeY={gazeY} eyeOpacity={eyeOpacity} />;
}
