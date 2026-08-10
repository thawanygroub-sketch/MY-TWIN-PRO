export type PresenceEmotion = 'calm' | 'curious' | 'happy' | 'excited' | 'sad' | 'angry' | 'afraid' | 'surprised' | 'focused' | 'sleepy' | 'caring';
export interface RGB { r: number; g: number; b: number; }
export interface ConsciousnessState {
  energy: number; curiosity: number; emotion: number; arousal: number; focus: number;
  memory: number; trust: number; connection: number;
  listening: boolean; speaking: boolean; thinking: boolean; userPresent: boolean;
  voiceLevel: number; ambientLight: number; movement: number; proximity: number; touch: number;
  gazeX?: number; gazeY?: number;
}
export interface ConsciousnessSource {
  getState(): ConsciousnessState;
  subscribe(listener: (state: ConsciousnessState) => void): () => void;
}
export interface PresenceState {
  version: number; emotion: PresenceEmotion;
  energy: number; fieldRadius: number; fieldOpacity: number; fieldSpeed: number; turbulence: number; orbitality: number;
  colorA: RGB; colorB: RGB; eyeColor: RGB;
  eyeOpenness: number; eyeGlow: number; pupilSize: number; gazeX: number; gazeY: number; blink: number; eyeTilt: number; eyeSeparation: number;
  breathing: number; pulse: number; attention: number; warmth: number; anticipation: number;
  listening: boolean; speaking: boolean; thinking: boolean; userPresent: boolean;
  voiceLevel: number; ambientLight: number; movement: number; proximity: number; touch: number;
  continuity: number; previousEnergy: number; deltaEnergy: number; ageMs: number;
}
