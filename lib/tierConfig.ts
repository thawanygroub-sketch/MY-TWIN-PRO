/** tierConfig v2 — أرقام العرض فقط. الخادم هو مصدر الحقيقة (A-001/A-002).
 * مجاني: 5 إعلانات (3 طاقة + 2 قدرات) | بلس: 2 | الأعلى: 0. */
import { Tier } from '../store/useTwinStore';
export interface TierConfig { name:string; price:number; billingPeriod?:string; dailyMessages:number;
  dailyFeatures:{study:number;content:number;business:number;code:number;image:number;smartHome:number;coach:number;dreams:number};
  adsRequired:boolean; maxDailyAds:number; energyAds:number; capabilityAds:number; rewardMessages:number; memoryDays:number; models:string[]; voice:string; coaching:boolean; dreams:boolean; }
export const TIERS: Record<Tier,TierConfig> = {
  free:{name:'Free',price:0,dailyMessages:15,dailyFeatures:{study:3,content:2,business:1,code:1,image:1,smartHome:3,coach:1,dreams:1},adsRequired:true,maxDailyAds:5,energyAds:3,capabilityAds:2,rewardMessages:0,memoryDays:3,models:['groq','gemini'],voice:'edge_tts',coaching:false,dreams:false},
  plus:{name:'Plus',price:5.99,dailyMessages:50,dailyFeatures:{study:15,content:10,business:5,code:5,image:3,smartHome:10,coach:3,dreams:3},adsRequired:true,maxDailyAds:2,energyAds:2,capabilityAds:2,rewardMessages:0,memoryDays:30,models:['groq','gemini','openrouter'],voice:'edge_tts',coaching:false,dreams:true},
  premium:{name:'Premium',price:14.99,dailyMessages:150,dailyFeatures:{study:50,content:40,business:30,code:30,image:10,smartHome:50,coach:20,dreams:20},adsRequired:false,maxDailyAds:0,energyAds:0,capabilityAds:0,rewardMessages:0,memoryDays:90,models:['gemini','groq','openrouter'],voice:'elevenlabs',coaching:true,dreams:true},
  pro:{name:'Pro',price:110,billingPeriod:'6_months',dailyMessages:500,dailyFeatures:{study:200,content:150,business:100,code:100,image:30,smartHome:200,coach:50,dreams:50},adsRequired:false,maxDailyAds:0,energyAds:0,capabilityAds:0,rewardMessages:0,memoryDays:365,models:['gemini','groq','openrouter'],voice:'elevenlabs',coaching:true,dreams:true},
  yearly:{name:'Yearly',price:199,billingPeriod:'yearly',dailyMessages:9999,dailyFeatures:{study:9999,content:9999,business:9999,code:9999,image:999,smartHome:9999,coach:9999,dreams:9999},adsRequired:false,maxDailyAds:0,energyAds:0,capabilityAds:0,rewardMessages:0,memoryDays:999,models:['gemini','groq','openrouter'],voice:'elevenlabs',coaching:true,dreams:true},
};
export const getTierConfig=(t:Tier)=>TIERS[t]||TIERS.free;
