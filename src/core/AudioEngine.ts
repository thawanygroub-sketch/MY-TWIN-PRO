import { Audio, AVPlaybackStatus } from 'expo-av';
import { EventBus } from './EventBus';

type SoundCategory = 'layer' | 'one_shot' | 'loop';

interface SoundConfig {
  file: any;
  category: SoundCategory;
  volume: number;
  loops: boolean;
  isEmotional: boolean;
  group?: string;
}

interface PlayingSound {
  sound: Audio.Sound;
  config: SoundConfig;
  id: string;
}

const AUDIO_FILES: Record<string, SoundConfig> = {
  // ── طبقات الحضور ──────────────────────────────────
  silence_room: {
    file: require('../../assets/audio/presence/silence_room.mp3'),
    category: 'layer', volume: 0.08, loops: true, isEmotional: false,
  },
  ambience_space: {
    file: require('../../assets/audio/presence/ambience_space.mp3'),
    category: 'layer', volume: 0.10, loops: true, isEmotional: false,
  },
  breathing_loop: {
    file: require('../../assets/audio/presence/breathing_loop.mp3'),
    category: 'layer', volume: 0.06, loops: true, isEmotional: false,
  },
  heartbeat_energy: {
    file: require('../../assets/audio/presence/heartbeat_energy.mp3'),
    category: 'layer', volume: 0.05, loops: true, isEmotional: false,
  },
  energy_hum: {
    file: require('../../assets/audio/presence/energy_hum.mp3'),
    category: 'layer', volume: 0.07, loops: true, isEmotional: false,
  },

  // ── طقس الميلاد ──────────────────────────────────
  startup_birth: {
    file: require('../../assets/audio/presence/startup_birth.mp3'),
    category: 'one_shot', volume: 0.25, loops: false, isEmotional: true, group: 'awakening',
  },
  first_breath: {
    file: require('../../assets/audio/presence/first_breath.mp3'),
    category: 'one_shot', volume: 0.18, loops: false, isEmotional: true, group: 'awakening',
  },
  awakening_glow: {
    file: require('../../assets/audio/presence/awakening_glow.mp3'),
    category: 'one_shot', volume: 0.15, loops: false, isEmotional: true, group: 'awakening',
  },
  eyes_open: {
    file: require('../../assets/audio/presence/eyes_open.mp3'),
    category: 'one_shot', volume: 0.10, loops: false, isEmotional: true, group: 'awakening',
  },
  particles: {
    file: require('../../assets/audio/presence/particles.mp3'),
    category: 'one_shot', volume: 0.12, loops: false, isEmotional: true, group: 'awakening',
  },

  // ── المحادثة ─────────────────────────────────────
  message_sent: {
    file: require('../../assets/audio/ui/message_sent.mp3'),
    category: 'one_shot', volume: 0.15, loops: false, isEmotional: false, group: 'ui',
  },
  thinking_start: {
    file: require('../../assets/audio/cognition/thinking_start.mp3'),
    category: 'one_shot', volume: 0.12, loops: false, isEmotional: true, group: 'thinking',
  },
  reasoning_loop: {
    file: require('../../assets/audio/cognition/reasoning_loop.mp3'),
    category: 'loop', volume: 0.06, loops: true, isEmotional: true, group: 'thinking',
  },
  neural_hum: {
    file: require('../../assets/audio/cognition/neural_hum.mp3'),
    category: 'loop', volume: 0.05, loops: true, isEmotional: true, group: 'thinking',
  },
  response_ready: {
    file: require('../../assets/audio/cognition/response_ready.mp3'),
    category: 'one_shot', volume: 0.15, loops: false, isEmotional: true, group: 'thinking',
  },

  // ── الذاكرة ──────────────────────────────────────
  memory_found: {
    file: require('../../assets/audio/cognition/memory_found.mp3'),
    category: 'one_shot', volume: 0.14, loops: false, isEmotional: true, group: 'memory',
  },
  memory_store: {
    file: require('../../assets/audio/cognition/memory_store.mp3'),
    category: 'one_shot', volume: 0.07, loops: false, isEmotional: true, group: 'memory',
  },
  memory_whisper: {
    file: require('../../assets/audio/cognition/memory_whisper.mp3'),
    category: 'one_shot', volume: 0.10, loops: false, isEmotional: true, group: 'memory',
  },

  // ── العلاقة ──────────────────────────────────────
  trust_up: {
    file: require('../../assets/audio/relationship/trust_up.mp3'),
    category: 'one_shot', volume: 0.18, loops: false, isEmotional: true, group: 'relationship',
  },
  milestone: {
    file: require('../../assets/audio/relationship/milestone.mp3'),
    category: 'one_shot', volume: 0.22, loops: false, isEmotional: true, group: 'relationship',
  },
  bond_pulse: {
    file: require('../../assets/audio/relationship/bond_pulse.mp3'),
    category: 'one_shot', volume: 0.16, loops: false, isEmotional: true, group: 'relationship',
  },

  // ── مساحة العمل ──────────────────────────────────
  workspace_enter: {
    file: require('../../assets/audio/workspace/workspace_enter.mp3'),
    category: 'one_shot', volume: 0.12, loops: false, isEmotional: true, group: 'workspace',
  },
  workspace_exit: {
    file: require('../../assets/audio/workspace/workspace_exit.mp3'),
    category: 'one_shot', volume: 0.10, loops: false, isEmotional: true, group: 'workspace',
  },
  workspace_transform: {
    file: require('../../assets/audio/workspace/workspace_transform.mp3'),
    category: 'one_shot', volume: 0.11, loops: false, isEmotional: true, group: 'workspace',
  },


  // ── Device Presence ────────────────────────────────
  camera_look: {
    file: require('../../assets/audio/device/camera_look.mp3'),
    category: 'one_shot', volume: 0.10, loops: false, isEmotional: true, group: 'device',
  },
  eye_blink: {
    file: require('../../assets/audio/device/eye_blink.mp3'),
    category: 'one_shot', volume: 0.05, loops: false, isEmotional: false, group: 'device',
  },
  head_nod: {
    file: require('../../assets/audio/device/head_nod.mp3'),
    category: 'one_shot', volume: 0.12, loops: false, isEmotional: true, group: 'device',
  },
  head_shake: {
    file: require('../../assets/audio/device/head_shake.mp3'),
    category: 'one_shot', volume: 0.10, loops: false, isEmotional: true, group: 'device',
  },
  battery_low: {
    file: require('../../assets/audio/device/battery_low.mp3'),
    category: 'one_shot', volume: 0.15, loops: false, isEmotional: true, group: 'device',
  },
  proximity_far: {
    file: require('../../assets/audio/device/proximity_far.mp3'),
    category: 'one_shot', volume: 0.12, loops: false, isEmotional: true, group: 'device',
  },
  proximity_near: {
    file: require('../../assets/audio/device/proximity_near.mp3'),
    category: 'one_shot', volume: 0.10, loops: false, isEmotional: true, group: 'device',
  },
  // ── Gestures ───────────────────────────────────────
  gesture_swipe: {
    file: require('../../assets/audio/gestures/gesture_swipe.mp3'),
    category: 'one_shot', volume: 0.08, loops: false, isEmotional: false, group: 'gestures',
  },
  gesture_circle: {
    file: require('../../assets/audio/gestures/gesture_circle.mp3'),
    category: 'one_shot', volume: 0.09, loops: false, isEmotional: false, group: 'gestures',
  },
  // ── Life Rhythm ────────────────────────────────────
  life_rhythm_morning: {
    file: require('../../assets/audio/life_rhythm/life_rhythm_morning.mp3'),
    category: 'layer', volume: 0.08, loops: true, isEmotional: true, group: 'life_rhythm',
  },
  life_rhythm_night: {
    file: require('../../assets/audio/life_rhythm/life_rhythm_night.mp3'),
    category: 'layer', volume: 0.06, loops: true, isEmotional: true, group: 'life_rhythm',
  },


  // ── Device Presence ────────────────────────────────
  // ── Gestures ───────────────────────────────────────
  // ── Life Rhythm ────────────────────────────────────

  // ── UI عام ───────────────────────────────────────
  typing: {
    file: require('../../assets/audio/ui/typing.mp3'),
    category: 'one_shot', volume: 0.08, loops: false, isEmotional: false, group: 'ui',
  },
  success_soft: {
    file: require('../../assets/audio/ui/success_soft.mp3'),
    category: 'one_shot', volume: 0.12, loops: false, isEmotional: true, group: 'ui',
  },
  error_soft: {
    file: require('../../assets/audio/ui/error_soft.mp3'),
    category: 'one_shot', volume: 0.10, loops: false, isEmotional: false, group: 'ui',
  },
  notification_soft: {
    file: require('../../assets/audio/ui/notification_soft.mp3'),
    category: 'one_shot', volume: 0.10, loops: false, isEmotional: false, group: 'ui',
  },
};

