export type PresenceLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type InterfaceState = 'dormant' | 'aware' | 'attentive' | 'listening' | 'thinking' | 'speaking' | 'remembering' | 'learning' | 'reflecting' | 'proactive' | 'twin';
export type SpaceEnergy = 'tranquil' | 'warm' | 'focused' | 'energetic' | 'mysterious' | 'protective' | 'tense' | 'serene';
export type CognitivePhase = 'idle' | 'observe' | 'understand' | 'recall' | 'reason' | 'respond';
export interface EmotionalState { primaryEmotion: string; intensity: number; valence: 'positive' | 'negative' | 'neutral' | 'mixed'; confidence: number; duration: number; trend: 'improving' | 'worsening' | 'stable'; }
export interface BreathState { phase: number; duration: number; intensity: number; isHolding: boolean; }
export interface AvatarState { eyesOpen: boolean; gazeTarget: string; expression: string; posture: string; blinkProgress: number; nextBlinkIn: number; }
export interface ConversationState { messages: any[]; isProcessing: boolean; currentCognitivePhase: CognitivePhase; phaseProgress: number; }
export interface MemoryState { lastSurfacedId: string | null; pendingSurfacing: boolean; recentContext: string | null; }
export interface WorkspaceState { active: string | null; previous: string | null; isTransforming: boolean; transformProgress: number; spatialMemory: Record<string, any>; }
export interface RelationshipState { bondLevel: number; attachmentStyle: string; trustScore: number; firstContactTimestamp: number | null; }
export interface Message { id: string; sender: 'user' | 'twin'; text: string; timestamp: number; confidence?: number; source?: 'memory' | 'inference' | 'knowledge' | 'unknown'; }
export interface PresenceInputState {
  energy: number; curiosity: number; emotionValence: number; arousal: number; focus: number;
  memoryLevel: number; trust: number; connection: number;
  listening: boolean; speaking: boolean; thinking: boolean; userPresent: boolean;
  voiceLevel: number; ambientLight: number; movement: number; proximity: number; touch: number;
  gazeX: number; gazeY: number;
}
export interface TwinState extends PresenceInputState {
  consciousness?: { energy: number; curiosity: number; fear: number; joy: number; attention: number; memoryEcho: number; cognitiveLoad: number; salience: number; selfAwareness: number; experienceIntensity: number; };
  presenceLevel: number; interfaceState: InterfaceState; isAwakening: boolean; awakeningPhase: string;
  breath: BreathState; avatar: AvatarState; emotion: EmotionalState; spaceEnergy: SpaceEnergy; silenceLevel: number;
  conversation: ConversationState; memory: MemoryState; workspace: WorkspaceState; relationship: RelationshipState;
  isOnline: boolean; isDegraded: boolean; uptime: number; personalityDNA: Record<string, number>;
  expressionIntent?: { breath: string; smile: number; pause: number; concern: number };
}
export const STATE_EVENTS = { MODE_CHANGED: 'state:mode_changed', EMOTION_CHANGED: 'state:emotion_changed', PRESENCE_CHANGED: 'state:presence_changed', AWARENESS_CHANGED: 'state:awareness_changed', BOND_CHANGED: 'state:bond_changed', STARTED_SPEAKING: 'state:started_speaking', STOPPED_SPEAKING: 'state:stopped_speaking', MEMORY_RETRIEVED: 'state:memory_retrieved', PROCESSING_COMPLETE: 'state:processing_complete', THOUGHT_COMPLETE: 'cognitive:thought_complete' } as const;
const DEFAULT_STATE: TwinState = {
  energy: 0.5, curiosity: 0.5, emotionValence: 0.05, arousal: 0.35, focus: 0.5, memoryLevel: 0.2, trust: 0.35, connection: 0.3,
  listening: false, speaking: false, thinking: false, userPresent: true, voiceLevel: 0, ambientLight: 0.5, movement: 0, proximity: 0.5, touch: 0, gazeX: 0, gazeY: 0,
  presenceLevel: 0, interfaceState: 'dormant', isAwakening: false, awakeningPhase: 'presence',
  breath: { phase: 0, duration: 8000, intensity: 0.15, isHolding: false },
  avatar: { eyesOpen: false, gazeTarget: 'none', expression: 'neutral', posture: 'centered', blinkProgress: 0, nextBlinkIn: 5000 },
  emotion: { primaryEmotion: 'neutral', intensity: 0, valence: 'neutral', confidence: 1, duration: 0, trend: 'stable' },
  spaceEnergy: 'tranquil', silenceLevel: 0,
  conversation: { messages: [], isProcessing: false, currentCognitivePhase: 'idle', phaseProgress: 0 },
  memory: { lastSurfacedId: null, pendingSurfacing: false, recentContext: null },
  workspace: { active: null, previous: null, isTransforming: false, transformProgress: 0, spatialMemory: {} },
  relationship: { bondLevel: 0, attachmentStyle: 'unknown', trustScore: 0.5, firstContactTimestamp: null },
  isOnline: true, isDegraded: false, uptime: 0,
  consciousness: { energy: 0.5, curiosity: 0.5, fear: 0, joy: 0, attention: 0.5, memoryEcho: 0, cognitiveLoad: 0.3, salience: 0.3, selfAwareness: 0.3, experienceIntensity: 0 },
  personalityDNA: { empathy: 0.85, curiosity: 0.8, humor: 0.5, initiative: 0.6, reflection: 0.9, logic: 0.75, creativity: 0.8, calmness: 0.85 },
};
const cloneState = (s: TwinState): TwinState => ({ ...s, consciousness: s.consciousness ? { ...s.consciousness } : undefined, breath: { ...s.breath }, avatar: { ...s.avatar }, emotion: { ...s.emotion }, conversation: { ...s.conversation }, memory: { ...s.memory }, workspace: { ...s.workspace, spatialMemory: { ...s.workspace.spatialMemory } }, relationship: { ...s.relationship }, personalityDNA: { ...s.personalityDNA } });
const clamp01 = (v: unknown, fb = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fb; };
const clampLevel = (v: unknown): PresenceLevel => { const n = Number(v); if (!Number.isFinite(n)) return 2; return Math.max(0, Math.min(9, Math.round(n))) as PresenceLevel; };
const normalizeUnit = (v: unknown, fb = 0): number => { const n = Number(v); if (!Number.isFinite(n)) return fb; return n > 1 ? clamp01(n / 100, fb) : clamp01(n, fb); };
type Sub = (state: TwinState, previous: TwinState) => void;
export class StateBusClass {
  private state: TwinState = cloneState(DEFAULT_STATE);
  private previousState: TwinState = cloneState(DEFAULT_STATE);
  private subscribers = new Set<Sub>();
  private eventListeners = new Map<string, Array<(event: string, data: any) => void>>();
  getState(): Readonly<TwinState> { return this.state; }
  update(patch: Partial<TwinState>): void { this.apply(patch); }
  patch(patch: Partial<TwinState>): void { this.apply(patch); }
  private apply(patch: Partial<TwinState>): void {
    this.previousState = cloneState(this.state);
    this.state = { ...this.state, ...patch };
    this.subscribers.forEach((sub) => { try { sub(this.state, this.previousState); } catch (e) { console.warn('[StateBus] subscriber error', e); } });
  }
  select<T>(sel: (s: TwinState) => T): T { return sel(this.state); }
  subscribe(sub: Sub): () => void { this.subscribers.add(sub); return () => { this.subscribers.delete(sub); }; }
  subscribeTo<T>(sel: (s: TwinState) => T, cb: (v: T) => void): () => void { return this.subscribe((s) => cb(sel(s))); }
  on(event: string, cb: (event: string, data: any) => void): () => void {
    const list = this.eventListeners.get(event) ?? [];
    list.push(cb); this.eventListeners.set(event, list);
    return () => { const cur = this.eventListeners.get(event); if (!cur) return; const i = cur.indexOf(cb); if (i >= 0) cur.splice(i, 1); };
  }
  emit(event: string, data: any = {}): void { (this.eventListeners.get(event) ?? []).forEach((cb) => { try { cb(event, data); } catch (e) { console.warn(`[StateBus] ${event}`, e); } }); }
  updateFromUnifiedResponse(response: any): void {
    if (!response) return;
    const presence = response.presence_state ?? {};
    const emotional = response.twin_emotional_state ?? {};
    const relationship = response.twin_state_update?.relationship ?? {};
    const dna = response.twin_state_update?.personality_dna ?? {};
    const surfacedMemory = response.memory_surfaced;
    const emotion = presence.emotion ?? emotional.current_emotion ?? response.emotion ?? 'neutral';
    const intensity = clamp01(presence.intensity ?? emotional.intensity ?? response.intensity ?? 0.5, 0.5);
    const rawValence = emotional.valence ?? (emotion === 'joy' || emotion === 'happy' ? 'positive' : emotion === 'sadness' || emotion === 'fear' || emotion === 'anger' ? 'negative' : 'neutral');
    const signedEmotion = rawValence === 'positive' ? intensity : rawValence === 'negative' ? -intensity : 0;
    const nextRelationship = { ...this.state.relationship, bondLevel: normalizeUnit(relationship.bond_level ?? response.bond_level ?? this.state.relationship.bondLevel, this.state.relationship.bondLevel), trustScore: normalizeUnit(relationship.trust ?? this.state.trust, this.state.trust) };
    const nextMemory = { ...this.state.memory, lastSurfacedId: surfacedMemory?.id ?? null, pendingSurfacing: false, recentContext: surfacedMemory?.content ?? null };
    this.apply({
      emotion: { primaryEmotion: emotion, intensity, valence: rawValence, confidence: clamp01(emotional.confidence ?? 0.7, 0.7), duration: 0, trend: 'stable' },
      emotionValence: signedEmotion,
      connection: normalizeUnit(nextRelationship.bondLevel, this.state.connection),
      trust: nextRelationship.trustScore,
      memory: nextMemory,
      memoryLevel: surfacedMemory ? 0.85 : this.state.memoryLevel,
      spaceEnergy: emotion === 'joy' || emotion === 'happy' ? 'energetic' : emotion === 'sadness' ? 'serene' : emotion === 'fear' ? 'tense' : emotion === 'anger' ? 'protective' : 'tranquil',
      interfaceState: 'twin',
      presenceLevel: clampLevel(presence.level ?? 2 + intensity * 4),
      relationship: nextRelationship,
      personalityDNA: { ...this.state.personalityDNA, ...dna },
    });
    this.emit(STATE_EVENTS.PRESENCE_CHANGED, { level: this.state.presenceLevel, emotion, intensity });
  }
  reset(): void { this.previousState = cloneState(DEFAULT_STATE); this.state = cloneState(DEFAULT_STATE); this.subscribers.forEach((sub) => { try { sub(this.state, this.previousState); } catch {} }); }
}
export const stateBus = new StateBusClass();
export const StateBus = stateBus;
