import { PresenceState } from './PresenceEngine';

interface MemoryFrame {
  state: PresenceState;
  timestamp: number;
}

export class PresenceMemory {
  private frames: MemoryFrame[] = [];
  private maxFrames: number = 5;

  /**
   * يضيف PresenceState إلى الذاكرة
   */
  remember(state: PresenceState): void {
    const now = Date.now();
    this.frames.push({ state: { ...state }, timestamp: now });
    if (this.frames.length > this.maxFrames) {
      this.frames.shift();
    }
  }

  /**
   * يسترجع آخر PresenceState
   */
  getLast(): PresenceState | null {
    return this.frames.length > 0 ? this.frames[this.frames.length - 1].state : null;
  }

  /**
   * يحسب الأثر البصري (trail) - الحالة قبل الأخيرة بشفافية
   */
  getTrailState(): PresenceState | null {
    if (this.frames.length < 2) return null;
    const previous = this.frames[this.frames.length - 2].state;
    return { ...previous, auraOpacity: previous.auraOpacity * 0.3 };
  }
}

export const presenceMemory = new PresenceMemory();
