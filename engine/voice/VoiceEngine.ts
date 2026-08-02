import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { stateBus } from '../../src/core/StateBus';
import { audioMixer } from '../../src/core/AudioMixer';
import { EventBus } from '../../src/core/EventBus';

export class VoiceEngine {
  private isActive = false;
  private isSpeaking = false;
  private recording: Audio.Recording | null = null;

  start(): void {
    if (this.isActive) return;
    this.isActive = true;
    console.log('[VoiceEngine] 🎤 Voice Engine started');
  }

  stop(): void {
    this.isActive = false;
    this.stopSpeaking();
    this.stopListening();
  }

  // ──────────────────────────────────────────────
  // 1. TTS – تحويل النص إلى كلام (النطق)
  // ──────────────────────────────────────────────
  speak(text: string, emotion: string = 'neutral'): void {
    if (!this.isActive || !text) return;

    this.isSpeaking = true;
    // تحديث حالة الكيان ليعكس أنه يتحدث
    stateBus.update({
      interfaceState: 'speaking',
      presenceLevel: 4,
      avatar: {
        ...stateBus.getState().avatar,
        expression: emotion,
        eyesOpen: true,
        gazeTarget: 'user',
      },
    });
    stateBus.emit('presence:state_updated', {
      isSpeaking: true,
      isListening: false,
      isThinking: false,
      emotion: emotion,
    });
    EventBus.emit('VOICE_SPEAKING_START', { text });

    // إعدادات الصوت حسب المشاعر
    const pitch = emotion === 'joy' ? 1.2 : emotion === 'sadness' ? 0.8 : 1.0;
    const rate = emotion === 'joy' ? 1.1 : emotion === 'sadness' ? 0.8 : 0.95;

    Speech.speak(text, {
      language: 'ar',
      pitch: pitch,
      rate: rate,
      onDone: () => {
        this.isSpeaking = false;
        stateBus.update({
          interfaceState: 'twin',
          presenceLevel: 1,
        });
        stateBus.emit('presence:state_updated', {
          isSpeaking: false,
          isListening: true,
          isThinking: false,
        });
        EventBus.emit('VOICE_SPEAKING_END', {});
      },
      onError: (e) => {
        this.isSpeaking = false;
        console.warn('[VoiceEngine] Speech error:', e);
      },
    });
  }

  stopSpeaking(): void {
    Speech.stop();
    this.isSpeaking = false;
  }

  // ──────────────────────────────────────────────
  // 2. STT – تحويل الكلام إلى نص (الاستماع)
  // ──────────────────────────────────────────────
  async startListening(): Promise<void> {
    if (!this.isActive) return;

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        console.warn('[VoiceEngine] Microphone permission denied');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      this.recording = new Audio.Recording();
        await this.recording.prepareToRecordAsync({ android: { extension: ".m4a", outputFormat: 2, audioEncoder: 3, sampleRate: 44100, numberOfChannels: 2, bitRate: 128000 }, ios: { extension: ".m4a", audioQuality: 0, sampleRate: 44100, numberOfChannels: 2, bitRate: 128000 }, web: { mimeType: "audio/webm", bitsPerSecond: 128000 } } as any);
      await this.recording.startAsync();

      // تحديث حالة الكيان ليعكس أنه يستمع
      stateBus.update({
        interfaceState: 'listening',
        presenceLevel: 2,
      });
      stateBus.emit('presence:state_updated', {
        isSpeaking: false,
        isListening: true,
        isThinking: false,
      });
      EventBus.emit('VOICE_LISTENING_START', {});
      console.log('[VoiceEngine] 🎧 Listening started');
    } catch (e) {
      console.warn('[VoiceEngine] Failed to start listening:', e);
    }
  }

  async stopListening(): Promise<string | null> {
    if (!this.recording) return null;

    try {
      await this.recording.stopAndUnloadAsync();
      const uri = this.recording.getURI();
      this.recording = null;

      stateBus.emit('presence:state_updated', {
        isSpeaking: false,
        isListening: false,
        isThinking: true,
      });
      EventBus.emit('VOICE_LISTENING_END', { uri });

      console.log('[VoiceEngine] 🎧 Listening stopped, audio saved to:', uri);
      return uri;
    } catch (e) {
      console.warn('[VoiceEngine] Failed to stop listening:', e);
      return null;
    }
  }

  isActive_(): boolean { return this.isActive; }
  isSpeakingNow(): boolean { return this.isSpeaking; }

  // تفعيل ميزة "دائماً يستمع" مثل المساعدات الصوتية
  async startWakeWordDetection(): Promise<void> {
    console.log('[VoiceEngine] Wake word detection not yet implemented');
  }
}

export const voiceEngine = new VoiceEngine();
