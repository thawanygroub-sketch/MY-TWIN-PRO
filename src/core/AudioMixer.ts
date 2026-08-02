import { audioEngine } from './AudioEngine';
import { stateBus } from './StateBus';

const EMOTION_AUDIO_MAP: Record<string, string[]> = {
  joy: ['success_soft', 'celebration'],
  sadness: ['silence_room', 'breathing_loop'],
  calm: ['silence_room', 'breathing_loop'],
  love: ['heartbeat_energy', 'bond_pulse'],
  anger: ['silence_room', 'energy_hum'],
  fear: ['silence_room', 'neural_hum'],
  neutral: ['ambience_space', 'breathing_loop'],
};

const BEHAVIOR_AUDIO: Record<string, string> = {
  startup: 'startup_birth',
  first_breath: 'first_breath',
  heartbeat: 'heartbeat_energy',
  eyes_open: 'eyes_open',
  awakening: 'awakening_glow',
  celebrate: 'milestone',
  comfort: 'trust_up',
  thinking_start: 'thinking_start',
  memory_found: 'memory_found',
  bond_pulse: 'bond_pulse',
  workspace_enter: 'workspace_enter',
  head_nod: 'head_nod',
  head_shake: 'head_shake',
};

export class AudioMixer {
  private currentContext: string = 'conversation';
  private activeLayers: Set<string> = new Set();

  constructor() {
    this.initBaseLayers();
    this.listenToPresence();
  }

  private async initBaseLayers(): Promise<void> {
    await audioEngine.init();
    audioEngine.startAmbience().catch(() => {});
  }

  private listenToPresence(): void {
    stateBus.on('presence:state_updated', (_: string, data: any) => {
      if (!data) return;
      if (data.emotion && data.emotionIntensity > 0.3) {
        this.setEmotionAudio(data.emotion);
      }
      if (data.silenceLevel > 0.5) {
        this.activeLayers.forEach(id => audioEngine.stop(id).catch(() => {}));
        this.activeLayers.clear();
      }
    });
  }

  setContext(context: string): void { this.currentContext = context; }

  playEffect(effect: string): void {
    try {
      const id = BEHAVIOR_AUDIO[effect] || effect;
      if (id) audioEngine.play(id).catch(() => {});
    } catch (e) {}
  }

  setEmotionAudio(emotion: string): void {
    this.activeLayers.forEach(id => audioEngine.stop(id).catch(() => {}));
    this.activeLayers.clear();
    const layers = EMOTION_AUDIO_MAP[emotion] || EMOTION_AUDIO_MAP.neutral;
    layers.forEach(id => {
      audioEngine.play(id).catch(() => {});
      this.activeLayers.add(id);
    });
  }

  playBreath(): void { audioEngine.play('first_breath').catch(() => {}); }
  playHeartbeat(): void { audioEngine.play('heartbeat_energy').catch(() => {}); }
  playMemoryEcho(): void { audioEngine.play('memory_found').catch(() => {}); }
  playTyping(): void { audioEngine.play('typing').catch(() => {}); }
  playThinking(): void { audioEngine.play('thinking_start').catch(() => {}); }
}

export const audioMixer = new AudioMixer();
