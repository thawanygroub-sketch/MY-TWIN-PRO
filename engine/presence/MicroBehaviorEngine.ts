import { PresenceState } from './PresenceEngine';

export class MicroBehaviorEngine {
  private time: number = 0;

  /**
   * يضيف ارتعاشات وومضات دقيقة على PresenceState
   */
  enhance(state: PresenceState, deltaTime: number): PresenceState {
    this.time += deltaTime;

    const enhanced = { ...state };

    // ارتعاش خفيف في العين (micro tremor)
    if (state.eyeOpenness > 0) {
      const tremor = Math.sin(this.time * 0.01) * 0.02;
      enhanced.eyeOpenness = Math.max(0, state.eyeOpenness + tremor);
    }

    // وميض عشوائي في الهالة
    if (state.auraFlicker > 0) {
      const flicker = Math.sin(this.time * 0.05) * state.auraFlicker;
      enhanced.auraOpacity = Math.max(0.1, Math.min(1, state.auraOpacity + flicker));
    }

    // تغير طفيف في حجم البؤبؤ
    const pupilNoise = Math.sin(this.time * 0.03) * 0.05;
    enhanced.pupilSize = Math.max(0.2, Math.min(1, state.pupilSize + pupilNoise));

    // ارتعاش الغشاء
    if (state.membraneAmplitude > 0) {
      const membraneTremor = Math.sin(this.time * 0.07) * 0.03;
      enhanced.membraneAmplitude = Math.max(0, state.membraneAmplitude + membraneTremor);
    }

    return enhanced;
  }
}

export const microBehaviorEngine = new MicroBehaviorEngine();
