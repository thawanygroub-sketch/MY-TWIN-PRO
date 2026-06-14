import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const generateId = () => Math.random().toString(36).substr(2, 9) + Date.now().toString(36);

export interface EmotionState {
  primary: string; secondary: string; intensity: number; valence: number; arousal: number;
  trend?: 'improving' | 'worsening' | 'stable'; riskLevel?: 'low' | 'medium' | 'high'; needsSupport: boolean;
}

export interface ConsciousnessState {
  mood: string; energy: number; curiosity: number; activeGoals: string[]; lastThought: string;
}

export interface ChatMessage {
  id: string; role: 'user' | 'twin'; content: string; image?: string; timestamp: number;
  failed?: boolean; emotion?: string; journeyPhase?: string; relationshipStage?: string;
  memoryRecall?: boolean; thinkingStage?: string; youtubeVideo?: string;
}

export interface RelationshipDims {
  trust?: number; attachment?: number; comfort?: number; openness?: number;
  romantic: number; humor: number; attStyle: number;
  empathy?: number; support?: number; communication?: number;
  affection?: number; dependency?: number;
  [key: string]: number | undefined;
}

export type Tier = 'free' | 'free_trial_14d' | 'premium_trial' | 'premium' | 'pro' | 'yearly' | 'plus';
export type Theme = 'dark' | 'light';
export type Lang = 'ar' | 'en';
export type TwinGender = 'female' | 'male';
export type TwinStyle = 'supportive' | 'coach' | 'wise' | 'fun' | 'calm';
export type ReplyStyle = 'short' | 'medium' | 'long';
export type JourneyPhase = 'introduction' | 'trust_building' | 'deepening' | 'growth' | 'mature';
export type AttachmentStyle = 'secure' | 'anxious' | 'avoidant' | 'disorganized' | 'unknown';
export type VoicePersonality = 'mentor' | 'friend' | 'romantic' | 'energetic' | 'calm';

export interface TwinStore {
  userId: string; setAuth: (userId: string) => void;
  twinName: string; setTwinName: (name: string) => void;
  twinGender: TwinGender; setTwinGender: (gender: TwinGender) => void;
  twinStyle: TwinStyle; setTwinStyle: (style: TwinStyle) => void;
  bondLevel: number; relationshipDims: RelationshipDims;
  energy: number; setEnergy: (value: number) => void;
  updateBond: (newBond: number) => void;
  updateRelationshipDims: (dims: Partial<RelationshipDims>) => void;

  subscriptionTier?: string;

  emotionState: EmotionState | null; setEmotionState: (emotion: EmotionState) => void;
  journeyPhase: JourneyPhase; setJourneyPhase: (phase: JourneyPhase) => void;
  attachmentStyle: AttachmentStyle; setAttachmentStyle: (style: AttachmentStyle) => void;
  consciousnessState: ConsciousnessState | null; setConsciousnessState: (state: ConsciousnessState) => void;
  isThinking: boolean; thinkingStage: string; setThinking: (val: boolean) => void; setThinkingStage: (stage: string) => void;

  chatHistory: ChatMessage[]; addMessage: (msg: Partial<ChatMessage>) => void; clearHistory: () => void;

  calmMode: boolean; toggleCalmMode: () => void;
  theme: Theme; toggleTheme: () => void;
  lang: Lang; setLang: (lang: Lang) => void; toggleLang: () => void;
  tier: Tier; updateTier: (tier: Tier) => void;
  points: number; addPoints: (pts: number) => void;
  badges: string[]; addBadge: (badge: string) => void;
  voiceEnabled: boolean; setVoiceEnabled: (enabled: boolean) => void;
  replyStyle: ReplyStyle; setReplyStyle: (style: ReplyStyle) => void;

  voiceDialect: string; setVoiceDialect: (dialect: string) => void;
  voiceSpeed: number; setVoiceSpeed: (speed: number) => void;
  voicePitch: number; setVoicePitch: (pitch: number) => void;
  voicePersonality: VoicePersonality; setVoicePersonality: (p: VoicePersonality) => void;

  menuVisible: boolean; openMenu: () => void; closeMenu: () => void;
  hasUsedTrial: boolean; setHasUsedTrial: (val: boolean) => void;
  twinTraits: string[]; setTwinTraits: (traits: string[]) => void;

