import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useTwinBrain } from '../src/hooks/useTwinBrain';
import { useRTL } from '../lib/useRTL';
import { useAppTheme } from '../engine/colors';
import { useTwinStore } from '../store/useTwinStore';
import { bootstrapCoordinator } from '../src/core/BootstrapCoordinator';
import { audioMixer } from '../src/core/AudioMixer';
import { EventBus } from '../src/core/EventBus';
import { voiceEngine } from '../engine/voice/VoiceEngine';
import { devicePresenceEngine } from '../engine/device/DevicePresenceEngine';
import AmbientField from '../src/world/AmbientField';
import { ConsciousBeing } from '../src/components/conscious/ConsciousBeing';
import { SPACE, RADIUS } from '../src/design/tokens/spacing';
import { Send, Mic, MicOff } from 'lucide-react-native';
const { height } = Dimensions.get('window');
const LIVING = { NETWORK: 'يحتاج هذا إلى اتصال. ما زلت هنا لكل شيء آخر.', SERVER: 'أنا هنا. قد أكون محدودًا قليلًا الآن، لكنني أصغي.' };
export default function LivingWorld() {
  const userId = useTwinStore(s => s.userId) || '';
  const { colors } = useAppTheme();
  const { isThinking, streamedText, sendMessage, setUserId } = useTwinBrain();
  const rtl = useRTL();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Array<{ id: string; sender: 'user' | 'twin'; text: string }>>([]);
  const [isListening, setIsListening] = useState(false);
  const wasNear = useRef(false);
  useEffect(() => {
    if (userId) { setUserId(userId); bootstrapCoordinator.bootstrap(); try { voiceEngine.start(); } catch {} }
    return () => { try { voiceEngine.stop(); } catch {} };
  }, [userId, setUserId]);
  useEffect(() => {
    const iv = setInterval(() => {
      try {
        const s = devicePresenceEngine.getSensors();
        const near = !!(s.faceDetected && (s.proximity || 100) < 50);
        if (near && !wasNear.current) audioMixer.playEffect('camera_look');
        if (!near && wasNear.current) audioMixer.playEffect('proximity_far');
        wasNear.current = near;
      } catch {}
    }, 4000);
    return () => clearInterval(iv);
  }, []);
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isThinking) return;
    const text = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text }]);
    const twinMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: twinMsgId, sender: 'twin', text: '' }]);
    EventBus.emit('USER_SEND_MESSAGE', {});
    try {
      const response = await sendMessage(text);
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], text: response?.reply || LIVING.SERVER }; return u; });
    } catch {
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], text: LIVING.NETWORK }; return u; });
    }
  }, [inputText, isThinking, sendMessage]);
  const toggleListening = async () => {
    if (isListening) { voiceEngine.stopListening(); setIsListening(false); }
    else { try { await voiceEngine.startListening(); setIsListening(true); } catch {} }
  };
  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <AmbientField />
      <View style={styles.entityWrapper}><ConsciousBeing /></View>
      <ScrollView style={styles.conversationContainer} contentContainerStyle={{ paddingBottom: 100 }}>
        {messages.map(msg => (
          <View key={msg.id} style={[styles.messageBubble, msg.sender === 'user' ? styles.userBubble : styles.twinBubble, { backgroundColor: msg.sender === 'user' ? colors.accent + '20' : colors.card }]}>
            <Text style={[styles.messageText, { color: colors.text }]}>{msg.text}</Text>
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
  entityWrapper: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.45, justifyContent: 'center', alignItems: 'center' },
  conversationContainer: { flex: 1, marginTop: height * 0.45, paddingHorizontal: SPACE.lg },
  messageBubble: { maxWidth: '80%', padding: SPACE.md, borderRadius: 20, marginBottom: SPACE.sm },
  userBubble: { alignSelf: 'flex-end' },
  twinBubble: { alignSelf: 'flex-start' },
  messageText: { fontSize: 16 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: SPACE.sm, marginHorizontal: SPACE.md, marginBottom: SPACE.xl, borderRadius: RADIUS.input },
  voiceBtn: { padding: SPACE.sm },
  input: { flex: 1, fontSize: 16, paddingHorizontal: SPACE.sm },
});
