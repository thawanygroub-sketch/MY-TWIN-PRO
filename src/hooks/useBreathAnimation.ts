/**
 * useBreathAnimation — Hook موحد للتنفس
 * ========================================
 * يقرأ breathPhase من StateBus الجديد
 * ويُنتج قيماً جاهزة للاستخدام في أي Renderer.
 */

import { useEffect, useState } from 'react';
import { StateBus, BreathState } from '../core/StateBus';
import { usePresence } from './usePresence';

interface BreathAnimation {
  phase: number;        // 0 → 1 → 0 (sine)
  intensity: number;    // 0.0 → 1.0
  duration: number;     // ms
  isHolding: boolean;
  scale: number;        // جاهز للاستخدام في transform
  opacity: number;      // جاهز للاستخدام في opacity
}

export function useBreathAnimation(): BreathAnimation {
  const { presenceLevel } = usePresence();
  const [breath, setBreath] = useState<BreathState>(() => StateBus.select(s => s.breath));

  useEffect(() => {
    const unsub = StateBus.subscribeTo(
      (s) => s.breath,
      (state) => setBreath({ ...state })
    );
    return unsub;
  }, []);

  // تحويل breathPhase إلى قيم جاهزة للـ Renderer
  const scale = 0.88 + breath.phase * 0.12;        // 0.88 → 1.0
  const opacity = 0.2 + breath.phase * 0.4 + presenceLevel * 0.03;

  return {
    phase: breath.phase,
    intensity: breath.intensity,
    duration: breath.duration,
    isHolding: breath.isHolding,
    scale,
    opacity: Math.min(1, opacity),
  };
}
