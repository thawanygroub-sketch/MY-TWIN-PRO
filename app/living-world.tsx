import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useTwinBrain } from '../src/hooks/useTwinBrain';
import { useRTL } from '../lib/useRTL';
import { useAppTheme } from '../engine/colors';
import { useTwinStore } from '../store/useTwinStore';
import { bootstrapCoordinator } from '../src/core/BootstrapCoordinator';
import { audioMixer } from '../src/core/AudioMixer';
import { EventBus } from '../src/core/EventBus';
import { stateBus } from '../src/core/StateBus';
import { voiceEngine } from '../engine/voice/VoiceEngine';
import { LivingEntity, EntityEmotion } from '../src/components/LivingEntity';
import { Send, Mic, MicOff } from 'lucide-react-native';
const { height } = Dimensions.get('window');
const NET = { ar: 'يحتاج هذا إلى اتصال. ما زلت هنا لكل شيء آخر.', en: 'This needs a connection. I am still here for everything else.' };
const SRV = { ar: 'أنا هنا. أصغي إليك.', en: 'I am here. I listen.' };
const mapEmotion = (r: any): EntityEmotion => {
  const em = String(r?.twin_emotional_state?.current_emotion || '').toLowerCase();
  if ((r?.expression_intent?.smile || 0) > 0.4) return 'love';
  if (em.includes('joy') || em.includes('excit')) return 'joy';
  if (em.includes('concern') || em.includes('sad')) return 'concern';
  if (em.includes('curious')) return 'thinking';
  if (em.includes('surpr')) return 'surprise';
  return 'neutral';
};
export default function LivingWorld() {
  const userId = useTwinStore(s => s.userId) || '';
  const { colors } = useAppTheme();
  const { isThinking, sendMessage, setUserId } = useTwinBrain();
  const rtl = useRTL();
  const lang = rtl.isRTL ? 'ar' : 'en';
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Array<{ id: string; sender: 'user' | 'twin'; text: string }>>([]);
  const [isListening, setIsListening] = useState(false);
  const [emotion, setEmotion] = useState<EntityEmotion>('neutral');
  const emoT = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (userId) {
      setUserId(userId);
      bootstrapCoordinator.bootstrap().catch(() => {});
      try { voiceEngine.start(); } catch {}
    }
    return () => { try { voiceEngine.stop(); } catch {} };
  }, [userId, setUserId]);
  const feel = useCallback((e: EntityEmotion, ms = 2600) => {
    setEmotion(e);
    if (emoT.current) clearTimeout(emoT.current);
    emoT.current = setTimeout(() => setEmotion('neutral'), ms);
  }, []);
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isThinking) return;
    const text = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text }]);
    setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'twin', text: '' }]);
    EventBus.emit('USER_SEND_MESSAGE', {});
    EventBus.emit('AI_START_THINKING', {});
    setEmotion('thinking');
    try {
      const response: any = await sendMessage(text);
      const silence = Number(response?.silence_ms || 0);
      if (silence > 0) await new Promise(r => setTimeout(r, Math.min(silence, 3500)));
      if (response) stateBus.updateFromUnifiedResponse(response);
      EventBus.emit('AI_FINISH_THINKING', {});
      feel(mapEmotion(response));
      if (response?.memory_surfaced) EventBus.emit('MEMORY_SURFACED', {});
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], text: response?.reply || SRV[lang as 'ar'] }; return u; });
    } catch {
      EventBus.emit('AI_FINISH_THINKING', {});
      feel('concern');
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], text: NET[lang as 'ar'] }; return u; });
    }
  }, [inputText, isThinking, sendMessage, feel, lang]);
  const toggleListening = async () => {
    if (isListening) { voiceEngine.stopListening(); setIsListening(false); }
    else { try { await voiceEngine.startListening(); setIsListening(true); } catch {} }
  };
  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.entityWrapper}><LivingEntity radius={56} height={height * 0.42} emotion={emotion} /></View>
      <ScrollView style={styles.conversationContainer} contentContainerStyle={{ paddingBottom: 110 }}>
        {messages.map(msg => (
          <View key={msg.id} style={[styles.bubble, msg.sender === 'user' ? styles.userBubble : styles.twinBubble, { backgroundColor: msg.sender === 'user' ? colors.accent + '20' : colors.card }]}>
            <Text style={[styles.msgText, { color: colors.text }]}>{msg.text}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={toggleListening} style={styles.voiceBtn}>
          {isListening ? <MicOff size={22} stroke={colors.accent} /> : <Mic size={22} stroke={colors.textSecondary} />}
        </TouchableOpacity>
        <TextInput style={[styles.input, { textAlign: rtl.textAlign, color: colors.text }]} value={inputText} onChangeText={setInputText} onSubmitEditing={handleSend} editable={!isThinking} placeholder={rtl.isRTL ? 'اكتب رسالتك...' : 'Write your message...'} placeholderTextColor={colors.textSecondary} />
        <TouchableOpacity onPress={handleSend} disabled={isThinking}><Send size={22} stroke={isThinking ? colors.textSecondary : colors.accent} /></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  entityWrapper: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.45 },
  conversationContainer: { flex: 1, marginTop: height * 0.42, paddingHorizontal: 20 },
  bubble: { maxWidth: '80%', padding: 14, borderRadius: 20, marginBottom: 8 },
  userBubble: { alignSelf: 'flex-end' },
  twinBubble: { alignSelf: 'flex-start' },
  msgText: { fontSize: 16 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 8, marginHorizontal: 14, marginBottom: 32, borderRadius: 24 },
  voiceBtn: { padding: 8 },
  input: { flex: 1, fontSize: 16, paddingHorizontal: 8 },
});
