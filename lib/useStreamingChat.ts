/** useStreamingChat v2 — الجسد يعيش ما يقوله العقل.
 * صمت دستوري قبل النص، Envelope يغذي StateBus، أوفلاين كريم،
 * ولا تعديل محلي للطاقة/الرابطة (الخادم هو الحقيقة). */
import { useState, useRef, useCallback } from 'react';
import { apiPost } from './httpClient';
import { stateBus } from '../src/core/StateBus';
import { livingError } from './livingErrors';
import { getNetworkStatus, addToOfflineQueue, getCachedResponse, cacheResponse } from './offlineService';
import { useConversationStore } from '../store/useConversationStore';
import { useTwinStore } from '../store/useTwinStore';
export function useStreamingChat(){
  const [state,setState]=useState({isStreaming:false,error:null as string|null});
  const abortRef=useRef<AbortController|null>(null);
  const { addMessage, setStreamingText, setThinking, setThinkingStage } = useTwinStore();
  const sendStreamingMessage=useCallback(async (message:string, image?:string)=>{
    if(abortRef.current) abortRef.current.abort();
    const c=new AbortController(); abortRef.current=c;
    setState({isStreaming:true,error:null}); setThinking(true); setThinkingStage('thinking');
    const uid=`msg_${Date.now().toString(36)}_user`;
    addMessage({id:uid,role:'user',content:message,timestamp:Date.now(),image});
    const tid=`msg_${Date.now().toString(36)}_twin`;
    addMessage({id:tid,role:'twin',content:'',timestamp:Date.now(),thinkingStage:'thinking'});
    const finalize=(text:string,failed=false)=>{ useConversationStore.setState((s:any)=>({chatHistory:s.chatHistory.map((m:any)=>m.id===tid?{...m,content:text,failed,thinkingStage:'complete'}:m)})); setThinking(false); setThinkingStage('complete'); setStreamingText(''); setState({isStreaming:false,error:null}); };
    if(!getNetworkStatus()){ const t=await getCachedResponse(message)||'يحتاج هذا إلى اتصال. ما زلت هنا لكل شيء آخر.'; await addToOfflineQueue(message); finalize(t); return t; }
    let acc=''; setStreamingText(''); setThinkingStage('generating');
    try{
      const cs=useConversationStore.getState();
      const res=await apiPost('/api/chat',{ message, history:(cs.chatHistory||[]).slice(-10).map((h:any)=>({role:h.role,content:h.content})), lang:'ar' });
      const full=res?.reply||'';
      const silence=Number(res?.silence_ms||0);
      if(silence>0) await new Promise(r=>setTimeout(r,Math.min(silence,3500)));
      stateBus.updateFromUnifiedResponse(res);
      for(let i=0;i<full.length;i+=3){ acc=full.substring(0,i+3); setStreamingText(acc); await new Promise(r=>setTimeout(r,10)); }
      await cacheResponse(message,full);
      finalize(full); return full;
    }catch(e:any){
      if(e?.name==='AbortError'){ setState({isStreaming:false,error:null}); return ''; }
      await addToOfflineQueue(message); finalize(livingError(e),true); return '';
    }
  },[addMessage,setStreamingText,setThinking,setThinkingStage]);
  const cancelStream=useCallback(()=>{ if(abortRef.current){abortRef.current.abort();abortRef.current=null;} setState({isStreaming:false,error:null}); setThinking(false); setStreamingText(''); },[setThinking,setStreamingText]);
  return { sendStreamingMessage, cancelStream, isStreaming:state.isStreaming, error:state.error };
}
