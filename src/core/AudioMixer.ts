import { Audio } from 'expo-av';
import { EventBus } from './EventBus';
const COOLDOWN_MS = 1500;
const SOUND_SOURCES: Record<string, any> = {
  'ambience_space': require('../../assets/audio/presence/ambience_space.mp3'),
  'awakening_glow': require('../../assets/audio/presence/awakening_glow.mp3'),
  'battery_low': require('../../assets/audio/device/battery_low.mp3'),
  'bond_pulse': require('../../assets/audio/relationship/bond_pulse.mp3'),
  'breathing_loop': require('../../assets/audio/presence/breathing_loop.mp3'),
  'camera_look': require('../../assets/audio/device/camera_look.mp3'),
  'celebrate': require('../../assets/audio/ui/success_soft.mp3'),
  'comfort': require('../../assets/audio/device/head_nod.mp3'),
  'energy_hum': require('../../assets/audio/presence/energy_hum.mp3'),
  'error_soft': require('../../assets/audio/ui/error_soft.mp3'),
  'eye_blink': require('../../assets/audio/device/eye_blink.mp3'),
  'eyes_open': require('../../assets/audio/presence/eyes_open.mp3'),
  'first_breath': require('../../assets/audio/presence/first_breath.mp3'),
  'gesture_circle': require('../../assets/audio/gestures/gesture_circle.mp3'),
  'gesture_swipe': require('../../assets/audio/gestures/gesture_swipe.mp3'),
  'head_nod': require('../../assets/audio/device/head_nod.mp3'),
  'head_shake': require('../../assets/audio/device/head_shake.mp3'),
  'heartbeat_energy': require('../../assets/audio/presence/heartbeat_energy.mp3'),
  'life_rhythm_morning': require('../../assets/audio/life_rhythm/life_rhythm_morning.mp3'),
  'life_rhythm_night': require('../../assets/audio/life_rhythm/life_rhythm_night.mp3'),
  'membrane_shiver': require('../../assets/audio/presence/particles.mp3'),
  'memory_found': require('../../assets/audio/cognition/memory_found.mp3'),
  'memory_store': require('../../assets/audio/cognition/memory_store.mp3'),
  'memory_whisper': require('../../assets/audio/cognition/memory_whisper.mp3'),
  'message_sent': require('../../assets/audio/ui/message_sent.mp3'),
  'milestone': require('../../assets/audio/relationship/milestone.mp3'),
  'neural_hum': require('../../assets/audio/cognition/neural_hum.mp3'),
  'notification_soft': require('../../assets/audio/ui/notification_soft.mp3'),
  'particle_burst': require('../../assets/audio/presence/particles.mp3'),
  'particles': require('../../assets/audio/presence/particles.mp3'),
  'proximity_far': require('../../assets/audio/device/proximity_far.mp3'),
  'proximity_near': require('../../assets/audio/device/proximity_near.mp3'),
  'reasoning_loop': require('../../assets/audio/cognition/reasoning_loop.mp3'),
  'response_ready': require('../../assets/audio/cognition/response_ready.mp3'),
  'silence_room': require('../../assets/audio/presence/silence_room.mp3'),
  'startup_birth': require('../../assets/audio/presence/startup_birth.mp3'),
  'success_soft': require('../../assets/audio/ui/success_soft.mp3'),
  'surprise': require('../../assets/audio/presence/particles.mp3'),
  'thinking_start': require('../../assets/audio/cognition/thinking_start.mp3'),
  'trust_up': require('../../assets/audio/relationship/trust_up.mp3'),
  'typing': require('../../assets/audio/ui/typing.mp3'),
  'workspace_enter': require('../../assets/audio/workspace/workspace_enter.mp3'),
  'workspace_exit': require('../../assets/audio/workspace/workspace_exit.mp3'),
  'workspace_transform': require('../../assets/audio/workspace/workspace_transform.mp3'),
};
class AudioMixer {
  private sounds: Map<string, Audio.Sound> = new Map();
  private lastPlay: Map<string, number> = new Map();
  private ready = false;
  private context: string = 'ambient';
  private volume = 0.6;
  async init(): Promise<void> {
    if (this.ready) return;
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: false, shouldDuckAndroid: true });
      this.ready = true;
    } catch {}
  }
  setContext(ctx: string): void {
    this.context = ctx;
    if (ctx === 'silence') this.volume = 0;
    else if (ctx === 'conversation') this.volume = 0.35;
    else this.volume = 0.6;
  }
  getContext(): string { return this.context; }
  async playEffect(name: string): Promise<void> {
    if (this.volume <= 0) return;
    if (!this.ready) await this.init();
    const now = Date.now();
    if (now - (this.lastPlay.get(name) || 0) < COOLDOWN_MS) return;
    this.lastPlay.set(name, now);
    try {
      let sound = this.sounds.get(name);
      if (!sound) {
        const src = SOUND_SOURCES[name];
        if (!src) return;
        const { sound: s } = await Audio.Sound.createAsync(src, { shouldPlay: false, volume: this.volume });
        sound = s; this.sounds.set(name, sound);
      }
      await sound.setVolumeAsync(this.volume);
      await sound.setPositionAsync(0);
      await sound.playAsync();
    } catch {}
  }
  bindEvents(): void {
    EventBus.on('USER_SEND_MESSAGE', () => this.playEffect('message_sent'));
    EventBus.on('AI_START_THINKING', () => this.playEffect('thinking_start'));
    EventBus.on('AI_FINISH_THINKING', () => this.playEffect('response_ready'));
    EventBus.on('MEMORY_SURFACED', () => this.playEffect('memory_found'));
    EventBus.on('MILESTONE_REACHED', () => this.playEffect('milestone'));
  }
}
export const audioMixer = new AudioMixer();
