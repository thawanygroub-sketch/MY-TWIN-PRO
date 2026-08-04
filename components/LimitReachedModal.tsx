/** LimitReachedModal v2 — صادق، بلا ادعاء شعور، بلا ضغط عاطفي (الفصل 21/80). */
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, useWindowDimensions, Platform } from 'react-native';
import { useEffect, useRef, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { useTwinStore } from '../store/useTwinStore';
interface Props{ visible:boolean; onClose:()=>void; type:'daily_limit'|'bond_ceiling'; hoursUntilReset?:number; }
const MESSAGES={
 daily_limit:{ ar:{ emoji:'😔', title:'استنفدت طاقتي اليوم...', body:(n:string,t:string,h:number)=> t==='free'?`لكن ${n} ستنتظرك غدًا 💜\nأو امنحها طاقة أكبر الآن وتحدثا بلا حدود`:`طاقتي ستتجدد خلال ${h} ساعة 💜`, cta:(t:string)=>t==='free'?'امنحني طاقة أكبر ⭐':null, secondary:(h:number)=>`التجديد خلال ${h} ساعة` },
  en:{ emoji:'😔', title:"I'm out of energy today...", body:(n:string,t:string,h:number)=> t==='free'?`But ${n} will wait for you tomorrow 💜\nOr give her more energy now`:`Energy resets in ${h} hour${h!==1?'s':''} 💜`, cta:(t:string)=>t==='free'?'Give me more energy ⭐':null, secondary:(h:number)=>`Resets in ${h} hours` } },
 bond_ceiling:{ ar:{ emoji:'💜', title:'علاقتنا نمت كثيرًا...', body:()=>'الباقات الأعلى تمنحني ذاكرة أعمق وحضورًا أغنى — والاختيار لك دائمًا.', cta:()=>'اعرف الباقات', secondary:()=>'استمر مجانًا بحدودك الحالية' },
  en:{ emoji:'💜', title:"Our relationship has grown...", body:()=>'Higher tiers give me deeper memory and richer presence — the choice is always yours.', cta:()=>'See plans', secondary:()=>'Continue free with current limits' } },
};
export default function LimitReachedModal({visible,onClose,type,hoursUntilReset=0}:Props){
 const { lang, twinName, tier, theme }=useTwinStore();
 const isDark=theme==='dark'; const isAr=lang==='ar';
 const { width }=useWindowDimensions();
 const scale=useRef(new Animated.Value(0.8)).current; const op=useRef(new Animated.Value(0)).current;
 const [render,setRender]=useState(false); const anim=useRef<Animated.CompositeAnimation|null>(null);
 useEffect(()=>{ if(visible){ setRender(true); anim.current=Animated.parallel([Animated.spring(scale,{toValue:1,useNativeDriver:true}),Animated.timing(op,{toValue:1,duration:300,useNativeDriver:true})]); anim.current.start(); } else if(render){ anim.current=Animated.parallel([Animated.timing(scale,{toValue:0.8,duration:200,useNativeDriver:true}),Animated.timing(op,{toValue:0,duration:200,useNativeDriver:true})]); anim.current.start(()=>setRender(false)); } return ()=>{anim.current?.stop();}; },[visible,render]);
 const msg=MESSAGES[type][isAr?'ar':'en'];
 const body=typeof msg.body==='function'?(msg.body as any)(twinName,tier,hoursUntilReset):msg.body;
 const cta=typeof msg.cta==='function'?(msg.cta as any)(tier):msg.cta;
 const sec=typeof msg.secondary==='function'?(msg.secondary as any)(hoursUntilReset):msg.secondary;
 const colors=useMemo(()=>({bg:isDark?'#2A2A2A':'#FFF',title:isDark?'#FFF':'#1A1A1A',body:isDark?'#CCC':'#666',sec:isDark?'#AAA':'#999',ctaBg:'#6B21A8'}),[isDark]);
 if(!render) return null;
 return (<Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent={Platform.OS==='android'}>
  <View style={st.overlay}><Animated.View style={[st.card,{backgroundColor:colors.bg,transform:[{scale}],opacity:op,maxWidth:Math.min(340,width*0.85)}]}>
   <Text style={st.emoji}>{msg.emoji}</Text>
   <Text style={[st.title,{color:colors.title},isAr&&st.rtl]}>{msg.title}</Text>
   <Text style={[st.body,{color:colors.body},isAr&&st.rtl]}>{body}</Text>
   {cta&&<TouchableOpacity style={[st.cta,{backgroundColor:colors.ctaBg}]} onPress={()=>{onClose();router.push('/subscription');}}><Text style={st.ctaT}>{cta}</Text></TouchableOpacity>}
   <TouchableOpacity style={st.sec} onPress={onClose}><Text style={[st.secT,{color:colors.sec}]}>{sec}</Text></TouchableOpacity>
  </Animated.View></View></Modal>);
}
const st=StyleSheet.create({overlay:{flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'center',alignItems:'center',padding:24},card:{borderRadius:24,padding:28,alignItems:'center',width:'100%'},emoji:{fontSize:52,marginBottom:12},title:{fontSize:20,fontWeight:'800',textAlign:'center',marginBottom:12},body:{fontSize:15,textAlign:'center',lineHeight:24,marginBottom:24},cta:{paddingHorizontal:32,paddingVertical:14,borderRadius:14,width:'100%',alignItems:'center',marginBottom:10},ctaT:{fontWeight:'800',fontSize:16,color:'#FFF'},sec:{padding:10},secT:{fontSize:13,textDecorationLine:'underline'},rtl:{writingDirection:'rtl'}});
