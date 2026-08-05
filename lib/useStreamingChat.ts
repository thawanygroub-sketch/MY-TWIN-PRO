import { useState, useRef, useCallback } from 'react';
import { apiPost } from './httpClient';
import { stateBus } from '../src/core/StateBus';
import { EventBus } from '../src/core/EventBus';
import { getNetworkStatus, getCachedResponse, addToOfflineQueue, cacheResponse } from './offlineService';
import { useTwinStore } from '../store/useTwinStore';
import { useTwinCoreStore } from '../store/useTwinCoreStore';
import { useConversationStore } from '../store/useConversationStore';
const LIVING = { TIMEOUT: 'أفكر أبطأ قليلًا من المعتاد. لحظة واحدة.', NETWORK: 'يحتاج هذا إلى اتصال. ما زلت هنا لكل شيء آخر.', SERVER: 'أنا هنا. قد أكون محدودًا قليلًا الآن، لكنني أصغي.' };
export function useStreamingChat() {
  const [state, setState] = useState({ isStreaming: false, error: null as string | null });
  const abortRef = useRef<AbortController | null>(null);
  const { addMessage, setStreamingText, setThinking, setThinkingStage, updateBond, setTwinEnergy } = useTwinStore();
  const sendStreamingMessage = useCallback(async (message: string, image?: string) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController(); abortRef.current = controller;
    setState({ isStreaming: true, error: null });
    setThinking(true); setThinkingStage('thinking');
    const userMsgId = `msg_${Date.now().toString(36)}_user`;
    addMessage({ id: userMsgId, role: 'user', content: message, timestamp: Date.now(), image });
    const twinMsgId = `msg_${Date.now().toString(36)}_twin`;
    addMessage({ id: twinMsgId, role: 'twin', content: '', timestamp: Date.now(), thinkingStage: 'thinking' });
    const finalize = (text: string, failed = false) => {
      useConversationStore.setState(s => ({ chatHistory: s.chatHistory.map((m: any) => m.id === twinMsgId ? { ...m, content: text, failed, thinkingStage: 'complete' } : m) }));
      setThinking(false); setThinkingStage('complete'); setStreamingText('');
      setState({ isStreaming: false, error: null });
    };
    if (!getNetworkStatus()) {
      const cached = await getCachedResponse(message);
      const text = cached || LIVING.NETWORK;
      await addToOfflineQueue(message);
      finalize(text, !cached);
      return text;
    }
    let acc = ''; setStreamingText(''); setThinkingStage('generating');
    EventBus.emit('USER_SEND_MESSAGE', {});
    EventBus.emit('AI_START_THINKING', {});
    try {
      const coreState = useTwinCoreStore.getState();
      const conversationState = useConversationStore.getState();
      const response = await apiPost('/api/chat', { message, history: conversationState.chatHistory.slice(-10).map((h: any) => ({ role: h.role, content: h.content })), lang: coreState.lang });
      const full = response?.reply || '';
      const silence = Number(response?.silence_ms || 0);
      if (silence > 0) await new Promise(r => setTimeout(r, Math.min(silence, 3500)));
      stateBus.updateFromUnifiedResponse(response);
      if (typeof response?.bond_level === 'number') updateBond(response.bond_level);
      if (typeof response?.energy === 'number') setTwinEnergy(Math.round(response.energy * 100));
      if (response?.memory_surfaced) EventBus.emit('MEMORY_SURFACED', {});
      EventBus.emit('AI_FINISH_THINKING', {});
      for (let i = 0; i < full.length; i += 3) { acc = full.substring(0, i + 3); setStreamingText(acc); await new Promise(r => setTimeout(r, 10)); }
      await cacheResponse(message, full);
      finalize(full);
      return full;
    } catch (error: any) {
      EventBus.emit('AI_FINISH_THINKING', {});
      if (error?.name === 'AbortError') { setState({ isStreaming: false, error: null }); return ''; }
      const msg = String(error?.message || '');
      const living = msg.includes('مهلة') || msg.includes('TIMEOUT') ? LIVING.TIMEOUT : msg.includes('اتصال') || msg.includes('etwork') ? LIVING.NETWORK : LIVING.SERVER;
      await addToOfflineQueue(message);
      finalize(living, true);
      return '';
    }
  }, [addMessage, setStreamingText, setThinking, setThinkingStage, updateBond, setTwinEnergy]);
  const cancelStream = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setState({ isStreaming: false, error: null });
    setThinking(false); setStreamingText('');
  }, [setThinking, setStreamingText]);
  return { sendStreamingMessage, cancelStream, isStreaming: state.isStreaming, error: state.error };
}
