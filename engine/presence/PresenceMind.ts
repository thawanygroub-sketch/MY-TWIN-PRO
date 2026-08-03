import { stateBus } from '../../src/core/StateBus';
import { lifeRhythmEngine } from '../life/LifeRhythmEngine';
import { devicePresenceEngine } from '../device/DevicePresenceEngine';

export type PresenceIntent =
  | 'sleeping'
  | 'waking'
  | 'curious'
  | 'focused'
  | 'playful'
  | 'calm'
  | 'concerned'
  | 'excited'
  | 'reflective'
  | 'overwhelmed'
  | 'connected'
  | 'neutral';

export interface ConsciousnessInput {
  energy: number;
  curiosity: number;
  fear: number;
  joy: number;
  attention: number;
  memoryEcho: number;
  timePhase: string;
  bondLevel: number;
  cognitiveLoad: number;
  salience: number;
  selfAwareness: number;
  proximity: number;
  faceDetected: boolean;
  audioLevel: number;
  experienceIntensity: number;
}

export class PresenceMind {
  private lastIntent: PresenceIntent = 'neutral';
  private intentDuration: number = 0;
  private lastUpdate: number = Date.now();
  private worldFamiliarity: number = 0;

  evaluate(): PresenceIntent {
    const rhythm = lifeRhythmEngine.getState();
    const state = stateBus.getState();
    const sensors = devicePresenceEngine.getSensors();

    const input: ConsciousnessInput = {
      energy: rhythm.energy,
      curiosity: state.personalityDNA?.curiosity || 0.5,
      fear: state.emotion?.primaryEmotion === 'fear' ? state.emotion.intensity : 0,
      joy: state.emotion?.primaryEmotion === 'joy' ? state.emotion.intensity : 0,
      attention: state.presenceLevel / 9,
      memoryEcho: state.memory?.lastSurfacedId ? 0.8 : 0,
      timePhase: rhythm.phase,
      bondLevel: state.relationship?.bondLevel || 0,
      cognitiveLoad: state.consciousness?.cognitiveLoad || 0.3,
      salience: state.consciousness?.salience || 0.3,
      selfAwareness: state.consciousness?.selfAwareness || 0.3,
      proximity: sensors.proximity || 100,
      faceDetected: sensors.faceDetected || false,
      audioLevel: sensors.audioLevel || 0.1,
      experienceIntensity: state.consciousness?.experienceIntensity || 0,
    };

    const intent = this.decideIntent(input);

    const now = Date.now();
    if (intent === this.lastIntent) {
      this.intentDuration += now - this.lastUpdate;
    } else {
      this.intentDuration = 0;
    }
    this.lastIntent = intent;
    this.lastUpdate = now;

    this.worldFamiliarity = Math.min(1, this.worldFamiliarity + 0.001 * this.intentDuration);

    return intent;
  }

  private decideIntent(input: ConsciousnessInput): PresenceIntent {
    if (input.timePhase === 'deep_sleep') return 'sleeping';
    if (input.timePhase === 'dawn') return 'waking';

    if (input.cognitiveLoad > 0.85) return 'overwhelmed';

    if (input.salience > 0.8) return 'focused';

    if (input.fear > 0.6) return 'concerned';

    if (input.joy > 0.7) return 'excited';

    if (input.curiosity > 0.7 && input.energy > 0.4) return 'curious';

    if (input.faceDetected && input.proximity < 50) return 'connected';

    if (input.experienceIntensity > 0.7) return 'reflective';

    if (input.attention > 0.7) return 'focused';

    if (input.energy > 0.8) return 'playful';

    if (input.memoryEcho > 0.5) return 'reflective';

    if (input.energy < 0.3) return 'calm';

    if (input.bondLevel > 60 && input.energy > 0.5) return 'calm';

    if (input.audioLevel < 0.05) return 'calm';

    return 'neutral';
  }

  getLastIntent(): PresenceIntent { return this.lastIntent; }
  getIntentDuration(): number { return this.intentDuration; }
  getWorldFamiliarity(): number { return this.worldFamiliarity; }
}

export const presenceMind = new PresenceMind();
