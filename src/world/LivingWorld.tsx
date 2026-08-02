import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useTwinBrain } from '../hooks/useTwinBrain';
import { useRTL } from '../../lib/useRTL';
import { useAppTheme } from '../../engine/colors';
import { useTwinStore } from '../../store/useTwinStore';
import { bootstrapCoordinator } from '../core/BootstrapCoordinator';
import { presenceEngine } from '../../engine/presence/PresenceEngine';
import { audioMixer } from '../core/AudioMixer';
import AmbientField from './AmbientField';
import LivingLightEntity from '../renderers/zones/LivingLightEntity';
import { SPACE, RADIUS } from '../../src/design/tokens/spacing';

export default function LivingWorld() {
  const userId = useTwinStore(s => s.userId) || '';
  const { colors } = useAppTheme();
  const { isThinking, streamedText, streamMessage, setUserId } = useTwinBrain();
  const rtl = useRTL();

  useEffect(() => { if (userId) setUserId(userId); }, [userId, setUserId]);

  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Array<{ id: string; sender: 'user' | 'twin'; text: string }>>([]);

  // 🧬 تشغيل جميع المحركات
  useEffect(() => {
    const init = async () => {
      try {
        await bootstrapCoordinator.bootstrap();
        presenceEngine.startPresenceLoop();
        audioMixer.playEffect('awakening');
      } catch (e) {
        console.warn('[LivingWorld] Bootstrap failed:', e);
      }
    };
    init();
  }, []);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isThinking) return;
    const text = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user' as const, text }]);
    const twinMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: twinMsgId, sender: 'twin', text: '' }]);
    
    // إعلام المحركات بالتفاعل
    
    await streamMessage(text);
  }, [inputText, isThinking, streamMessage]);

  useEffect(() => {
    if (streamedText && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender === 'twin') {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], text: streamedText };
          return updated;
        });
      }
    }
  }, [streamedText, messages]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AmbientField />
      <LivingLightEntity isThinking={isThinking} isSpeaking={streamedText.length > 0} isListening={!isThinking} />

      <View style={styles.conversationContainer}>
        {messages.map(msg => (
          <Text key={msg.id} style={[
            msg.sender === 'user' ? [styles.userMessage, { color: colors.textSecondary }] : [styles.twinMessage, { color: colors.text }],
            { textAlign: msg.sender === 'user' ? rtl.textAlign : (rtl.isRTL ? 'left' : 'right') }
          ]}>{msg.text}</Text>
        ))}
      </View>

      <View style={[styles.inputContainer, { backgroundColor: colors.card }]}>
        <TextInput
          style={[styles.input, { textAlign: rtl.textAlign, color: colors.text }]}
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSend}
          editable={!isThinking}
          placeholder={rtl.isRTL ? 'اكتب رسالتك...' : 'Write your message...'}
          placeholderTextColor={colors.textSecondary}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  conversationContainer: { position: 'absolute', bottom: 280, left: SPACE.lg, right: SPACE.lg, zIndex: 15 },
  userMessage: { fontSize: 18, alignSelf: 'flex-end', marginVertical: SPACE.xs },
  twinMessage: { fontSize: 20, alignSelf: 'flex-start', marginVertical: SPACE.xs },
  inputContainer: { position: 'absolute', bottom: 30, left: SPACE.lg, right: SPACE.lg, padding: SPACE.md, borderRadius: RADIUS.input, zIndex: 20 },
  input: { fontSize: 18 },
});
