import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Canvas, Circle, Path, Group, Paint, BlurMask, Rect } from "@shopify/react-native-skia";
import Animated, {
  useSharedValue,
  useDerivedValue,
  useFrameCallback,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const CX = width / 2;
const CY = height / 2;

// ─── Worklet-safe Noise ───
const noise = (x: number, y: number, seed: number) => {
  'worklet';
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43758.5453) * 43758.5453;
  return n - Math.floor(n);
};

const fbm = (x: number, y: number, seed: number, octaves: number = 3) => {
  'worklet';
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise(x * freq, y * freq, seed + i);
    amp *= 0.5;
    freq *= 2;
  }
  return value;
};

// ─── Static Data ───
const PARTICLES = Array.from({ length: 40 }, (_, i) => ({
  baseAngle: (i / 40) * Math.PI * 2,
  baseDist: 80 + (i % 7) * 25,
  speed: 0.02 + (i % 5) * 0.015,
  size: 0.5 + (i % 4) * 0.8,
  seed: i * 1.618,
  layer: i % 3,
}));

const GRAIN_SEEDS = Array.from({ length: 20 }, (_, i) => ({
  x: (i * 137.5) % 1000,
  y: (i * 73.3) % 1000,
  size: 0.5 + (i % 3) * 0.3,
}));

