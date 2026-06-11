import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Modal, Animated, Alert, StatusBar,
  Image, ActivityIndicator, Pressable, Dimensions, Share
} from 'react-native';
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Localization from 'expo-localization';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import { useTwinStore, ChatMessage } from '../store/useTwinStore';
import { sendChatFromStore, updateStoreFromResponse } from '../lib/api';
import SideMenu from '../components/SideMenu';
import TypingIndicator from '../components/TypingIndicator';
import {
  Menu, Send, X, Volume2, VolumeX, RotateCcw, Copy, Share2,
  Camera, Image as ImageIcon, FileText, Search, Dumbbell, Moon, Brain
} from 'lucide-react-native';
import { speakResponse } from '../utils/voice_engine';
import Markdown from 'react-native-markdown-display';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const APP_ICON = require('../assets/icon.png');

// ─ـ ألوان الثيم ────────────────────────────────────
const COLORS = {
  light: {
    bg: '#FFFFFF', headerBg: '#FFFFFF', border: '#F0F0F0', text: '#1A1A1A',
    subtext: '#666', bubbleUser: '#6B21A8', userText: '#FFF',
    inputBg: '#F8F8F8', inputBorder: '#EFEFEF', sendActive: '#6B21A8',
    sendInactive: '#E0D9F5', addBtnBg: '#F3F0FF', addBtnBorder: '#E0D9F5',
    retryColor: '#EF4444', memoryBadgeBg: '#F3F0FF', memoryBadgeText: '#6B21A8',
    emotionalTagBg: '#FFF3CD', emotionalTagText: '#856404',
  },
  dark: {
    bg: '#1A1A1A', headerBg: '#1A1A1A', border: '#333', text: '#FFF',
    subtext: '#999', bubbleUser: '#6B21A8', userText: '#FFF',
    inputBg: '#333', inputBorder: '#555', sendActive: '#6B21A8',
    sendInactive: '#3A3A3A', addBtnBg: '#2A2A2A', addBtnBorder: '#444',
    retryColor: '#EF4444', memoryBadgeBg: '#2A2A2A', memoryBadgeText: '#D8B4FE',
    emotionalTagBg: '#3A2A1A', emotionalTagText: '#FFD700',
  },
};

// ─ـ مكون Markdown ─────────────────────────────────
const MarkdownRenderer = memo(({ content, isDark }: { content: string; isDark: boolean }) => {
  const markdownStyles = {
    body: { color: isDark ? '#FFF' : '#1A1A1A', fontSize: 15, lineHeight: 24 },
    heading1: { fontSize: 20, fontWeight: '700', marginBottom: 8, color: isDark ? '#FFF' : '#1A1A1A' },
    heading2: { fontSize: 18, fontWeight: '700', marginBottom: 6, color: isDark ? '#FFF' : '#1A1A1A' },
    heading3: { fontSize: 16, fontWeight: '600', marginBottom: 4, color: isDark ? '#FFF' : '#1A1A1A' },
    list_item: { marginBottom: 4 },
    bullet_list: { marginBottom: 8 },
    ordered_list: { marginBottom: 8 },
    table: { marginBottom: 8, borderWidth: 1, borderColor: isDark ? '#444' : '#E0E0E0' },
    th: { padding: 6, backgroundColor: isDark ? '#333' : '#F5F5F5', fontWeight: '700' },
    td: { padding: 6, borderTopWidth: 1, borderColor: isDark ? '#444' : '#E0E0E0' },
    code_inline: { backgroundColor: isDark ? '#333' : '#F0F0F0', color: isDark ? '#FFF' : '#333', paddingHorizontal: 6, borderRadius: 4 },
    code_block: { backgroundColor: isDark ? '#222' : '#F0F0F0', padding: 10, borderRadius: 8, marginBottom: 8 },
    blockquote: { borderLeftWidth: 3, borderLeftColor: '#6B21A8', paddingLeft: 10, marginBottom: 8, backgroundColor: isDark ? '#2A2A2A' : '#F9F9F9' },
    strong: { fontWeight: '700' },
    em: { fontStyle: 'italic' },
    link: { color: '#6B21A8' },
  };
  return <Markdown style={markdownStyles}>{content}</Markdown>;
});

