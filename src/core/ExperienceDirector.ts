/** ExperienceDirector v1 — مخرج التجربة الموحدة (الفصول 25/26/30/36/37/49/50).
 * يقرأ مصدر الحقيقة (StateBus/EventBus) ويصدر ExperienceFrame تستهلكه
 * الواجهات والصوت واللمس. لا يستبدل محركًا؛ ينسّقها فقط. */
import { stateBus, STATE_EVENTS } from './StateBus';
import { EventBus } from './EventBus';
import { lifeRhythmEngine } from '../../engine/life/LifeRhythmEngine';

export interface ExperienceFrame {
  mode: 'morning' | 'day' | 'night' | 'silence' | 'celebration' | 'support';
  palette: { accent: string; ambient: string };
  breathing: { duration: number; intensity: number };
  voice: { rate: number; pitch: number; soft: boolean };
  haptic: { pattern: 'none' | 'pulse' | 'double' | 'warm'; intensity: number };
}

const CONTEXT_COLORS: Record<string, string> = {
  general: '#D4A574', study: '#5BA0B0', dream: '#8B6B9E', business: '#7B9EB0',
  coach: '#7BA080', creative: '#C07070', code: '#6090C0', support: '#C09090',
};

export class ExperienceDirector {
  private lastUserTs = Date.now();
  private started = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.started) return;
    this.started = true;
    stateBus.on(STATE_EVENTS.PRESENCE_CHANGED, () => this.publish());
    stateBus.on(STATE_EVENTS.EMOTION_CHANGED, () => this.publish());
    EventBus.on('conversation:user_message', () => { this.lastUserTs = Date.now(); this.publish(); });
    EventBus.on('chat:twin_finalized', (p: any) => this.announce(p?.text || ''));
    this.timer = setInterval(() => this.publish(), 30000);
  }

  private mode(): ExperienceFrame['mode'] {
    const phase = (lifeRhythmEngine.getState() as any)?.phase || 'day';
    const s = stateBus.getState();
    const silentFor = Date.now() - this.lastUserTs;
    if (s.emotion.primaryEmotion === 'sadness' && s.emotion.intensity > 0.6) return 'support';
    if (s.emotion.primaryEmotion === 'joy' && s.emotion.intensity > 0.7) return 'celebration';
    if (silentFor > 90000 && s.isOnline) return 'silence';
    if (phase === 'dawn' || phase === 'morning') return 'morning';
    if (phase === 'night' || phase === 'deep_sleep') return 'night';
    return 'day';
  }

  private frame(): ExperienceFrame {
    const s = stateBus.getState();
    const m = this.mode();
    const e = s.emotion.primaryEmotion;
    let accent = CONTEXT_COLORS.general;
    if (m === 'support') accent = CONTEXT_COLORS.support;
    else if (e === 'sadness') accent = CONTEXT_COLORS.study;
    else if (e === 'fear') accent = CONTEXT_COLORS.support;
    else if (e === 'anger') accent = CONTEXT_COLORS.business;
    const ambient = m === 'morning' ? '#141428' : '#0A0A14';
    const breathing =
      m === 'silence' ? { duration: 10000, intensity: 0.10 } :
      m === 'night' ? { duration: 9000, intensity: 0.12 } :
      m === 'celebration' ? { duration: 4000, intensity: 0.30 } :
      m === 'support' ? { duration: 8000, intensity: 0.15 } :
      { duration: 6000, intensity: 0.20 };
    const voice =
      m === 'support' ? { rate: 0.85, pitch: 0.9, soft: true } :
      m === 'night' ? { rate: 0.9, pitch: 0.95, soft: true } :
      m === 'celebration' ? { rate: 1.05, pitch: 1.05, soft: false } :
      { rate: 1, pitch: 1, soft: false };
    const haptic =
      m === 'celebration' ? { pattern: 'warm' as const, intensity: 4 } :
      m === 'silence' || m === 'night' ? { pattern: 'none' as const, intensity: 0 } :
      { pattern: 'pulse' as const, intensity: 2 };
    return { mode: m, palette: { accent, ambient }, breathing, voice, haptic };
  }

  publish(): void {
    const f = this.frame();
    stateBus.update({
      spaceEnergy: f.mode === 'celebration' ? 'energetic'
        : f.mode === 'support' ? 'protective'
        : f.mode === 'silence' ? 'serene'
        : f.mode === 'night' ? 'tranquil' : 'warm',
    });
    EventBus.emit('experience:frame', f);
  }

  private announce(text: string): void {
    if (!text) return;
    EventBus.emit('experience:speak', { text, voice: this.frame().voice });
  }
}
export const experienceDirector = new ExperienceDirector();
