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
import { Send, Mic, MicOff, Database, Eye, Heart, Sparkles, Target, Moon } from 'lucide-react-native';
const { height } = Dimensions.get('window');
const NET = { ar: 'يحتاج هذا إلى اتصال. ما زلت هنا لكل شيء آخر.', en: 'This needs a connection. I am still here for everything else.' };
const SRV = { ar: 'أنا هنا. أصغي إليك.', en: 'I am here. I listen.' };
const WINGS = [
  { key: 'memory', label: 'الذاكرة', Icon: Database },
  { key: 'perception', label: 'الإدراك', Icon: Eye },
  { key: 'emotion', label: 'المشاعر', Icon: Heart },
  { key: 'intuition', label: 'الحدس', Icon: Sparkles },
  { key: 'goals', label: 'الأهداف', Icon: Target },
  { key: 'dreams', label: 'الأحلام', Icon: Moon },
];
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
  const [wing, setWing] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const emoT = useRef<any>(null); const wingT = useRef<any>(null);
  const feel = useCallback((e: EntityEmotion, ms = 2600) => { setEmotion(e); if (emoT.current) clearTimeout(emoT.current); emoT.current = setTimeout(() => setEmotion('neutral'), ms); }, []);
  const light = useCallback((w: string, ms = 2600) => { setWing(w); if (wingT.current) clearTimeout(wingT.current); wingT.current = setTimeout(() => setWing(null), ms); }, []);
  useEffect(() => {
    if (userId) {
      setUserId(userId);
      bootstrapCoordinator.bootstrap().catch(() => {});
      try { voiceEngine.start(); } catch {}
      light('perception', 3000);
    }
    const onMem = () => light('memory');
    const onMile = () => light('goals');
    EventBus.on('MEMORY_SURFACED', onMem);
    EventBus.on('MILESTONE_REACHED', onMile);
    return () => { try { voiceEngine.stop(); } catch {} };
  }, [userId, setUserId]);
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isThinking) return;
    const text = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text }]);
    setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'twin', text: '' }]);
    EventBus.emit('USER_SEND_MESSAGE', {});
    setEmotion('thinking'); light('intuition');
    try {
      const response: any = await sendMessage(text);
      const silence = Number(response?.silence_ms || 0);
      if (silence > 0) await new Promise(r => setTimeout(r, Math.min(silence, 3500)));
      if (response) stateBus.updateFromUnifiedResponse(response);
      setOnline(true);
      feel(mapEmotion(response));
      if (response?.memory_surfaced) { EventBus.emit('MEMORY_SURFACED', {}); light('memory'); }
      light('emotion');
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], text: response?.reply || SRV[lang as 'ar'] }; return u; });
    } catch {
      setOnline(false);
      feel('concern');
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], text: NET[lang as 'ar'] }; return u; });
    }
  }, [inputText, isThinking, sendMessage, feel, light, lang]);
  const toggleListening = async () => {
    if (isListening) { voiceEngine.stopListening(); setIsListening(false); }
    else { try { await voiceEngine.startListening(); setIsListening(true); } catch {} }
  };
  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.entityWrapper}><LivingEntity radius={52} height={height * 0.34} emotion={emotion} /></View>
      <View style={styles.wingsRow}>
        {WINGS.map(w => (
          <View key={w.key} style={[styles.wing, wing === w.key && { backgroundColor: colors.accent + '22', borderColor: colors.accent }]}>
            <w.Icon size={15} stroke={wing === w.key ? colors.accent : colors.textSecondary} />
            <Text style={[styles.wingText, { color: wing === w.key ? colors.accent : colors.textSecondary }]}>{rtl.isRTL ? w.label : w.key}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.status, { color: colors.textSecondary }]}>
        {rtl.isRTL ? `١٤ محركًا حيًا • ${online ? 'متصل' : 'دون اتصال'}` : `14 living engines • ${online ? 'online' : 'offline'}`}
      </Text>
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
  entityWrapper: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.36 },
  wingsRow: { position: 'absolute', top: height * 0.345, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6, flexWrap: 'wrap', paddingHorizontal: 12 },
  wing: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: 'transparent' },
  wingText: { fontSize: 11 },
  status: { position: 'absolute', top: height * 0.345 + 44, alignSelf: 'center', fontSize: 10, opacity: 0.7 },
  conversationContainer: { flex: 1, marginTop: height * 0.345 + 62, paddingHorizontal: 20 },
  bubble: { maxWidth: '80%', padding: 14, borderRadius: 20, marginBottom: 8 },
  userBubble: { alignSelf: 'flex-end' },
  twinBubble: { alignSelf: 'flex-start' },
  msgText: { fontSize: 16 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 8, marginHorizontal: 14, marginBottom: 32, borderRadius: 24 },
  voiceBtn: { padding: 8 },
  input: { flex: 1, fontSize: 16, paddingHorizontal: 8 },
});