export default function Index() {
  const router = useRouter();
  const [phase, setPhase] = React.useState('void');
  const [showSoulSync, setShowSoulSync] = React.useState(false);
  
  // ─── Time ───
  const time = useSharedValue(0);
  
  // ─── Spark ───
  const sparkOpacity = useSharedValue(0);
  const sparkScale = useSharedValue(0.1);
  const sparkIntensity = useSharedValue(0);
  
  // ─── Breath / Membrane ───
  const breathPhase = useSharedValue(0);
  const nucleusOpacity = useSharedValue(0);
  const baseRadius = useSharedValue(0);
  
  // ─── Heartbeat ───
  const heartbeat = useSharedValue(0);
  const energyPulse = useSharedValue(0);
  
  // ─── Eye ───
  const eyeOpacity = useSharedValue(0);
  const eyeGazeX = useSharedValue(0);
  const eyeGazeY = useSharedValue(0);
  const eyeFocus = useSharedValue(0);
  const eyeBlink = useSharedValue(0);
  const pupilDilation = useSharedValue(0.5);
  
  // ─── Presence ───
  const presenceIntensity = useSharedValue(0);
  
  // ─── Enter ───
  const enterScale = useSharedValue(1);
  const enterOpacity = useSharedValue(1);
  const tunnelDepth = useSharedValue(0);

  // ─── Frame Loop ───
  useFrameCallback((frameInfo) => {
    time.value = frameInfo.timeSinceFirstFrame;
  });

  // ─── Derived Values ───
  const sparkRadius = useDerivedValue(() => 6 * sparkScale.value);
  
  const tunnelRadius = useDerivedValue(() => 50 * tunnelDepth.value);

  const membranePath = useDerivedValue(() => {
    const t = time.value * 0.001;
    const hr = heartbeat.value;
    const br = breathPhase.value;
    const radius = baseRadius.value;
    
    if (radius <= 0) return '';
    
    let d = '';
    const points = 48;
    
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      
      const organic1 = Math.sin(angle * 3 + t * 0.8) * 0.3;
      const organic2 = Math.cos(angle * 5 - t * 0.5) * 0.2;
      const organic3 = Math.sin(angle * 7 + t * 1.2) * 0.15;
      const organic4 = fbm(Math.cos(angle) * 2, t * 0.2, 42) * 0.4;
      const breathExpand = br * 0.15;
      const tremor = hr * Math.sin(t * 20) * 0.1;
      const noiseVal = fbm(Math.cos(angle) * 2, Math.sin(angle) * 2 + t * 0.1, 99) * 0.25;
      
      const r = radius * (1 + organic1 + organic2 + organic3 + organic4 + breathExpand + tremor + noiseVal);
      const safeR = Math.max(1, r.value ?? r);
      
      const x = CX + Math.cos(angle) * safeR;
      const y = CY + Math.sin(angle) * safeR;
      
      if (i === 0) {
        d += `M ${x} ${y}`;
      } else {
        const prevAngle = ((i - 1) / points) * Math.PI * 2;
        const prevR = radius * (1 + Math.sin(prevAngle * 3 + t * 0.8) * 0.3 + Math.cos(prevAngle * 5 - t * 0.5) * 0.2 + Math.sin(prevAngle * 7 + t * 1.2) * 0.15 + fbm(Math.cos(prevAngle) * 2, t * 0.2, 42) * 0.4 + br * 0.15 + hr * Math.sin(t * 20) * 0.1 + fbm(Math.cos(prevAngle) * 2, Math.sin(prevAngle) * 2 + t * 0.1, 99) * 0.25);
        const prevSafeR = Math.max(1, prevR);
        const prevX = CX + Math.cos(prevAngle) * prevSafeR;
        const prevY = CY + Math.sin(prevAngle) * prevSafeR;
        
        const cpx = (prevX + x) / 2 + Math.sin(t + i) * 2;
        const cpy = (prevY + y) / 2 + Math.cos(t + i) * 2;
        
        d += ` Q ${cpx} ${cpy} ${x} ${y}`;
      }
    }
    d += ' Z';
    return d;
  });

  const eyePath = useDerivedValue(() => {
    const gx = eyeGazeX.value;
    const gy = eyeGazeY.value;
    const blink = eyeBlink.value;
    const focus = eyeFocus.value;
    
    const eyeWidth = 28 + focus * 4;
    const eyeHeight = (14 + focus * 2) * (1 - blink * 0.9);
    
    if (eyeHeight < 0.5) return '';
    
    const left = CX - eyeWidth / 2 + gx;
    const right = CX + eyeWidth / 2 + gx;
    const top = CY - 8 - eyeHeight / 2 + gy;
    const bottom = CY - 8 + eyeHeight / 2 + gy;
    const curveStrength = eyeWidth * 0.35;
    
    return `M ${CX + gx} ${top} C ${right + curveStrength} ${top + eyeHeight * 0.25}, ${right + curveStrength} ${bottom - eyeHeight * 0.25}, ${CX + gx} ${bottom} C ${left - curveStrength} ${bottom - eyeHeight * 0.25}, ${left - curveStrength} ${top + eyeHeight * 0.25}, ${CX + gx} ${top} Z`;
  });

  const auraPath = useDerivedValue(() => {
    const t = time.value * 0.001;
    const intensity = presenceIntensity.value;
    if (intensity <= 0) return '';
    
    let d = '';
    const points = 32;
    const baseR = 60 + baseRadius.value;
    
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const noiseVal = fbm(Math.cos(angle) * 2, Math.sin(angle) * 2 + t * 0.05, 123) * 0.3;
      const breath = Math.sin(t * 0.5 + angle) * 0.1;
      const r = baseR * (1 + noiseVal + breath) * intensity;
      const x = CX + Math.cos(angle) * r;
      const y = CY + Math.sin(angle) * r;
      if (i === 0) d += `M ${x} ${y}`;
      else d += ` L ${x} ${y}`;
    }
    d += ' Z';
    return d;
  });

  const voidGrain = useDerivedValue(() => {
    return fbm(time.value * 0.0001, time.value * 0.0001, 777) * 0.03;
  });

  // ─── Animated Styles ───
  const containerStyle = useAnimatedStyle(() => ({
    opacity: enterOpacity.value,
    transform: [{ scale: enterScale.value }],
  }));

  const soulSyncStyle = useAnimatedStyle(() => ({
    opacity: presenceIntensity.value * 0.5,
  }));

  // ─── Audio Helper ───
  const tryPlayAudio = useCallback((id: string) => {
    try {
      const { audioEngine } = require('../src/core/AudioEngine');
      audioEngine.play(id).catch(() => {});
    } catch (e) {}
  }, []);

  // ─── Actions ───
  const birthSpark = useCallback(() => {
    sparkOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.exp) });
    sparkScale.value = withTiming(1.5, { duration: 800, easing: Easing.out(Easing.back(2)) });
    sparkIntensity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(0.7, { duration: 300 }),
      withTiming(1, { duration: 200 }),
      withTiming(0, { duration: 400 })
    );
    tryPlayAudio('first_breath');
  }, []);

  const birthBreath = useCallback(() => {
    nucleusOpacity.value = withTiming(0.5, { duration: 800 });
    baseRadius.value = withTiming(12, { duration: 600 });
    breathPhase.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true
    );
  }, []);

  const triggerHeartbeat = useCallback(() => {
    heartbeat.value = withSequence(
      withTiming(1, { duration: 150 }),
      withTiming(0, { duration: 150 }),
      withTiming(1, { duration: 150 }),
      withTiming(0, { duration: 150 }),
      withTiming(1, { duration: 150 }),
      withTiming(0, { duration: 300 }),
    );
    energyPulse.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0.3, { duration: 200 }),
      withTiming(1, { duration: 100 }),
      withTiming(0.5, { duration: 300 }),
    );
    tryPlayAudio('heartbeat_energy');
  }, []);

  const openEye = useCallback(() => {
    eyeOpacity.value = withTiming(0.9, { duration: 1200 });
    pupilDilation.value = withTiming(0.8, { duration: 2000 });
    tryPlayAudio('eyes_open');
  }, []);

  const lookAt = useCallback((x: number, y: number, duration: number = 600) => {
    eyeGazeX.value = withTiming(x, { duration, easing: Easing.inOut(Easing.sin) });
    eyeGazeY.value = withTiming(y, { duration, easing: Easing.inOut(Easing.sin) });
  }, []);

  const setFocus = useCallback((focused: boolean) => {
    eyeFocus.value = withTiming(focused ? 1 : 0, { duration: 800 });
  }, []);

  const blinkEye = useCallback(() => {
    eyeBlink.value = withSequence(
      withTiming(1, { duration: 80 }),
      withTiming(0, { duration: 120 }),
    );
  }, []);

  const emergePresence = useCallback(() => {
    presenceIntensity.value = withTiming(1, { duration: 2000 });
    tryPlayAudio('awakening_glow');
  }, []);

  const enterEntity = useCallback((onComplete: () => void) => {
    tunnelDepth.value = withTiming(1, { duration: 1000, easing: Easing.in(Easing.exp) });
    enterScale.value = withTiming(25, { duration: 900, easing: Easing.in(Easing.cubic) });
    enterOpacity.value = withTiming(0, { duration: 700 }, () => {
      runOnJS(onComplete)();
    });
    tryPlayAudio('workspace_enter');
  }, []);

  // ─── Emergent Birth Sequence ───
  useEffect(() => {
    let eyeBehavior: ReturnType<typeof setInterval> | null = null;
    let failSafe: ReturnType<typeof setTimeout> | null = null;
    
    const startBirth = async () => {
      // شبكة أمان: إذا فشل كل شيء، انتقل تلقائياً بعد 15 ثانية
      failSafe = setTimeout(() => {
        router.replace('/genesis');
      }, 15000);

      try {
        await new Promise(r => setTimeout(r, 1500));
        
        runOnJS(setPhase)('spark');
        birthSpark();
        await new Promise(r => setTimeout(r, 1200));
        
        runOnJS(setPhase)('breath');
        birthBreath();
        await new Promise(r => setTimeout(r, 2500));
        
        runOnJS(setPhase)('heartbeat');
        triggerHeartbeat();
        await new Promise(r => setTimeout(r, 2000));
        
        runOnJS(setPhase)('awareness');
        openEye();
        
        eyeBehavior = setInterval(() => {
          const behaviors = ['wander', 'curious', 'focus', 'rest'];
          const choice = behaviors[Math.floor(Math.random() * behaviors.length)];
          
          switch(choice) {
            case 'wander':
              setFocus(false);
              lookAt((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 12, 800);
              break;
            case 'curious':
              setFocus(false);
              lookAt((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8, 400);
              break;
            case 'focus':
              setFocus(true);
              lookAt((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3, 1200);
              break;
            case 'rest':
              setFocus(false);
              lookAt(0, -2, 1500);
              break;
          }
          
          if (Math.random() > 0.6) {
            setTimeout(() => blinkEye(), Math.random() * 500);
          }
        }, 1500);
        
        await new Promise(r => setTimeout(r, 5000));
        
        runOnJS(setPhase)('eye');
        if (eyeBehavior) clearInterval(eyeBehavior);
        setFocus(true);
        lookAt(0, -1, 600);
        await new Promise(r => setTimeout(r, 2500));
        
        runOnJS(setPhase)('presence');
        emergePresence();
        runOnJS(setShowSoulSync)(true);
        await new Promise(r => setTimeout(r, 3000));
        
        runOnJS(setPhase)('enter');
        enterEntity(() => {
          if (failSafe) clearTimeout(failSafe);
          router.replace('/genesis');
        });
      } catch (e) {
        // إذا حصل أي خطأ، انتقل فوراً
        if (failSafe) clearTimeout(failSafe);
        router.replace('/genesis');
      }
    };
    
    startBirth();
    return () => {
      if (eyeBehavior) clearInterval(eyeBehavior);
      if (failSafe) clearTimeout(failSafe);
    };
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.void, containerStyle]}>
        <Canvas style={{ width, height }}>
          {/* Living Void */}
          <Rect x={0} y={0} width={width} height={height} color="#000005" />
          {/* Grain overlay */}
          {GRAIN_SEEDS.map((g, i) => {
            const grainOpacity = useDerivedValue(() => voidGrain.value * (0.02 + (i % 3) * 0.01));
            return (
              <Circle key={`grain-${i}`} cx={g.x % width} cy={g.y % height} r={g.size} color="#FFFFFF" opacity={grainOpacity} />
            );
          })}

          {/* Cosmic Particles */}
          {PARTICLES.map((p, i) => {
            const angle = useDerivedValue(() => p.baseAngle + time.value * 0.0005 * p.speed);
            const dist = useDerivedValue(() => p.baseDist + Math.sin(time.value * 0.0002 + p.seed) * 10);
            const x = useDerivedValue(() => CX + Math.cos(angle.value) * dist.value);
            const y = useDerivedValue(() => CY + Math.sin(angle.value) * dist.value);
            const opacity = useDerivedValue(() => 0.1 + Math.sin(time.value * 0.0003 + p.seed) * 0.05);
            return (
              <Circle key={`p-${i}`} cx={x} cy={y} r={p.size} color={p.layer === 0 ? '#A855F7' : '#7C3AED'} opacity={opacity}>
                <Paint><BlurMask blur={1.5} style="solid" /></Paint>
              </Circle>
            );
          })}

          {/* Spark */}
          {phase === 'spark' && (
            <Circle cx={CX} cy={CY} r={sparkRadius} color="#FFFFFF" opacity={sparkOpacity}>
              <Paint><BlurMask blur={15 * sparkIntensity} style="normal" /></Paint>
            </Circle>
          )}

          {/* Membrane (Breath +) */}
          {(phase === 'breath' || phase === 'heartbeat' || phase === 'awareness' || phase === 'eye' || phase === 'presence') && (
            <>
              <Path path={membranePath} color="#B8A0D0" opacity={nucleusOpacity} style="fill">
                <Paint><BlurMask blur={8} style="normal" /></Paint>
              </Path>
              <Path path={membranePath} color="#D0C0E8" opacity={nucleusOpacity.value * 0.4} style="stroke" strokeWidth={1.2}>
                <Paint><BlurMask blur={3} style="solid" /></Paint>
              </Path>
            </>
          )}

          {/* Aura (Presence) */}
          {phase === 'presence' && (
            <Path path={auraPath} color="#A855F7" opacity={presenceIntensity} style="fill">
              <Paint><BlurMask blur={25} style="normal" /></Paint>
            </Path>
          )}

          {/* Eye */}
          {(phase === 'awareness' || phase === 'eye' || phase === 'presence' || phase === 'enter') && (
            <>
              <Path path={eyePath} color="#D0C0E8" opacity={eyeOpacity} style="fill">
                <Paint><BlurMask blur={2} style="solid" /></Paint>
              </Path>
              {/* Pupil */}
              <Circle cx={CX + eyeGazeX} cy={CY - 8 + eyeGazeY} r={3 * pupilDilation} color="#1A0A30" opacity={eyeOpacity} />
            </>
          )}
        </Canvas>

        {/* Soul Sync text */}
        {showSoulSync && (
          <Animated.View style={[styles.soulSyncContainer, soulSyncStyle]}>
            <Text style={styles.soulSyncText}>SOUL SYNC</Text>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  void: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soulSyncContainer: {
    position: 'absolute',
    bottom: 50,
    alignItems: 'center',
  },
  soulSyncText: {
    fontSize: 12,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: '#A855F7',
    fontWeight: '300',
  },
});