// ─ـ فقاعة المستخدم ─────────────────────────────────
const UserBubble = memo(({ item, isDark }: { item: ChatMessage; isDark: boolean }) => (
  <View style={styles.userRow}>
    <View style={[styles.bubble, styles.userBubble, { backgroundColor: isDark ? COLORS.dark.bubbleUser : COLORS.light.bubbleUser }]}>
      {item.image && <Image source={{ uri: item.image?.startsWith('data:') ? item.image : `data:image/jpeg;base64,${item.image}` }} style={styles.chatImage} />}
      <Text style={styles.userText}>{item.content}</Text>
      <Text style={[styles.timestamp, { color: isDark ? '#CCC' : '#EEE' }]}>
        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  </View>
));

// ─ـ فقاعة التوأم (مع Markdown، بطاقات المشاعر والذاكرة) ──
const TwinBubble = memo(({ item, isLast, pulseAnim, isDark, onCopy, onRetry, onRegenerate }: {
  item: ChatMessage; isLast: boolean; pulseAnim: Animated.Value; isDark: boolean;
  onCopy: (text: string) => void; onRetry: (msg: ChatMessage) => void;
  onRegenerate: (msg: ChatMessage) => void;
}) => {
  const emotionEmoji: Record<string, string> = {
    joy: '😊', sadness: '😢', anger: '😠', fear: '😨', love: '❤️', surprise: '😮', neutral: '😌'
  };

  return (
    <View style={styles.twinRow}>
      <Animated.View style={{ transform: [{ scale: isLast ? pulseAnim : 1 }] }}>
        <Image source={APP_ICON} style={styles.avatar} />
      </Animated.View>
      <View style={styles.twinContent}>
        {/* بطاقة Memory Recall */}
        {item.memoryRecall && (
          <View style={[styles.memoryBadge, { backgroundColor: isDark ? COLORS.dark.memoryBadgeBg : COLORS.light.memoryBadgeBg }]}>
            <Brain size={14} stroke={isDark ? COLORS.dark.memoryBadgeText : COLORS.light.memoryBadgeText} />
            <Text style={[styles.memoryBadgeText, { color: isDark ? COLORS.dark.memoryBadgeText : COLORS.light.memoryBadgeText }]}>Memory Recall</Text>
          </View>
        )}
        {/* بطاقة المشاعر */}
        {item.emotion && (
          <View style={[styles.emotionTag, { backgroundColor: isDark ? COLORS.dark.emotionalTagBg : COLORS.light.emotionalTagBg }]}>
            <Text style={[styles.emotionTagText, { color: isDark ? COLORS.dark.emotionalTagText : COLORS.light.emotionalTagText }]}>
              {emotionEmoji[item.emotion] || '😌'} {item.emotion}
            </Text>
          </View>
        )}
        <MarkdownRenderer content={item.content} isDark={isDark} />
        {/* أزرار الإجراءات */}
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={() => onCopy(item.content)} style={styles.actionBtn}>
            <Copy size={16} stroke={isDark ? '#999' : '#666'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Share.share({ message: item.content })} style={styles.actionBtn}>
            <Share2 size={16} stroke={isDark ? '#999' : '#666'} />
          </TouchableOpacity>
          {isLast && (
            <TouchableOpacity onPress={() => onRegenerate(item)} style={styles.actionBtn}>
              <RotateCcw size={16} stroke={isDark ? '#999' : '#666'} />
            </TouchableOpacity>
          )}
          <Text style={[styles.timestamp, { color: isDark ? '#999' : '#666', marginLeft: 4 }]}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {item.failed && (
          <TouchableOpacity onPress={() => onRetry(item)} style={styles.retryBtn}>
            <RotateCcw size={14} stroke="#EF4444" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

export default function Chat() {
  const insets = useSafeAreaInsets();
  const {
    userId, twinName, twinGender, tier, chatHistory, addMessage, updateBond,
    updateRelationshipDims, calmMode, triggerHaptic, lang, theme, setTwinName,
    setTwinGender, openMenu, closeMenu, voiceEnabled, setVoiceEnabled,
    setEnergy, bondLevel, relationshipDims, journeyPhase, attachmentStyle,
    twinStyle, replyStyle, setThinking, setThinkingStage
  } = useTwinStore((s) => ({
    userId: s.userId, twinName: s.twinName, twinGender: s.twinGender, tier: s.tier,
    chatHistory: s.chatHistory, addMessage: s.addMessage, updateBond: s.updateBond,
    updateRelationshipDims: s.updateRelationshipDims, calmMode: s.calmMode,
    triggerHaptic: s.triggerHaptic, lang: s.lang, theme: s.theme,
    setTwinName: s.setTwinName, setTwinGender: s.setTwinGender,
    openMenu: s.openMenu, closeMenu: s.closeMenu,
    voiceEnabled: s.voiceEnabled, setVoiceEnabled: s.setVoiceEnabled,
    setEnergy: s.setEnergy, bondLevel: s.bondLevel, relationshipDims: s.relationshipDims,
    journeyPhase: s.journeyPhase, attachmentStyle: s.attachmentStyle,
    twinStyle: s.twinStyle, replyStyle: s.replyStyle,
    setThinking: s.setThinking, setThinkingStage: s.setThinkingStage,
  }));

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [featureModal, setFeatureModal] = useState<{ visible: boolean; type: string }>({ visible: false, type: '' });
  const [featureInput, setFeatureInput] = useState('');
  const [messageQueue, setMessageQueue] = useState<Array<{ msg?: string; image?: string }>>([]);

  const flatRef = useRef<FlatList<ChatMessage>>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const attachAnim = useRef(new Animated.Value(0)).current;
  const abortRef = useRef<AbortController | null>(null);

  const colors = theme === 'dark' ? COLORS.dark : COLORS.light;
  const isRTL = lang === 'ar';
  const isDark = theme === 'dark';
  const isFree = tier === 'free';

  // ─ـ المؤثرات ────────────────────────────────────
  useEffect(() => {
    if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1]?.role === 'twin') {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [chatHistory]);

  useEffect(() => {
    (async () => {
      const { data: profile } = await supabase.from('profiles').select('twin_name, twin_gender').eq('id', userId).single();
      if (profile) { if (profile.twin_name) setTwinName(profile.twin_name); if (profile.twin_gender) setTwinGender(profile.twin_gender); }
    })();
  }, [userId]);

  useEffect(() => { const t = setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100); return () => clearTimeout(t); }, [chatHistory]);
  useEffect(() => { Animated.spring(attachAnim, { toValue: showAttach ? 1 : 0, useNativeDriver: true, tension: 65, friction: 11 }).start(); }, [showAttach]);
  useEffect(() => { if (messageQueue.length > 0 && !loading) { const next = messageQueue[0]; setMessageQueue(prev => prev.slice(1)); sendMessage(next.msg, next.image); } }, [messageQueue, loading]);

  const countryCode = (Localization.region || 'SA').toUpperCase();

  // ✅ دالة الإرسال الرئيسية (مُبسَّطة)
  const sendMessage = useCallback(async (msg?: string, imageBase64?: string) => {
    const message = (msg || input).trim();
    if (!message && !imageBase64) return;

    const msgId = Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    addMessage({ id: msgId, role: 'user', content: message || '📷 صورة', image: imageBase64, timestamp: Date.now() });
    setInput('');
    setLoading(true);
    setThinking(true);
    setThinkingStage('thinking');

    try {
      const response = await sendChatFromStore(message, imageBase64);
      // إنشاء كائن الرسالة المُحسَّنة
      const enhancedMsg: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
        role: 'twin',
        content: response.reply,
        timestamp: Date.now(),
        emotion: response.emotion?.primary,
        journeyPhase: response.journey_phase,
        relationshipStage: response.relationship_stage,
        memoryRecall: response.memory_used,
        thinkingStage: response.thinking_stage,
      };
      addMessage(enhancedMsg);
      // تحديث المتجر من الاستجابة
      updateStoreFromResponse(response);
      if (voiceEnabled) {
        try { await speakResponse(response.reply, { pitch: useTwinStore.getState().voicePitch, rate: useTwinStore.getState().voiceSpeed }); } catch {}
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      const status = error?.response?.status;
      addMessage({
        id: Math.random().toString(36).substr(2, 9) + Date.now().toString(36),
        role: 'twin',
        content: status === 401 ? (lang === 'ar' ? 'انتهت جلستك 🔒' : 'Session expired 🔒') : (lang === 'ar' ? 'تعذر الاتصال 😔' : 'Connection failed 😔'),
        timestamp: Date.now(),
        failed: true,
      });
    } finally {
      setLoading(false);
      setThinking(false);
    }
  }, [input, loading, voiceEnabled, lang, addMessage, setThinking, setThinkingStage]);

  const send = useCallback(async (msg?: string, imageBase64?: string) => {
    if (loading) { setMessageQueue(prev => [...prev, { msg, image: imageBase64 }]); return; }
    triggerHaptic(); await sendMessage(msg, imageBase64);
  }, [loading, sendMessage, triggerHaptic]);

  const handleRetry = useCallback((failedMsg: ChatMessage) => { sendMessage(failedMsg.content, failedMsg.image); }, [sendMessage]);
  const handleRegenerate = useCallback((lastMsg: ChatMessage) => { sendMessage(lastMsg.content); }, [sendMessage]);
  const handleCopy = useCallback((content: string) => {
    Clipboard.setStringAsync(content);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);
  const toggleSound = () => setVoiceEnabled(!voiceEnabled);

  const handleCamera = useCallback(async () => {
    setShowAttach(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission', lang === 'ar' ? 'مطلوب إذن الكاميرا' : 'Camera permission needed'); return; }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
    if (!result.canceled && result.assets?.[0]?.base64) send('', result.assets[0].base64);
  }, [send, lang]);

  const handleAttachAction = useCallback(async (action: string) => {
    setShowAttach(false);
    if (action === 'camera') { handleCamera(); return; }
    if (action === 'image') {
      const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!p.granted) { Alert.alert('Permission', lang === 'ar' ? 'مطلوب إذن الصور' : 'Permission needed'); return; }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true });
      if (!r.canceled && r.assets?.[0]?.base64) send('', r.assets[0].base64);
    } else if (action === 'file') {
      try { const res = await DocumentPicker.getDocumentAsync({ type: '*/*' }); if (!res.canceled && res.assets?.[0]) send('📄 ' + (res.assets[0].name || 'ملف مرفق')); } catch { Alert.alert('خطأ', lang === 'ar' ? 'فشل اختيار الملف' : 'File selection failed'); }
    } else if (action === 'coach' || action === 'dream') {
      if (isFree) { Alert.alert(lang === 'ar' ? 'ترقية' : 'Upgrade', lang === 'ar' ? 'الميزة حصرية للباقات المدفوعة' : 'Feature exclusive to paid plans'); return; }
      setFeatureModal({ visible: true, type: action }); setFeatureInput('');
    } else if (action === 'search') { setFeatureModal({ visible: true, type: 'search' }); setFeatureInput(''); }
  }, [send, lang, handleCamera, isFree]);

  const handleFeatureSend = () => {
    const prompts: Record<string, string> = {
      search: '/search ', coach: lang === 'ar' ? 'أريد جلسة تدريب: ' : 'Coaching session: ',
      dream: lang === 'ar' ? 'أريد تحليل حلمي: ' : 'Dream analysis: ',
    };
    send(prompts[featureModal.type] + featureInput); setFeatureModal({ visible: false, type: '' }); setFeatureInput('');
  };

  const attachItems = [
    { icon: Camera, label_ar: 'كاميرا', label_en: 'Camera', action: 'camera', color: '#8B5CF6' },
    { icon: ImageIcon, label_ar: 'معرض الصور', label_en: 'Gallery', action: 'image', color: '#EC4899' },
    { icon: FileText, label_ar: 'ملف', label_en: 'File', action: 'file', color: '#F59E0B' },
    { icon: Search, label_ar: 'بحث', label_en: 'Search', action: 'search', color: '#10B981' },
    { icon: Dumbbell, label_ar: 'جلسة تدريب', label_en: 'Coaching', action: 'coach', color: '#3B82F6' },
    { icon: Moon, label_ar: 'تفسير حلم', label_en: 'Dream Analysis', action: 'dream', color: '#6366F1' },
  ];

  const renderMsg = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const isLast = index === chatHistory.length - 1;
    if (item.role === 'user') {
      return <UserBubble item={item} isDark={isDark} />;
    }
    return (
      <TwinBubble
        item={item}
        isLast={isLast}
        pulseAnim={pulseAnim}
        isDark={isDark}
        onCopy={handleCopy}
        onRetry={handleRetry}
        onRegenerate={handleRegenerate}
      />
    );
  }, [chatHistory.length, isDark, handleCopy, handleRetry, handleRegenerate]);

  const ListFooter = useCallback(() => {
    if (!loading) return null;
    return (
      <View style={styles.typingRow}>
        <Image source={APP_ICON} style={{ width: 28, height: 28, borderRadius: 14 }} />
        <TypingIndicator />
      </View>
    );
  }, [loading]);

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={openMenu} style={styles.menuBtn}><Menu size={22} stroke={colors.text} /></TouchableOpacity>
          <View style={styles.headerCenter}><Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>{twinName || (lang === 'ar' ? 'توأمك' : 'Your Twin')}</Text></View>
          <TouchableOpacity onPress={toggleSound} style={styles.soundBtn}>{voiceEnabled ? <Volume2 size={22} stroke={colors.text} /> : <VolumeX size={22} stroke={colors.subtext} />}</TouchableOpacity>
        </View>

        {/* Chat List */}
        <FlatList
          ref={flatRef}
          data={chatHistory}
          keyExtractor={(item) => item.id}
          renderItem={renderMsg}
          ListFooterComponent={ListFooter}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          keyboardDismissMode="interactive"
        />

        {/* Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: colors.headerBg, borderTopColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowAttach(true)} style={[styles.addBtn, { backgroundColor: colors.addBtnBg, borderColor: colors.addBtnBorder }]}>
            <Text style={[styles.addBtnText, { color: colors.sendActive }]}>+</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.textInput, isRTL && { textAlign: 'right' }, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
            value={input} onChangeText={setInput}
            placeholder={lang === 'ar' ? 'اكتب رسالتك... 💜' : 'Type your message... 💜'}
            placeholderTextColor={colors.subtext} multiline maxLength={2000} editable={!loading}
            onSubmitEditing={() => send()}
          />
          <TouchableOpacity
            onPress={() => send()}
            disabled={loading || (input.trim().length === 0 && !loading)}
            style={[styles.sendBtn, { backgroundColor: (input.trim().length > 0 && !loading) ? colors.sendActive : colors.sendInactive }]}
          >
            {loading ? <ActivityIndicator size="small" color={colors.subtext} /> : <Image source={APP_ICON} style={{ width: 24, height: 24, borderRadius: 12 }} />}
          </TouchableOpacity>
        </View>
        {/* Attach Menu Modal */}
        <Modal visible={showAttach} transparent animationType="none" onRequestClose={() => setShowAttach(false)}>
          <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setShowAttach(false)}>
            <Animated.View style={[styles.attachContainer, { backgroundColor: isDark ? '#2A2A2A' : '#FFF', transform: [{ translateY: attachAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }]}>
              <View style={styles.attachHeader}><Text style={[styles.attachTitle, { color: colors.text }]}>{lang === 'ar' ? 'إرفاق' : 'Attach'}</Text><TouchableOpacity onPress={() => setShowAttach(false)}><X size={22} stroke={colors.subtext} /></TouchableOpacity></View>
              <View style={styles.attachGrid}>
                {attachItems.map((item, idx) => (
                  <TouchableOpacity key={idx} style={styles.attachItem} onPress={() => handleAttachAction(item.action)}>
                    <View style={[styles.attachIconWrap, { backgroundColor: item.color + '20' }]}><item.icon size={26} stroke={item.color} /></View>
                    <Text style={[styles.attachLabel, { color: colors.text }]}>{lang === 'ar' ? item.label_ar : item.label_en}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Modal>

        {/* Feature Modal */}
        <Modal visible={featureModal.visible} transparent animationType="fade" onRequestClose={() => setFeatureModal({ visible: false, type: '' })}>
          <View style={styles.featureOverlay}>
            <View style={[styles.featureContainer, { backgroundColor: isDark ? '#2A2A2A' : '#FFF' }]}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>{featureModal.type === 'search' ? (lang === 'ar' ? 'بحث' : 'Search') : featureModal.type === 'coach' ? (lang === 'ar' ? 'جلسة تدريب' : 'Coaching') : (lang === 'ar' ? 'تفسير حلم' : 'Dream Analysis')}</Text>
              <TextInput style={[styles.featureInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]} placeholder={lang === 'ar' ? 'اكتب طلبك هنا...' : 'Type your request...'} placeholderTextColor={colors.subtext} value={featureInput} onChangeText={setFeatureInput} multiline autoFocus />
              <View style={styles.featureActions}>
                <TouchableOpacity style={styles.featureCancelBtn} onPress={() => setFeatureModal({ visible: false, type: '' })}><Text style={{ color: colors.subtext, fontWeight: '600' }}>{lang === 'ar' ? 'إلغاء' : 'Cancel'}</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.featureSendBtn, { backgroundColor: colors.sendActive }]} onPress={handleFeatureSend}><Send size={16} stroke="#FFF" /><Text style={styles.featureSendText}>{lang === 'ar' ? 'إرسال' : 'Send'}</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  menuBtn: { padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerName: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  soundBtn: { padding: 4 },
  listContent: { paddingHorizontal: 12, paddingVertical: 12, flexGrow: 1 },
  typingRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingVertical: 8, gap: 8 },
  userRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
  twinRow: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 10, gap: 6 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  twinContent: { flex: 1 },
  bubble: { maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  userBubble: { borderBottomRightRadius: 4 },
  userText: { color: '#FFF', fontSize: 15, lineHeight: 22 },
  chatImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 6 },
  timestamp: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  retryText: { color: '#EF4444', fontSize: 12 },
  memoryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 6 },
  memoryBadgeText: { fontSize: 11, fontWeight: '600' },
  emotionTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginBottom: 6, alignSelf: 'flex-start' },
  emotionTagText: { fontSize: 11, fontWeight: '600' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  actionBtn: { padding: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 8, borderTopWidth: 1, gap: 8 },
  addBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  addBtnText: { fontSize: 18, fontWeight: '700' },
  textInput: { flex: 1, backgroundColor: '#F8F8F8', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, fontSize: 15, maxHeight: 100, minHeight: 44, borderWidth: 1 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  attachOverlay: { flex: 1, justifyContent: 'flex-end' },
  attachContainer: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 30 },
  attachHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  attachTitle: { fontSize: 18, fontWeight: '700' },
  attachGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  attachItem: { width: (SCREEN_WIDTH - 60) / 3, alignItems: 'center', paddingVertical: 14, borderRadius: 14 },
  attachIconWrap: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  attachLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  featureOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  featureContainer: { width: '88%', borderRadius: 20, padding: 20 },
  featureTitle: { fontSize: 18, fontWeight: '700', marginBottom: 14 },
  featureInput: { borderRadius: 14, padding: 14, fontSize: 15, minHeight: 80, textAlignVertical: 'top', marginBottom: 14, borderWidth: 1 },
  featureActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  featureCancelBtn: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  featureSendBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10 },
  featureSendText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
});