  totalMessages: number; setTotalMessages: (val: number) => void;
  totalMinutes: number; setTotalMinutes: (val: number) => void;
  streakDays: number; setStreakDays: (val: number) => void;

  dailyMessagesUsed: number; setDailyMessagesUsed: (val: number) => void;
  dailyMessagesLimit: number; setDailyMessagesLimit: (val: number) => void;
  twinEnergy: number; setTwinEnergy: (val: number) => void;
  personalityTraits: { dominant: string; secondary: string } | null; setPersonalityTraits: (traits: any) => void;

  // ✅ تفضيلات جديدة لـ Preference Engine 100%
  favoriteTopics: string[]; setFavoriteTopics: (topics: string[]) => void;
  preferredResponseLength: 'short' | 'medium' | 'long'; setPreferredResponseLength: (len: 'short' | 'medium' | 'long') => void;
  tonePreference: 'casual' | 'formal' | 'emotional' | 'humorous'; setTonePreference: (tone: 'casual' | 'formal' | 'emotional' | 'humorous') => void;

  triggerHaptic: () => void; logout: () => void;
}

const initialState = {
  userId: '', twinName: 'توأمك', twinGender: 'female' as TwinGender,
  twinStyle: 'supportive' as TwinStyle, bondLevel: 0, energy: 50,
  relationshipDims: { trust: 0, attachment: 0, comfort: 0, openness: 0, romantic: 0, humor: 0, attStyle: 0 } as RelationshipDims,
  subscriptionTier: 'free',
  emotionState: null as EmotionState | null,
  journeyPhase: 'introduction' as JourneyPhase, attachmentStyle: 'unknown' as AttachmentStyle,
  consciousnessState: null as ConsciousnessState | null, isThinking: false, thinkingStage: 'thinking',
  chatHistory: [] as ChatMessage[],
  calmMode: false, theme: 'light' as Theme, lang: 'ar' as Lang, tier: 'free' as Tier,
  points: 0, badges: [] as string[], voiceEnabled: false, replyStyle: 'medium' as ReplyStyle,
  voiceDialect: 'modern_arabic', voiceSpeed: 0.9, voicePitch: 1.0, voicePersonality: 'friend' as VoicePersonality,
  menuVisible: false, hasUsedTrial: false, twinTraits: [] as string[],
  totalMessages: 0, totalMinutes: 0, streakDays: 0,
  dailyMessagesUsed: 0, dailyMessagesLimit: 15, twinEnergy: 100, personalityTraits: null,
  favoriteTopics: [], preferredResponseLength: 'medium' as const, tonePreference: 'emotional' as const,
};