export class AudioEngine {
  private layers: Map<string, PlayingSound> = new Map();
  private oneShots: Map<string, PlayingSound> = new Map();
  private activeEmotionalSound: string | null = null;
  private isMuted = false;
  private isInitialized = false;
  private unsubscribers: Array<() => void> = [];

  async init(): Promise<void> {
    if (this.isInitialized) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      this.isInitialized = true;
    } catch (error) {
      console.warn('[AudioEngine] فشل التهيئة:', error);
    }
  }

  async startAmbience(): Promise<void> {
    await this.playLayer('silence_room');
    await this.playLayer('ambience_space');
    await this.playLayer('breathing_loop');
    await this.playLayer('heartbeat_energy');
  }

  async play(id: string): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
    const config = AUDIO_FILES[id];
    if (!config) {
      console.warn(`[AudioEngine] صوت غير معروف: ${id}`);
      return;
    }

    if (config.isEmotional && this.activeEmotionalSound) {
      await this.stopEmotional();
    }

    try {
      const { sound } = await Audio.Sound.createAsync(config.file, {
        volume: this.isMuted ? 0 : config.volume,
        isLooping: config.loops,
        shouldPlay: true,
      });

      const playing: PlayingSound = { sound, config, id };

      if (config.category === 'layer') {
        this.layers.set(id, playing);
      } else {
        this.oneShots.set(id, playing);
      }

      if (config.isEmotional) {
        this.activeEmotionalSound = id;
      }

      if (!config.loops) {
        sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
          if (status.isLoaded && status.didJustFinish) {
            this.cleanup(id);
          }
        });
      }
    } catch (error) {
      console.warn(`[AudioEngine] فشل تشغيل ${id}:`, error);
    }
  }

  async stop(id: string): Promise<void> {
    const playing = this.layers.get(id) || this.oneShots.get(id);
    if (playing) {
      try { await playing.sound.stopAsync(); await playing.sound.unloadAsync(); } catch (e) {}
      this.cleanup(id);
    }
  }

  async stopEmotional(): Promise<void> {
    if (!this.activeEmotionalSound) return;
    const playing = this.oneShots.get(this.activeEmotionalSound);
    if (playing) {
      try { await playing.sound.stopAsync(); await playing.sound.unloadAsync(); } catch (e) {}
      this.oneShots.delete(this.activeEmotionalSound);
    }
    this.activeEmotionalSound = null;
  }

  async fadeAll(): Promise<void> {
    this.layers.forEach((playing) => { try { playing.sound.stopAsync(); playing.sound.unloadAsync(); } catch (e) {}
    });
    this.layers.clear();
    this.oneShots.forEach((playing) => { try { playing.sound.stopAsync(); playing.sound.unloadAsync(); } catch (e) {}
    });
    this.oneShots.clear();
    this.activeEmotionalSound = null;
  }

  mute(): void {
    this.isMuted = true;
    this.layers.forEach((playing: PlayingSound) => { playing.sound.setVolumeAsync(0).catch(() => {}); });
    this.oneShots.forEach((playing: PlayingSound) => { playing.sound.setVolumeAsync(0).catch(() => {}); });
  }

  unmute(): void {
    this.isMuted = false;
    this.layers.forEach((playing: PlayingSound) => { playing.sound.setVolumeAsync(playing.config.volume).catch(() => {}); });
    this.oneShots.forEach((playing: PlayingSound) => { playing.sound.setVolumeAsync(playing.config.volume).catch(() => {}); });
  }

  getIsMuted(): boolean { return this.isMuted; }

  bindEvents(): void {
    this.unsubscribers.push(
      EventBus.on('USER_OPEN_APP', () => { this.play('startup_birth'); }),
      EventBus.on('USER_SEND_MESSAGE', () => { this.play('message_sent'); }),
      EventBus.on('AI_START_THINKING', () => { this.play('thinking_start'); setTimeout(() => this.play('reasoning_loop'), 400); }),
      EventBus.on('AI_FINISH_THINKING', () => { this.stop('reasoning_loop'); this.play('response_ready'); }),
      EventBus.on('MEMORY_SURFACED', () => { this.play('memory_found'); }),
      EventBus.on('MEMORY_CREATED', () => { this.play('memory_store'); }),
      EventBus.on('TRUST_EVENT', (payload: any) => { if (payload?.type === 'earned') this.play('trust_up'); }),
      EventBus.on('RELATIONSHIP_MILESTONE', () => { this.play('milestone'); }),
      EventBus.on('WORKSPACE_TRANSFORM_START', () => { this.play('workspace_enter'); }),
      EventBus.on('WORKSPACE_TRANSFORM_COMPLETE', (payload: any) => { if (!payload?.to) this.play('workspace_exit'); }),
      EventBus.on('APP_BACKGROUND', () => { this.fadeAll(); }),
    );
  }

  unbindEvents(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }

  async destroy(): Promise<void> {
    this.unbindEvents();
    await this.fadeAll();
    this.isInitialized = false;
  }

  private async playLayer(id: string): Promise<void> { await this.play(id); }

  private cleanup(id: string): void {
    this.layers.delete(id);
    this.oneShots.delete(id);
    if (this.activeEmotionalSound === id) this.activeEmotionalSound = null;
  }
}

export const audioEngine = new AudioEngine();
