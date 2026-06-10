import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Modal, Animated, Alert, StatusBar,
  Image, ActivityIndicator, Dimensions, Pressable
} from 'react-native';
import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Localization from 'expo-localization';
import { supabase } from '../lib/supabase';
import { useTwinStore } from '../store/useTwinStore';
import { API } from '../lib/api';
import SideMenu from '../components/SideMenu';
import TypingIndicator from '../components/TypingIndicator';
import {
  Menu, Send, X, Volume2, VolumeX, RotateCcw,
  Camera, Image as ImageIcon, FileText, Search, Dumbbell, Moon
} from 'lucide-react-native';
import { speakResponse } from '../utils/voice_engine';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TWIN_ICON = require('../assets/icon.png');

const COLORS = {
  light: {
    bg: '#FFFFFF', headerBg: '#FFFFFF', border: '#F0F0F0',
    text: '#1A1A1A', subtext: '#666', bubbleUser: '#6B21A8',
    bubbleTwin: 'transparent', userText: '#FFF', twinText: '#1A1A1A',
    inputBg: '#F8F8F8', inputBorder: '#EFEFEF', sendActive: '#6B21A8',
    sendInactive: '#E0D9F5', addBtnBg: '#F3F0FF', addBtnBorder: '#E0D9F5',
    suggestBg: '#F3F0FF', suggestBorder: '#E0D9F5', suggestText: '#6B21A8',
    attachBg: '#FFF', overlay: 'rgba(0,0,0,0.5)', featureBg: '#FFF',
    retryColor: '#EF4444',
  },
  dark: {
    bg: '#1A1A1A', headerBg: '#1A1A1A', border: '#333',
    text: '#FFF', subtext: '#999', bubbleUser: '#6B21A8',
    bubbleTwin: '#2A2A2A', userText: '#FFF', twinText: '#FFF',
    inputBg: '#333', inputBorder: '#555', sendActive: '#6B21A8',
    sendInactive: '#3A3A3A', addBtnBg: '#2A2A2A', addBtnBorder: '#444',
    suggestBg: '#2A2A2A', suggestBorder: '#444', suggestText: '#B794F4',
    attachBg: '#2A2A2A', overlay: 'rgba(0,0,0,0.7)', featureBg: '#2A2A2A',
    retryColor: '#EF4444',
  },
};

function getWelcome(lang: string) {
  const h = new Date().getHours();
  if (lang === 'ar') {
    if (h >= 6 && h < 12) return { emoji: '🌅', text: 'صباح الخير!', sub: 'كيف حالك اليوم؟' };
    if (h >= 12 && h < 18) return { emoji: '🌞', text: 'مرحباً!', sub: 'كيف تسير أمورك؟' };
    if (h >= 18 && h < 24) return { emoji: '🌙', text: 'مساء الخير!', sub: 'كيف كان يومك؟' };
    return { emoji: '🌃', text: 'سهرة سعيدة!', sub: 'أنا هنا معك 💜' };
  }
  if (h >= 6 && h < 12) return { emoji: '🌅', text: 'Good Morning!', sub: 'How are you today?' };
  if (h >= 12 && h < 18) return { emoji: '🌞', text: 'Hello!', sub: 'How is your day going?' };
  if (h >= 18 && h < 24) return { emoji: '🌙', text: 'Good Evening!', sub: 'How was your day?' };
  return { emoji: '🌃', text: 'Late Night!', sub: "I'm here with you 💜" };
}

function getSuggestions(lang: string) {
  if (lang === 'ar') return [
    { emoji: '💬', prompt: 'لنتحدث عن أي شيء' },
    { emoji: '🤝', prompt: 'أحتاج مساعدتك' },
    { emoji: '💭', prompt: 'أريد أن أفهم مشاعري' },
    { emoji: '✨', prompt: 'لنبدع شيئاً معاً' },
  ];
  return [
    { emoji: '💬', prompt: "Let's talk" },
    { emoji: '🤝', prompt: 'I need your help' },
    { emoji: '💭', prompt: 'Help me understand my feelings' },
    { emoji: '✨', prompt: "Let's create together" },
  ];
}