export const useTwinStore = create<TwinStore>()(persist((set, get) => ({
  ...initialState,

  setAuth: (userId) => { console.log('🔑 setAuth:', userId); set({ userId }); },
  setTwinName: (name) => set({ twinName: name }),
  setTwinGender: (gender) => { console.log('👤 setTwinGender:', gender); set({ twinGender: gender }); },
  setTwinStyle: (style) => set({ twinStyle: style }),
  setEnergy: (value) => set({ energy: Math.max(0, Math.min(value, 100)) }),

  updateBond: (newBond) => set((state) => {
    const safeBond = Math.max(0, Math.min(newBond, 100)); const badges = [...state.badges];
    if (safeBond >= 40 && !badges.includes('friend')) badges.push('friend');
    if (safeBond >= 60 && !badges.includes('trusted')) badges.push('trusted');
    if (safeBond >= 80 && !badges.includes('soulmate')) badges.push('soulmate');
    if (safeBond >= 95 && !badges.includes('champion')) badges.push('champion');
    return { bondLevel: safeBond, badges };
  }),

  updateRelationshipDims: (dims) => set((state) => ({ relationshipDims: { ...state.relationshipDims, ...dims } })),
  setEmotionState: (emotion) => set({ emotionState: emotion }),
  setJourneyPhase: (phase) => set({ journeyPhase: phase }),
  setAttachmentStyle: (style) => set({ attachmentStyle: style }),
  setConsciousnessState: (state) => set({ consciousnessState: state }),
  setThinking: (val) => set({ isThinking: val }),
  setThinkingStage: (stage) => set({ thinkingStage: stage }),

  addMessage: async (msg) => set((state) => ({ chatHistory: [...state.chatHistory, {
    id: msg.id || generateId(), role: msg.role || 'user', content: msg.content || '',
    image: msg.image || undefined, timestamp: msg.timestamp || Date.now(),
    failed: msg.failed || false, emotion: msg.emotion || undefined,
    journeyPhase: msg.journeyPhase || undefined, relationshipStage: msg.relationshipStage || undefined,
    memoryRecall: msg.memoryRecall || undefined, thinkingStage: msg.thinkingStage || undefined,
  }].slice(-200) })),

  clearHistory: () => set({ chatHistory: [] }),
  toggleCalmMode: () => set((s) => ({ calmMode: !s.calmMode })),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  setLang: (lang) => set({ lang }),
  toggleLang: () => set((s) => ({ lang: s.lang === 'ar' ? 'en' : 'ar' })),
  updateTier: (tier) => set({ tier }),
  addPoints: (pts) => set((s) => ({ points: s.points + pts })),
  addBadge: (badge) => set((s) => s.badges.includes(badge) ? s : { badges: [...s.badges, badge] }),
  setVoiceEnabled: (enabled) => set({ voiceEnabled: enabled }),
  setReplyStyle: (style) => set({ replyStyle: style }),

  setVoiceDialect: (dialect) => set({ voiceDialect: dialect }),
  setVoiceSpeed: (speed) => set({ voiceSpeed: speed }),
  setVoicePitch: (pitch) => set({ voicePitch: pitch }),
  setVoicePersonality: (p) => set({ voicePersonality: p }),

  openMenu: () => set({ menuVisible: true }),
  closeMenu: () => set({ menuVisible: false }),

  setHasUsedTrial: (val) => set({ hasUsedTrial: val }),
  setTwinTraits: (traits) => set({ twinTraits: traits }),

  setTotalMessages: (val) => set({ totalMessages: val }),
  setTotalMinutes: (val) => set({ totalMinutes: val }),
  setStreakDays: (val) => set({ streakDays: val }),

  setDailyMessagesUsed: (val) => set({ dailyMessagesUsed: val }),
  setDailyMessagesLimit: (val) => set({ dailyMessagesLimit: val }),
  setTwinEnergy: (val) => set({ twinEnergy: val }),
  setPersonalityTraits: (traits) => set({ personalityTraits: traits }),

  // ✅ دوال تفضيلات جديدة
  setFavoriteTopics: (topics) => set({ favoriteTopics: topics }),
  setPreferredResponseLength: (len) => set({ preferredResponseLength: len }),
  setTonePreference: (tone) => set({ tonePreference: tone }),

  triggerHaptic: () => { if (!get().calmMode) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); },
  logout: () => set({ ...initialState, chatHistory: [] }),
}), {
  name: 'mytwin-store',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: (state) => ({
    userId: state.userId, twinName: state.twinName, twinGender: state.twinGender,
    twinStyle: state.twinStyle, bondLevel: state.bondLevel, relationshipDims: state.relationshipDims,
    subscriptionTier: state.subscriptionTier,
    energy: state.energy, emotionState: state.emotionState,
    journeyPhase: state.journeyPhase, attachmentStyle: state.attachmentStyle,
    calmMode: state.calmMode, theme: state.theme, lang: state.lang,
    tier: state.tier, points: state.points, badges: state.badges,
    voiceEnabled: state.voiceEnabled, replyStyle: state.replyStyle,
    voiceDialect: state.voiceDialect, voiceSpeed: state.voiceSpeed, voicePitch: state.voicePitch,
    voicePersonality: state.voicePersonality,
    hasUsedTrial: state.hasUsedTrial, twinTraits: state.twinTraits,
    totalMessages: state.totalMessages, totalMinutes: state.totalMinutes, streakDays: state.streakDays,
    dailyMessagesUsed: state.dailyMessagesUsed, dailyMessagesLimit: state.dailyMessagesLimit,
    twinEnergy: state.twinEnergy, personalityTraits: state.personalityTraits,
    favoriteTopics: state.favoriteTopics, preferredResponseLength: state.preferredResponseLength,
    tonePreference: state.tonePreference,
  }),
}));
