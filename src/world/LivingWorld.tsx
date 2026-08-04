/** LivingWorld v2 — الصوت بإذن صريح فقط (خصوصية/بطارية)، الرسائل من المخزن،
 * والحضور يُغذى من Envelope عبر useStreamingChat. */
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRTL } from '../../lib/useRTL';
import { useAppTheme } from '../../engine/colors';
import { useTwinStore } from '../../store/useTwinStore';
import { useConversationStore } from '../../store/useConversationStore';
import { useStreamingChat } from '../../lib/useStreamingChat';
import { bootstrapCoordinator } from '../core/BootstrapCoordinator';
import { voiceEngine } from '../../engine/voice/VoiceEngine';
import { ConsciousBeing } from '../components/conscious/ConsciousBeing';
import { SPACE, RADIUS } from '../../src/design/tokens/spacing';
import { Send, Mic, MicOff } from 'lucide-react-native';
const { height } = Dimensions.get('window');
export default function LivingWorld(){
 const userId=useTwinStore(s=>s.userId)||'';
 const { colors }=useAppTheme(); const rtl=useRTL();
 const { isStreaming, sendStreamingMessage }=useStreamingChat();
 const streamingText=useTwinStore(s=>(s as any).streamingText)||'';
 const chatHistory=useConversationStore(s=>(s as any).chatHistory)||[];
 const [input,setInput]=useState(''); const [listening,setListening]=useState(false);
 useEffect(()=>{ let mounted=true;
   if(userId){ bootstrapCoordinator.bootstrap();
     (async()=>{ try{ const en=await AsyncStorage.getItem('mytwin_voice_enabled'); if(mounted&&en==='true') await voiceEngine.start(); }catch{} })(); }
   return ()=>{ mounted=false; voiceEngine.stop(); };
 },[userId]);
 const handleSend=useCallback(async()=>{ const t=input.trim(); if(!t||isStreaming) return; setInput(''); await sendStreamingMessage(t); },[input,isStreaming,sendStreamingMessage]);
 const toggleListen=async()=>{ if(listening){ voiceEngine.stopListening(); setListening(false);} else { try{ await voiceEngine.startListening(); setListening(true);}catch{} } };
 return (<KeyboardAvoidingView style={[st.container,{backgroundColor:colors.bg}]} behavior={Platform.OS==='ios'?'padding':'height'}>
  <View style={st.entity}><ConsciousBeing/></View>
  <ScrollView style={st.conv} contentContainerStyle={{paddingBottom:100}}>
   {chatHistory.map((m:any)=>(<View key={m.id} style={[st.bubble,m.role==='user'?st.user:st.twin,{backgroundColor:m.role==='user'?colors.accent+'20':colors.card}]}>
     <Text style={[st.msg,{color:colors.text}]}>{m.role==='twin'&&isStreaming&&m.id===chatHistory[chatHistory.length-1]?.id?streamingText:m.content}</Text></View>))}
  </ScrollView>
  <View style={[st.input,{backgroundColor:colors.card}]}>
   <TouchableOpacity onPress={toggleListen} style={st.voice}>{listening?<MicOff size={22} stroke={colors.accent}/>:<Mic size={22} stroke={colors.textSecondary}/>}</TouchableOpacity>
   <TextInput style={[st.field,{textAlign:rtl.textAlign,color:colors.text}]} value={input} onChangeText={setInput} onSubmitEditing={handleSend} editable={!isStreaming} placeholder={rtl.isRTL?'اكتب رسالتك...':'Write your message...'} placeholderTextColor={colors.textSecondary}/>
   <TouchableOpacity onPress={handleSend} disabled={isStreaming}><Send size={22} stroke={isStreaming?colors.textSecondary:colors.accent}/></TouchableOpacity>
  </View></KeyboardAvoidingView>);
}
const st=StyleSheet.create({container:{flex:1},entity:{position:'absolute',top:0,left:0,right:0,height:height*0.45,justifyContent:'center',alignItems:'center'},conv:{flex:1,marginTop:height*0.45,paddingHorizontal:SPACE.lg},bubble:{maxWidth:'80%',padding:SPACE.md,borderRadius:20,marginBottom:SPACE.sm},user:{alignSelf:'flex-end'},twin:{alignSelf:'flex-start'},msg:{fontSize:16},input:{flexDirection:'row',alignItems:'center',padding:SPACE.sm,marginHorizontal:SPACE.md,marginBottom:SPACE.xl,borderRadius:RADIUS.input},voice:{padding:SPACE.sm},field:{flex:1,fontSize:16,paddingHorizontal:SPACE.sm}});
