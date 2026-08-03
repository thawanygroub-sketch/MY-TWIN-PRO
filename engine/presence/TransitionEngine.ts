import { PresenceState } from './PresenceEngine';

export class TransitionEngine {
  private currentState: PresenceState | null = null;
  private transitionProgress: number = 1;

  smooth(target: PresenceState, speed: number = 0.05): PresenceState {
    if (!this.currentState) {
      this.currentState = { ...target };
      this.transitionProgress = 1;
      return this.currentState;
    }

    this.transitionProgress += speed;
    if (this.transitionProgress >= 1) {
      this.currentState = { ...target };
      this.transitionProgress = 1;
      return this.currentState;
    }

    const t = this.transitionProgress;
    const c = this.currentState;
    const n = target;

    return {
      breathPhase: n.breathPhase, breathRate: n.breathRate,
      focusLevel: c.focusLevel + (n.focusLevel - c.focusLevel) * t,
      energyLevel: c.energyLevel + (n.energyLevel - c.energyLevel) * t,
      warmth: c.warmth + (n.warmth - c.warmth) * t,
      emotion: t > 0.5 ? n.emotion : c.emotion,
      emotionIntensity: c.emotionIntensity + (n.emotionIntensity - c.emotionIntensity) * t,
      silenceLevel: c.silenceLevel + (n.silenceLevel - c.silenceLevel) * t,
      memoryEchoIntensity: n.memoryEchoIntensity,
      intentIntensity: n.intentIntensity,
      microExpressions: n.microExpressions,
      eyeOpenness: c.eyeOpenness + (n.eyeOpenness - c.eyeOpenness) * t,
      pupilSize: c.pupilSize + (n.pupilSize - c.pupilSize) * t,
      gazeDirection: {
        x: c.gazeDirection.x + (n.gazeDirection.x - c.gazeDirection.x) * t,
        y: c.gazeDirection.y + (n.gazeDirection.y - c.gazeDirection.y) * t,
      },
      gazeBehavior: t > 0.5 ? n.gazeBehavior : c.gazeBehavior,
      eyeExpression: t > 0.5 ? n.eyeExpression : c.eyeExpression,
      headTilt: c.headTilt + (n.headTilt - c.headTilt) * t,
      blinkRate: c.blinkRate + (n.blinkRate - c.blinkRate) * t,
      membraneAmplitude: c.membraneAmplitude + (n.membraneAmplitude - c.membraneAmplitude) * t,
      membraneSpeed: c.membraneSpeed + (n.membraneSpeed - c.membraneSpeed) * t,
      membranePoints: Math.round(c.membranePoints + (n.membranePoints - c.membranePoints) * t),
      auraSize: c.auraSize + (n.auraSize - c.auraSize) * t,
      auraOpacity: c.auraOpacity + (n.auraOpacity - c.auraOpacity) * t,
      auraColor: t > 0.5 ? n.auraColor : c.auraColor,
      auraFlicker: c.auraFlicker + (n.auraFlicker - c.auraFlicker) * t,
      auraLayers: Math.round(c.auraLayers + (n.auraLayers - c.auraLayers) * t),
      waveCount: Math.round(c.waveCount + (n.waveCount - c.waveCount) * t),
      waveSpeed: c.waveSpeed + (n.waveSpeed - c.waveSpeed) * t,
      waveAmplitude: c.waveAmplitude + (n.waveAmplitude - c.waveAmplitude) * t,
      breathSound: t > 0.5 ? n.breathSound : c.breathSound,
      touchResponse: t > 0.5 ? n.touchResponse : c.touchResponse,
      hapticIntensity: c.hapticIntensity + (n.hapticIntensity - c.hapticIntensity) * t,
      audioEffect: t > 0.5 ? n.audioEffect : c.audioEffect,
      voiceTone: t > 0.5 ? n.voiceTone : c.voiceTone,
    };
  }
}

export const transitionEngine = new TransitionEngine();
