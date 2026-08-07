import { Audio } from 'expo-av';
import { EventBus } from './EventBus';
const COOLDOWN_MS = 1500;
const SOUND_SOURCES: Record<string, any> = {

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
    EventBus.on('MEMORY_SURFACED', () => this.playEffect('memory_found'));
    EventBus.on('MILESTONE_REACHED', () => this.playEffect('milestone'));
  }
}
export const audioMixer = new AudioMixer();
