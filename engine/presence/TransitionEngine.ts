import { PresenceState } from './PresenceEngine';

export class TransitionEngine {
  private currentState: PresenceState | null = null;
  private targetState: PresenceState | null = null;
  private transitionProgress: number = 1;

  /**
   * يستقبل PresenceState جديد ويدمجه تدريجياً مع الحالي
   * يعيد PresenceState ممتزج لاستخدامه في الرسم
   */
  smooth(target: PresenceState, speed: number = 0.05): PresenceState {
    if (!this.currentState) {
      this.currentState = { ...target };
      this.targetState = { ...target };
      this.transitionProgress = 1;
      return this.currentState;
    }

    this.targetState = { ...target };
    this.transitionProgress += speed;

    if (this.transitionProgress >= 1) {
      this.currentState = { ...target };
      this.transitionProgress = 1;
      return this.currentState;
    }

    const t = this.transitionProgress;
    const current = this.currentState;
    const next = target;

    return {
      eyeOpenness: current.eyeOpenness + (next.eyeOpenness - current.eyeOpenness) * t,
      pupilSize: current.pupilSize + (next.pupilSize - current.pupilSize) * t,
      gazeDirection: {
        x: current.gazeDirection.x + (next.gazeDirection.x - current.gazeDirection.x) * t,
        y: current.gazeDirection.y + (next.gazeDirection.y - current.gazeDirection.y) * t,
      },
      gazeBehavior: t > 0.5 ? next.gazeBehavior : current.gazeBehavior,
      blinkRate: current.blinkRate + (next.blinkRate - current.blinkRate) * t,
      membraneAmplitude: current.membraneAmplitude + (next.membraneAmplitude - current.membraneAmplitude) * t,
      membraneSpeed: current.membraneSpeed + (next.membraneSpeed - current.membraneSpeed) * t,
      membranePoints: Math.round(current.membranePoints + (next.membranePoints - current.membranePoints) * t),
      auraSize: current.auraSize + (next.auraSize - current.auraSize) * t,
      auraOpacity: current.auraOpacity + (next.auraOpacity - current.auraOpacity) * t,
      auraColor: t > 0.5 ? next.auraColor : current.auraColor,
      auraFlicker: current.auraFlicker + (next.auraFlicker - current.auraFlicker) * t,
      auraLayers: Math.round(current.auraLayers + (next.auraLayers - current.auraLayers) * t),
      waveCount: Math.round(current.waveCount + (next.waveCount - current.waveCount) * t),
      waveSpeed: current.waveSpeed + (next.waveSpeed - current.waveSpeed) * t,
      waveAmplitude: current.waveAmplitude + (next.waveAmplitude - current.waveAmplitude) * t,
      breathSound: t > 0.5 ? next.breathSound : current.breathSound,
      breathRate: current.breathRate + (next.breathRate - current.breathRate) * t,
      touchResponse: t > 0.5 ? next.touchResponse : current.touchResponse,
      hapticIntensity: current.hapticIntensity + (next.hapticIntensity - current.hapticIntensity) * t,
      emotion: t > 0.5 ? next.emotion : current.emotion,
      energyLevel: current.energyLevel + (next.energyLevel - current.energyLevel) * t,
      warmth: current.warmth + (next.warmth - current.warmth) * t,
      silenceLevel: current.silenceLevel + (next.silenceLevel - current.silenceLevel) * t,
      microExpressions: next.microExpressions,
    };
  }
}

export const transitionEngine = new TransitionEngine();
