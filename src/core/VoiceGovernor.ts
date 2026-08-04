/** VoiceGovernor v1 — النطق محلي على الجهاز (expo-speech) بلا إرسال نص لخادم (83/82/50).
 * لا ينطق إلا بإذن صريح + تفعيل، ويستهلك 'experience:speak' بنبرة المخرج. */
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventBus } from './EventBus';

const CONSENT_KEY = 'mytwin_voice_consent';
const ENABLED_KEY = 'mytwin_voice_enabled';

export class VoiceGovernor {
  private started = false;
  start(): void {
    if (this.started) return;
    this.started = true;
    EventBus.on('experience:speak', (p: any) => this.speak(p?.text || '', p?.voice));
  }
  async isConsented(): Promise<boolean> {
    try { return (await AsyncStorage.getItem(CONSENT_KEY)) === 'true'; } catch { return false; }
  }
  async isEnabled(): Promise<boolean> {
    try { return (await AsyncStorage.getItem(ENABLED_KEY)) === 'true'; } catch { return false; }
  }
  async setConsent(v: boolean): Promise<void> { await AsyncStorage.setItem(CONSENT_KEY, v ? 'true' : 'false'); }
  async setEnabled(v: boolean): Promise<void> { await AsyncStorage.setItem(ENABLED_KEY, v ? 'true' : 'false'); }
  async speak(text: string, voice?: { rate?: number; pitch?: number }): Promise<void> {
    if (!(await this.isEnabled()) || !(await this.isConsented())) return;
    const clean = (text || '').slice(0, 400);
    if (!clean) return;
    Speech.stop();
    EventBus.emit('voice:started', {});
    Speech.speak(clean, {
      language: 'ar',
      rate: voice?.rate ?? 1,
      pitch: voice?.pitch ?? 1,
      onDone: () => EventBus.emit('voice:stopped', {}),
      onStopped: () => EventBus.emit('voice:stopped', {}),
    });
  }
  stop(): void { Speech.stop(); EventBus.emit('voice:stopped', {}); }
}
export const voiceGovernor = new VoiceGovernor();
