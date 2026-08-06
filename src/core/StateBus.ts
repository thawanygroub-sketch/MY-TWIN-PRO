import { EventBus, EventName } from './EventBus';
export type PresenceLevel = 0|1|2|3|4|5|6|7|8|9;
export type InterfaceState = 'dormant'|'aware'|'attentive'|'listening'|'thinking'|'speaking'|'remembering'|'learning'|'reflecting'|'proactive'|'twin';
export type SpaceEnergy = 'tranquil'|'warm'|'focused'|'energetic'|'mysterious'|'protective'|'tense'|'serene';
export type CognitivePhase = 'idle'|'observe'|'understand'|'recall'|'reason'|'respond';
export interface EmotionalState { primaryEmotion: string; intensity: number; valence: 'positive'|'negative'|'neutral'|'mixed'; confidence: number; duration: number; trend: 'improving'|'worsening'|'stable'; }
export interface BreathState { phase: number; duration: number; intensity: number; isHolding: boolean; }
export interface AvatarState { eyesOpen: boolean; gazeTarget: string; expression: string; posture: string; blinkProgress: number; nextBlinkIn: number; }
export interface ConversationState { messages: any[]; isProcessing: boolean; currentCognitivePhase: CognitivePhase; phaseProgress: number; }
export interface MemoryState { lastSurfacedId: string|null; pendingSurfacing: boolean; recentContext: string|null; }
export interface WorkspaceState { active: string|null; previous: string|null; isTransforming: boolean; transformProgress: number; spatialMemory: Record<string, any>; }
export interface RelationshipState { bondLevel: number; attachmentStyle: string; trustScore: number; firstContactTimestamp: number|null; }
export interface Message { id: string; sender: 'user'|'twin'; text: string; timestamp: number; confidence?: number; source?: 'memory'|'inference'|'knowledge'|'unknown'; }
export interface TwinState {
  consciousness?: { energy:number; curiosity:number; fear:number; joy:number; attention:number; memoryEcho:number; cognitiveLoad:number; salience:number; selfAwareness:number; experienceIntensity:number; };
  presenceLevel: number; interfaceState: InterfaceState; isAwakening: boolean; awakeningPhase: string;
  breath: BreathState; avatar: AvatarState; emotion: EmotionalState; spaceEnergy: SpaceEnergy; silenceLevel: number;
  conversation: ConversationState; memory: MemoryState; workspace: WorkspaceState; relationship: RelationshipState;
  isOnline: boolean; isDegraded: boolean; uptime: number; personalityDNA: Record<string, number>;
  expressionIntent?: { breath: string; smile: number; pause: number; concern: number };
}
export const STATE_EVENTS = { MODE_CHANGED:'state:mode_changed', EMOTION_CHANGED:'state:emotion_changed', PRESENCE_CHANGED:'state:presence_changed', AWARENESS_CHANGED:'state:awareness_changed', BOND_CHANGED:'state:bond_changed', STARTED_SPEAKING:'state:started_speaking', STOPPED_SPEAKING:'state:stopped_speaking', MEMORY_RETRIEVED:'state:memory_retrieved', PROCESSING_COMPLETE:'state:processing_complete', THOUGHT_COMPLETE:'cognitive:thought_complete' } as const;
const DEFAULT_STATE: TwinState = {
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
  consciousness: { energy:0.5, curiosity:0.5, fear:0, joy:0, attention:0.5, memoryEcho:0, cognitiveLoad:0.3, salience:0.3, selfAwareness:0.3, experienceIntensity:0 },
  personalityDNA: { empathy:0.85, curiosity:0.8, humor:0.5, initiative:0.6, reflection:0.9, logic:0.75, creativity:0.8, calmness:0.85 },
};
const clampLevel = (v: unknown): PresenceLevel => { const n = Number(v); if (!Number.isFinite(n)) return 2; return Math.max(0, Math.min(9, Math.round(n))) as PresenceLevel; };
type Sub = (s: TwinState, p: TwinState) => void;
export class StateBusClass {
  private state: TwinState; private prevState: TwinState;
  private subscribers: Set<Sub> = new Set();
  private eventListeners: Map<string, Array<(e: string, d: any) => void>> = new Map();
  constructor(){ this.state={...DEFAULT_STATE}; this.prevState={...DEFAULT_STATE}; }
  getState(): Readonly<TwinState>{ return this.state; }
  update(p: Partial<TwinState>){ this.apply(p); }
  private apply(p: Partial<TwinState>){ this.prevState={...this.state}; this.state={...this.state,...p}; this.subscribers.forEach(s=>{try{s(this.state,this.prevState);}catch(e){console.warn(e);}}); }
  select<T>(sel:(s:TwinState)=>T):T{ return sel(this.state); }
  subscribe(sub:Sub){ this.subscribers.add(sub); return ()=>{ this.subscribers.delete(sub); }; }
  subscribeTo<T>(sel:(s:TwinState)=>T, cb:(v:T)=>void){ return this.subscribe(s=>cb(sel(s))); }
  on(event:string, cb:(e:string,d:any)=>void){ if(!this.eventListeners.has(event)) this.eventListeners.set(event,[]); this.eventListeners.get(event)!.push(cb); return ()=>{const a=this.eventListeners.get(event); if(a){const i=a.indexOf(cb); if(i>-1)a.splice(i,1);}}; }
  emit(event:string, data:any={}){ (this.eventListeners.get(event)||[]).forEach(cb=>{try{cb(event,data);}catch(e){console.warn(`[StateBus] ${event}`,e);}}); }
  /** يقرأ Response Envelope الموحد مع fallback آمن — لا NaN أبدًا. */
  updateFromUnifiedResponse(response:any){
    if(!response) return;
    const p=response.presence_state||{}; const e=response.twin_emotional_state||{};
    const r=response.twin_state_update?.relationship||{}; const dna=response.twin_state_update?.personality_dna||{};
    const m=response.memory_surfaced;
    const emotion=p.emotion||e.current_emotion||response.emotion||'neutral';
    const intensity=Number(p.intensity??e.intensity??response.intensity??0.5)||0.5;
    this.apply({
      emotion:{ primaryEmotion:emotion, intensity,
        valence: emotion==='joy'?'positive':(emotion==='sadness'||emotion==='fear'?'negative':'neutral'),
        confidence:Number(e.confidence??0.7)||0.7, duration:0, trend:'stable' },
      relationship:{ bondLevel:Number(r.bond_level??response.bond_level??this.state.relationship.bondLevel)||0,
        attachmentStyle:this.state.relationship.attachmentStyle,
        trustScore:Number(r.trust??50)/100||0.5, firstContactTimestamp:this.state.relationship.firstContactTimestamp },
      memory:{ lastSurfacedId:m?.id||null, pendingSurfacing:false, recentContext:m?.content||null },
      spaceEnergy: emotion==='joy'?'energetic':emotion==='sadness'?'serene':emotion==='fear'?'tense':'tranquil',
      interfaceState:'twin',
      presenceLevel: clampLevel(p.level ?? (2+intensity*4)),
      personalityDNA:{ ...this.state.personalityDNA, ...dna },
    });
    this.emit(STATE_EVENTS.PRESENCE_CHANGED,{level:this.state.presenceLevel});
  }
  reset(){ this.prevState={...DEFAULT_STATE}; this.state={...DEFAULT_STATE}; this.subscribers.forEach(s=>s(this.state,this.prevState)); }
}
export const stateBus = new StateBusClass();
export const StateBus = stateBus;