const ATTACH_ITEMS = [
  { icon: Camera, label_ar: 'كاميرا', label_en: 'Camera', action: 'camera', color: '#8B5CF6' },
  { icon: ImageIcon, label_ar: 'معرض الصور', label_en: 'Gallery', action: 'image', color: '#EC4899' },
  { icon: FileText, label_ar: 'ملف', label_en: 'File', action: 'file', color: '#F59E0B' },
  { icon: Search, label_ar: 'بحث', label_en: 'Search', action: 'search', color: '#10B981' },
  { icon: Dumbbell, label_ar: 'جلسة تدريب', label_en: 'Coaching', action: 'coach', color: '#3B82F6' },
  { icon: Moon, label_ar: 'تفسير حلم', label_en: 'Dream Analysis', action: 'dream', color: '#6366F1' },
];

const ChatBubble = memo(({ item, isLast, pulseAnim, theme, onRetry, onCopy, onRegenerate }: {
  item: any; isLast: boolean; pulseAnim: Animated.Value; theme: string;
  onRetry: (msg: any) => void; onCopy: (content: string) => void; onRegenerate?: (msg: any) => void;
}) => {
  const isUser = item.role === 'user';
  const colors = theme === 'dark' ? COLORS.dark : COLORS.light;
  return (
    <Pressable onLongPress={() => onCopy(item.content)} style={[styles.msgRow, isUser ? styles.userRow : styles.twinRow]}>
      {!isUser && <Animated.View style={{ transform: [{ scale: isLast ? pulseAnim : 1 }] }}><Image source={TWIN_ICON} style={styles.avatar} resizeMode="contain" /></Animated.View>}
      <View style={[styles.bubble, isUser ? [styles.userBubble, { backgroundColor: colors.bubbleUser }] : [styles.twinBubble, { backgroundColor: colors.bubbleTwin }]]}>
        {item.image && <Image source={{ uri: item.image.startsWith('data:') ? item.image : `data:image/jpeg;base64,${item.image}` }} style={styles.chatImage} resizeMode="cover" />}
        <Text style={[isUser ? styles.userText : [styles.twinText, { color: colors.twinText }]]}>{item.content}</Text>
        <View style={styles.msgFooter}>
          <Text style={[styles.timestamp, { color: colors.subtext }]}>{item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
          {item.failed && <TouchableOpacity onPress={() => onRetry(item)} style={styles.retryBtn}><RotateCcw size={12} stroke={colors.retryColor} /><Text style={[styles.retryText, { color: colors.retryColor }]}>Retry</Text></TouchableOpacity>}
          {!isUser && !item.failed && isLast && onRegenerate && <TouchableOpacity onPress={() => onRegenerate(item)} style={styles.regenerateBtn}><RotateCcw size={12} stroke={colors.subtext} /></TouchableOpacity>}
        </View>
      </View>
      {isUser && <View style={{ width: 36 }} />}
    </Pressable>
  );
});

export default function Chat() {
  const insets = useSafeAreaInsets();
  const {
    userId, twinName, twinGender, tier, chatHistory, addMessage, updateBond,
    updateRelationshipDims, calmMode, triggerHaptic, lang, theme, setTwinName, setTwinGender,
    openMenu, closeMenu, menuVisible, soundEnabled, setSoundEnabled
  } = useTwinStore((s) => ({
    userId: s.userId, twinName: s.twinName, twinGender: s.twinGender, tier: s.tier,
    chatHistory: s.chatHistory, addMessage: s.addMessage, updateBond: s.updateBond,
    updateRelationshipDims: s.updateRelationshipDims, calmMode: s.calmMode,
    triggerHaptic: s.triggerHaptic, lang: s.lang, theme: s.theme,
    setTwinName: s.setTwinName, setTwinGender: s.setTwinGender,
    openMenu: s.openMenu, closeMenu: s.closeMenu, menuVisible: s.menuVisible,
    soundEnabled: s.voiceEnabled, setSoundEnabled: s.setVoiceEnabled,
  }));

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [featureModal, setFeatureModal] = useState<{ visible: boolean; type: string }>({ visible: false, type: '' });
  const [featureInput, setFeatureInput] = useState('');
  const [messageQueue, setMessageQueue] = useState<Array<{ msg?: string; image?: string }>>([]);

  const flatRef = useRef<FlatList<any>>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const attachAnim = useRef(new Animated.Value(0)).current;
  const abortRef = useRef<AbortController | null>(null);

  const colors = theme === 'dark' ? COLORS.dark : COLORS.light;
  const isRTL = lang === 'ar';
  const isDark = theme === 'dark';
  const welcome = getWelcome(lang);
  const suggestions = getSuggestions(lang);
  const isFree = tier === 'free';

  useEffect(() => {
    if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1]?.role === 'twin') {
      Animated.sequence([Animated.timing(pulseAnim, { toValue: 1.4, duration: 200, useNativeDriver: true }), Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true })]).start();
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

  const sendMessage = useCallback(async (msg?: string, imageBase64?: string) => {
    const message = (msg || input).trim();
    if (!message && !imageBase64) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    addMessage('user', message || '📷 صورة', imageBase64);
    setInput(''); setLoading(true);
    try {
      const res = await API.post('/api/chat', {
        message: message || 'صورة مرفقة', twin_name: twinName, bond_level: 0,
        relationship_dims: {}, calm_mode: calmMode, lang,
        image: imageBase64 || undefined,
      }, {
        headers: { 'X-Calm-Mode': String(calmMode), 'X-Country-Code': countryCode, 'X-Twin-Gender': twinGender },
        signal: abortRef.current.signal,
      });
      addMessage('twin', res.data.reply);
          // إظهار فكرة التوأم إذا وجدت
          if (res.data.twin_thought && res.data.twin_thought.trim()) {
            addMessage('twin', '💭 ' + res.data.twin_thought); // true for special style
          }

      updateBond(res.data.new_bond ?? 0);
          if (res.data.relationship_dims) updateRelationshipDims(res.data.relationship_dims); if (res.data.relationship_dims) updateRelationshipDims(res.data.relationship_dims);
      if (res.data.dims_update) updateRelationshipDims(res.data.dims_update);
      if (soundEnabled) { try { await speakResponse(res.data.reply, { pitch: 1.0, rate: 1.0 }); } catch {} }
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      const status = error?.response?.status;
      if (status === 401) addMessage('twin', lang === 'ar' ? 'انتهت جلستك 🔒' : 'Session expired 🔒');
      else addMessage('twin', lang === 'ar' ? 'تعذر الاتصال 😔' : 'Connection failed 😔');
    } finally { setLoading(false); }
  }, [input, loading, twinName, calmMode, lang, addMessage, updateBond, updateRelationshipDims, soundEnabled, twinGender, countryCode]);

  const send = useCallback(async (msg?: string, imageBase64?: string) => {
    if (loading) { setMessageQueue(prev => [...prev, { msg, image: imageBase64 }]); return; }
    triggerHaptic(); await sendMessage(msg, imageBase64);
  }, [loading, sendMessage, triggerHaptic]);

  const handleRetry = useCallback((failedMsg: any) => { addMessage('user', failedMsg.content, failedMsg.image); sendMessage(failedMsg.content, failedMsg.image); }, [addMessage, sendMessage]);
  const handleRegenerate = useCallback((lastMsg: any) => { sendMessage(lastMsg.content); }, [sendMessage]);
  const handleCopy = useCallback((content: string) => { Alert.alert('✅', lang === 'ar' ? 'تم النسخ' : 'Copied'); }, [lang]);

  const handleCamera = useCallback(async () => {
    setShowAttach(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert(lang === 'ar' ? 'صلاحية' : 'Permission', lang === 'ar' ? 'مطلوب إذن الكاميرا' : 'Camera permission needed'); return; }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 });
    if (!result.canceled && result.assets?.[0]?.base64) send('', result.assets[0].base64);
  }, [send, lang]);

  const handleAttachAction = useCallback(async (action: string) => {
    setShowAttach(false);
    if (action === 'camera') { handleCamera(); return; }
    if (action === 'image') {
      const p = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!p.granted) { Alert.alert('صلاحية', lang === 'ar' ? 'مطلوب إذن الصور' : 'Permission needed'); return; }
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
    const prompts: Record<string, string> = { search: '/search ', coach: lang === 'ar' ? 'أريد جلسة تدريب: ' : 'Coaching session: ', dream: lang === 'ar' ? 'أريد تحليل حلمي: ' : 'Dream analysis: ' };
    send(prompts[featureModal.type] + featureInput); setFeatureModal({ visible: false, type: '' }); setFeatureInput('');
  };

  const toggleSound = () => setSoundEnabled(!soundEnabled);

  const renderMsg = useCallback(({ item, index }: { item: any; index: number }) => (
    <ChatBubble item={item} isLast={index === chatHistory.length - 1} pulseAnim={pulseAnim} theme={theme} onRetry={handleRetry} onCopy={handleCopy} onRegenerate={handleRegenerate} />
  ), [chatHistory.length, theme, handleRetry, handleCopy, handleRegenerate]);

  const ListEmpty = useCallback(() => (
    <View style={styles.welcomeWrap}>
      <Text style={styles.welcomeEmoji}>{welcome.emoji}</Text>
      <Text style={[styles.welcomeTitle, { color: colors.text }]}>{welcome.text}</Text>
      <Text style={[styles.welcomeSub, { color: colors.subtext }]}>{welcome.sub}</Text>
      <View style={styles.suggestRow}>
        {suggestions.map((item, i) => (
          <TouchableOpacity key={i} style={[styles.suggestBtn, { backgroundColor: colors.suggestBg, borderColor: colors.suggestBorder }]} onPress={() => send(item.prompt)}>
            <Text style={styles.suggestEmoji}>{item.emoji}</Text>
            <Text style={[styles.suggestText, { color: colors.suggestText }]}>{item.prompt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  ), [welcome, suggestions, send, colors]);

  const ListFooter = useCallback(() => {
    if (!loading) return null;
    return (<View style={styles.typingRow}><Image source={TWIN_ICON} style={{ width: 28, height: 28, borderRadius: 14 }} resizeMode="contain" /><TypingIndicator /></View>);
  }, [loading]);

  // سيتم إكمال الـ return في الجزء الثالث

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={openMenu} style={styles.headerBtn}><Menu size={22} stroke={colors.text} /></TouchableOpacity>
          <View style={styles.headerCenter}><Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>{twinName || (lang === 'ar' ? 'توأمك' : 'Your Twin')}</Text></View>
          <TouchableOpacity onPress={toggleSound} style={styles.headerBtn}>{soundEnabled ? <Volume2 size={20} stroke={colors.text} /> : <VolumeX size={20} stroke={colors.subtext} />}</TouchableOpacity>
        </View>
        <FlatList ref={flatRef} data={chatHistory} keyExtractor={(item: any, index: number) => item.id || index.toString()} renderItem={renderMsg} ListEmptyComponent={ListEmpty} ListFooterComponent={ListFooter} contentContainerStyle={styles.listContent} onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })} removeClippedSubviews initialNumToRender={15} maxToRenderPerBatch={10} windowSize={5} keyboardDismissMode="interactive" />
        <View style={[styles.inputBar, { backgroundColor: colors.headerBg, borderTopColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowAttach(true)} style={[styles.addBtn, { backgroundColor: colors.addBtnBg, borderColor: colors.addBtnBorder }]}><Text style={[styles.addBtnText, { color: colors.sendActive }]}>+</Text></TouchableOpacity>
          <TextInput style={[styles.textInput, isRTL && { textAlign: 'right' }, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]} value={input} onChangeText={setInput} placeholder={lang === 'ar' ? 'اكتب رسالتك... 💜' : 'Type your message... 💜'} placeholderTextColor={colors.subtext} multiline maxLength={2000} editable={!loading} onSubmitEditing={() => send()} returnKeyType="send" />
          <TouchableOpacity onPress={() => send()} disabled={loading || (input.trim().length === 0 && !loading)} style={[styles.sendBtn, { backgroundColor: (input.trim().length > 0 && !loading) ? colors.sendActive : colors.sendInactive }]}>
            {loading ? <ActivityIndicator size="small" color={colors.subtext} /> : <Send size={18} stroke={input.trim().length > 0 ? '#FFF' : colors.subtext} />}
          </TouchableOpacity>
        </View>
        <Modal visible={showAttach} transparent animationType="none" onRequestClose={() => setShowAttach(false)}>
          <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setShowAttach(false)}>
            <Animated.View style={[styles.attachContainer, { backgroundColor: colors.attachBg, transform: [{ translateY: attachAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }]}>
              <View style={styles.attachHeader}><Text style={[styles.attachTitle, { color: colors.text }]}>{lang === 'ar' ? 'إرفاق' : 'Attach'}</Text><TouchableOpacity onPress={() => setShowAttach(false)}><X size={22} stroke={colors.subtext} /></TouchableOpacity></View>
              <View style={styles.attachGrid}>
                {ATTACH_ITEMS.map((item, idx) => (
                  <TouchableOpacity key={idx} style={styles.attachItem} onPress={() => handleAttachAction(item.action)}>
                    <View style={[styles.attachIconWrap, { backgroundColor: item.color + '20' }]}><item.icon size={26} stroke={item.color} /></View>
                    <Text style={[styles.attachLabel, { color: colors.text }]}>{lang === 'ar' ? item.label_ar : item.label_en}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
        <Modal visible={featureModal.visible} transparent animationType="fade" onRequestClose={() => setFeatureModal({ visible: false, type: '' })}>
          <View style={styles.featureOverlay}>
            <View style={[styles.featureContainer, { backgroundColor: colors.featureBg }]}>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 1 },
  headerBtn: { padding: 8 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerName: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  listContent: { paddingHorizontal: 10, paddingVertical: 12, flexGrow: 1 },
  welcomeWrap: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 20 },
  welcomeEmoji: { fontSize: 56, marginBottom: 16 },
  welcomeTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  welcomeSub: { fontSize: 15, fontWeight: '400', textAlign: 'center', marginBottom: 28 },
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  suggestBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, borderWidth: 1 },
  suggestEmoji: { fontSize: 18 },
  suggestText: { fontSize: 13, fontWeight: '600' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10, gap: 6 },
  userRow: { justifyContent: 'flex-end' },
  twinRow: { justifyContent: 'flex-start' },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  bubble: { maxWidth: '80%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  userBubble: { borderBottomRightRadius: 6 },
  twinBubble: { borderBottomLeftRadius: 6 },
  userText: { color: '#FFF', fontSize: 15, lineHeight: 22 },
  twinText: { fontSize: 15, lineHeight: 22 },
  chatImage: { width: 200, height: 200, borderRadius: 12, marginBottom: 6 },
  msgFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 6 },
  timestamp: { fontSize: 10 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  retryText: { fontSize: 11 },
  regenerateBtn: { padding: 4 },
  typingRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingVertical: 8, gap: 8 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, borderTopWidth: 1, gap: 8 },
  addBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  addBtnText: { fontSize: 20, fontWeight: '600' },
  textInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, fontSize: 15, maxHeight: 100, minHeight: 42, borderWidth: 1 },
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
