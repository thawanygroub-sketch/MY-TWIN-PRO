/** PresenceAudio v1 — تنفس سمعي خافت + نغمات سياقية، محكوم بإعداد وAppState. */
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { audioMixer } from './AudioMixer';
import { EventBus } from './EventBus';
const KEY = 'mytwin_presence_audio';
export class PresenceAudio {
  private enabled = true; private started = false; private lastMode = '';
  private breathTimer: ReturnType<typeof setTimeout> | null = null;
  async start(): Promise<void> {
    if (this.started) return; this.started = true;
    try { this.enabled = (await AsyncStorage.getItem(KEY)) !== 'false'; } catch {}
    EventBus.on('experience:frame', (f: any) => this.onFrame(f));
    this.scheduleBreath(6000);
  }
  async setEnabled(v: boolean): Promise<void> { this.enabled = v; try { await AsyncStorage.setItem(KEY, v ? 'true' : 'false'); } catch {} }
  private onFrame(f: any): void {
    if (!this.enabled || AppState.currentState !== 'active') return;
    const mode = f?.mode; if (!mode || mode === this.lastMode) return;
    this.lastMode = mode;
    try {
      if (mode === 'celebration') audioMixer.playEffect('celebrate');
      else if (mode === 'support') audioMixer.playEffect('bond_pulse');
      else if (mode === 'morning') audioMixer.playEffect('eyes_open');
    } catch {}
  }
  private scheduleBreath(ms: number): void {
    this.breathTimer = setTimeout(() => {
      if (this.enabled && AppState.currentState === 'active') { try { audioMixer.playEffect('breath'); } catch {} }
      this.scheduleBreath(7000 + Math.random() * 3000);
    }, ms);
  }
  stop(): void { if (this.breathTimer) clearTimeout(this.breathTimer); this.started = false; }
}
export const presenceAudio = new PresenceAudio();
