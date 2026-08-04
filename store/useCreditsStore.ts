/** useCreditsStore v2 — مرآة عرض فقط. السلطة للخادم (limits فيEnvelope). */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Tier } from './useTwinCoreStore';
interface CreditsState{ dailyCreditsUsed:number; dailyAdsWatched:number; dailyCreditsLimit:number; lastResetDate:string; tier:Tier;
  consumeCredits:(a:number)=>boolean; addCredits:(a:number)=>void; getRemainingCredits:()=>number; resetDaily:()=>void; setTier:(t:Tier)=>void; syncFromServer:(remaining:number)=>void; }
const today=()=>new Date().toISOString().split('T')[0];
const LIMITS:Record<Tier,number>={free:50,plus:200,premium:500,pro:2000,yearly:5000};
export const useCreditsStore=create<CreditsState>()(persist((set,get)=>({
  dailyCreditsUsed:0, dailyAdsWatched:0, dailyCreditsLimit:50, lastResetDate:today(), tier:'free' as Tier,
  consumeCredits:(a)=>{ const s=get(); if(s.lastResetDate!==today()) s.resetDaily(); if(s.dailyCreditsUsed+a>s.dailyCreditsLimit) return false; set({dailyCreditsUsed:s.dailyCreditsUsed+a}); return true; },
  addCredits:(a)=>{ console.warn('[Credits] addCredits deprecated — server authoritative'); },
  getRemainingCredits:()=>{ const s=get(); if(s.lastResetDate!==today()) s.resetDaily(); return Math.max(0,s.dailyCreditsLimit-s.dailyCreditsUsed); },
  resetDaily:()=>set({dailyCreditsUsed:0,dailyAdsWatched:0,dailyCreditsLimit:LIMITS[get().tier]||50,lastResetDate:today()}),
  setTier:(t)=>set({tier:t,dailyCreditsLimit:LIMITS[t]||50}),
  syncFromServer:(r)=>set({dailyCreditsLimit:r+get().dailyCreditsUsed}),
}),{ name:'mytwin-credits-v2', storage:createJSONStorage(()=>AsyncStorage) }));
