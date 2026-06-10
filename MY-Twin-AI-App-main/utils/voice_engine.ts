import * as Speech from "expo-speech";
import { useTwinStore } from "../store/useTwinStore";

export interface VoiceOptions {
  pitch?: number;
  rate?: number;
  language?: string;
  voiceId?: string;
  onDone?: () => void;
  emotion?: string;
  intensity?: number;
  personality?: string;
}

let speakQueue: Array<{ text: string; options: VoiceOptions }> = [];
let isSpeakingNow = false;
let currentInterrupt: (() => void) | null = null;

const EMOTION_PRESETS: Record<string, { pitch: number; rate: number }> = {
  joy:       { pitch: 1.15, rate: 0.95 },
  sadness:   { pitch: 0.85, rate: 0.75 },
  anger:     { pitch: 1.0,  rate: 1.0  },
  fear:      { pitch: 0.9,  rate: 0.85 },
  love:      { pitch: 1.05, rate: 0.85 },
  surprise:  { pitch: 1.2,  rate: 1.0  },
  neutral:   { pitch: 1.0,  rate: 0.9  },
  support:   { pitch: 0.95, rate: 0.8  },
};

const PERSONALITY_PRESETS: Record<string, { pitch: number; rate: number }> = {
  supportive: { pitch: 0.95, rate: 0.85 },
  coach:      { pitch: 1.0,  rate: 0.9  },
  wise:       { pitch: 0.9,  rate: 0.8  },
  fun:        { pitch: 1.15, rate: 1.0  },
  calm:       { pitch: 0.85, rate: 0.75 },
  romantic:   { pitch: 1.05, rate: 0.8  },
};

// ✅ أصوات حسب النوع
const GENDER_VOICES: Record<string, string> = {
  male: 'ar-SA-HamedNeural',
  female: 'ar-SA-ZariyahNeural',
};

function cleanTextForSpeech(text: string): string {
  if (!text) return "";
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u2600-\u27BF]/gu, "")
    .replace(/[❤️‍🔥✨🌟💜🫂🤗🫶💕💖💪🤝]/gu, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/__/g, "")
    .replace(/~~/g, "")
    .replace(/`/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\n{2,}/g, "، ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function speakResponse(
  text: string,
  options?: VoiceOptions
): Promise<void> {
  try {
    const clean = cleanTextForSpeech(text);
    if (!clean) return;

    // ✅ جلب نوع التوأم من المتجر لاختيار الصوت المناسب
    const twinGender = useTwinStore.getState().twinGender || 'female';
    const defaultVoice = GENDER_VOICES[twinGender] || GENDER_VOICES.female;

    let pitch = options?.pitch ?? 1.0;
    let rate = options?.rate ?? 0.9;

    if (options?.emotion && EMOTION_PRESETS[options.emotion]) {
      const preset = EMOTION_PRESETS[options.emotion];
      pitch = preset.pitch;
      rate = preset.rate;
    }

    if (options?.personality && PERSONALITY_PRESETS[options.personality]) {
      const preset = PERSONALITY_PRESETS[options.personality];
      pitch = (pitch + preset.pitch) / 2;
      rate = (rate + preset.rate) / 2;
    }

    if (options?.intensity && options.intensity > 0.7) {
      pitch += 0.05;
      rate += 0.05;
    }

    speakQueue.push({
      text: clean,
      options: { ...options, pitch, rate, voiceId: defaultVoice },
    });

    if (!isSpeakingNow) {
      processQueue();
    }
  } catch (e) {
    console.warn("speakResponse error:", e);
  }
}

async function processQueue(): Promise<void> {
  if (speakQueue.length === 0) {
    isSpeakingNow = false;
    return;
  }

  isSpeakingNow = true;
  const item = speakQueue.shift()!;

  try {
    await new Promise<void>((resolve) => {
      currentInterrupt = () => {
        Speech.stop();
        resolve();
      };

      Speech.speak(item.text, {
        language: item.options.language || "ar-SA",
        pitch: item.options.pitch ?? 1.0,
        rate: item.options.rate ?? 0.9,
        voice: item.options.voiceId || undefined,
        onDone: () => {
          currentInterrupt = null;
          resolve();
        },
        onError: (e) => {
          console.warn("TTS error:", e);
          currentInterrupt = null;
          resolve();
        },
        onStopped: () => {
          currentInterrupt = null;
          resolve();
        },
      });
    });
  } catch (e) {
    console.warn("TTS playback error:", e);
  }

  processQueue();
}

export function stopSpeaking(): void {
  if (currentInterrupt) {
    currentInterrupt();
    currentInterrupt = null;
  }
  speakQueue = [];
  Speech.stop();
}

export function isSpeaking(): Promise<boolean> {
  return Speech.isSpeakingAsync();
}

export async function getAvailableVoices(): Promise<Speech.Voice[]> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices;
  } catch (e) {
    console.warn("getAvailableVoices error:", e);
    return [];
  }
}

export function autoInterrupt(): void {
  stopSpeaking();
}
