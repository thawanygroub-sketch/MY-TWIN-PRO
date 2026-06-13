import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Modal, Animated, Alert, StatusBar,
  Image, ActivityIndicator, Dimensions, Share
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
import {
  sendChatFromStore, updateStoreFromResponse,
  fetchWeather, fetchYouTube, fetchSpotify, fetchNews, fetchCurrency
} from '../lib/api';
import SideMenu from '../components/SideMenu';
import TypingIndicator from '../components/TypingIndicator';
import {
  Menu, Send, X, Volume2, VolumeX, RotateCcw, Copy, Share2,
  Camera, Image as ImageIcon, FileText, Search, Dumbbell, Moon,
  Cloud, Music, Film, DollarSign, TrendingUp, Zap
} from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { speakResponse } from '../utils/voice_engine';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const APP_ICON = require('../assets/icon.png');

const COLORS = {
  light: {
    bg: '#FFFFFF', headerBg: '#FFFFFF', border: '#F0F0F0', text: '#1A1A1A',
    subtext: '#666', bubbleUser: '#6B21A8', userText: '#FFF',
    inputBg: '#F8F8F8', inputBorder: '#EFEFEF', sendActive: '#6B21A8',
    sendInactive: '#E0D9F5', addBtnBg: '#F3F0FF', addBtnBorder: '#E0D9F5',
    retryColor: '#EF4444', memoryBadgeBg: '#F3F0FF', memoryBadgeText: '#6B21A8',
  },
  dark: {
    bg: '#1A1A1A', headerBg: '#1A1A1A', border: '#333', text: '#FFF',
    subtext: '#999', bubbleUser: '#6B21A8', userText: '#FFF',
    inputBg: '#333', inputBorder: '#555', sendActive: '#6B21A8',
    sendInactive: '#3A3A3A', addBtnBg: '#2A2A2A', addBtnBorder: '#444',
    retryColor: '#EF4444', memoryBadgeBg: '#2A2A2A', memoryBadgeText: '#D8B4FE',
  },
};

const MarkdownRenderer = memo(({ content, isDark }: { content: string; isDark: boolean }) => {
  const markdownStyles: any = {
    body: { color: isDark ? '#FFF' : '#1A1A1A', fontSize: 15, lineHeight: 24 },
    heading1: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, color: isDark ? '#FFF' : '#1A1A1A' },
    heading2: { fontSize: 18, fontWeight: 'bold', marginBottom: 6, color: isDark ? '#FFF' : '#1A1A1A' },
    heading3: { fontSize: 16, fontWeight: 'bold', marginBottom: 4, color: isDark ? '#FFF' : '#1A1A1A' },
    code_inline: { backgroundColor: isDark ? '#333' : '#F0F0F0', color: isDark ? '#FFF' : '#333', paddingHorizontal: 6, borderRadius: 4 },
    code_block: { backgroundColor: isDark ? '#222' : '#F0F0F0', padding: 10, borderRadius: 8, marginBottom: 8 },
    blockquote: { borderLeftWidth: 3, borderLeftColor: '#6B21A8', paddingLeft: 10, marginBottom: 8 },
    strong: { fontWeight: 'bold' },
    link: { color: '#6B21A8' },
  };
  return <Markdown style={markdownStyles}>{content}</Markdown>;
});

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

const TwinBubble = memo(({ item, isLast, pulseAnim, isDark, onCopy, onRetry, onRegenerate }: {
  item: ChatMessage; isLast: boolean; pulseAnim: Animated.Value; isDark: boolean;
  onCopy: (text: string) => void; onRetry: (msg: ChatMessage) => void;
  onRegenerate: (msg: ChatMessage) => void;
}) => (
  <View style={styles.twinRow}>
    <Animated.View style={{ transform: [{ scale: isLast ? pulseAnim : 1 }] }}>
      <Image source={APP_ICON} style={styles.avatar} />
    </Animated.View>
    <View style={styles.twinContent}>
      {item.memoryRecall && (
        <View style={[styles.memoryBadge, { backgroundColor: isDark ? COLORS.dark.memoryBadgeBg : COLORS.light.memoryBadgeBg }]}>
          <Zap size={14} stroke={isDark ? COLORS.dark.memoryBadgeText : COLORS.light.memoryBadgeText} />
          <Text style={[styles.memoryBadgeText, { color: isDark ? COLORS.dark.memoryBadgeText : COLORS.light.memoryBadgeText }]}>Memory</Text>
        </View>
      )}
      <MarkdownRenderer content={item.content} isDark={isDark} />
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
));

const EnergyCircle = memo(({ energy, isDark }: { energy: number; isDark: boolean }) => {
  const color = energy > 60 ? '#10B981' : energy > 25 ? '#F59E0B' : '#EF4444';
  const size = 40;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = Math.max(0, Math.min(energy, 100)) / 100;

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: isDark ? '#333' : '#E5E7EB' }} />
        <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: 'transparent', borderTopColor: color, borderRightColor: color, transform: [{ rotate: `${progress * 360}deg` }] }} />
        <View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: strokeWidth, borderColor: 'transparent', borderBottomColor: color, borderLeftColor: color, transform: [{ rotate: `${progress * 360}deg` }] }} />
        <View style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={14} stroke={color} />
        </View>
      </View>
      <Text style={{ fontSize: 9, fontWeight: '700', color: isDark ? '#CCC' : '#666', marginTop: 2 }}>{energy}%</Text>
    </View>
  );
});
export default function Chat() {
  const insets = useSafeAreaInsets();
  const {
    userId, twinName, twinGender, tier, chatHistory, addMessage,
    triggerHaptic, lang, theme, setTwinName, setTwinGender,
    openMenu, closeMenu, voiceEnabled, setVoiceEnabled,
    setEnergy, bondLevel, setThinking, setThinkingStage
  } = useTwinStore((s) => ({
    userId: s.userId, twinName: s.twinName, twinGender: s.twinGender, tier: s.tier,
    chatHistory: s.chatHistory, addMessage: s.addMessage,
    triggerHaptic: s.triggerHaptic, lang: s.lang, theme: s.theme,
    setTwinName: s.setTwinName, setTwinGender: s.setTwinGender,
    openMenu: s.openMenu, closeMenu: s.closeMenu,
    voiceEnabled: s.voiceEnabled, setVoiceEnabled: s.setVoiceEnabled,
    setEnergy: s.setEnergy, bondLevel: s.bondLevel,
    setThinking: s.setThinking, setThinkingStage: s.setThinkingStage,
  }));

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [featureModal, setFeatureModal] = useState<{ visible: boolean; type: string }>({ visible: false, type: '' });
  const [featureInput, setFeatureInput] = useState('');
  const [messageQueue, setMessageQueue] = useState<Array<{ msg?: string; image?: string }>>([]);
  const [twinEnergy, setTwinEnergy] = useState(100);

  const flatRef = useRef<FlatList<ChatMessage>>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const attachAnim = useRef(new Animated.Value(0)).current;

  const colors = theme === 'dark' ? COLORS.dark : COLORS.light;
  const isRTL = lang === 'ar';
  const isDark = theme === 'dark';
  const isFree = tier === 'free';

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

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/stats`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
          });
          if (res.ok) {
            const stats = await res.json();
            const remaining = stats.limits?.messages?.remaining || 0;
            const limit = stats.limits?.messages?.limit || 15;
            setTwinEnergy(Math.round((remaining / limit) * 100));
          }
        }
      } catch {}
    })();
  }, [chatHistory]);

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
      updateStoreFromResponse(response);

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/stats`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.ok) {
          const stats = await res.json();
          const remaining = stats.limits?.messages?.remaining || 0;
          const limit = stats.limits?.messages?.limit || 15;
          setTwinEnergy(Math.round((remaining / limit) * 100));
        }
      }

      if (voiceEnabled) {
        try { await speakResponse(response.reply); } catch {}
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

  const handleQuickTool = async (tool: string) => {
    let result = '';
    setLoading(true);
    try {
      switch(tool) {
        case 'weather': result = (await fetchWeather('Cairo')).result || 'الطقس غير متاح'; break;
        case 'youtube': result = (await fetchYouTube(input || 'music')).result || 'لم أجد فيديوهات'; break;
        case 'spotify': result = (await fetchSpotify(input || 'music')).result || 'لم أجد أغاني'; break;
        case 'news': result = (await fetchNews()).result || 'الأخبار غير متاحة'; break;
        case 'currency': result = (await fetchCurrency('USD')).result || 'أسعار العملات غير متاحة'; break;
      }
      if (result) {
        addMessage({ id: Math.random().toString(36).substr(2,9)+Date.now().toString(36), role: 'twin', content: result, timestamp: Date.now() });
        if (voiceEnabled) await speakResponse(result);
      }
    } catch { Alert.alert('خطأ', 'تعذر تنفيذ الأداة'); }
    finally { setLoading(false); }
  };

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
    else if (action === 'generate_image') { handleImageGeneration(); }
  }, [send, lang, handleCamera, isFree]);

  const handleImageGeneration = async () => {
    if (!input.trim()) {
      Alert.alert(lang === 'ar' ? 'تنبيه' : 'Notice', lang === 'ar' ? 'اكتب وصفاً للصورة أولاً' : 'Enter a description first');
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No token');
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/image/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ prompt: input })
      });
      const data = await res.json();
      if (data.status === 'success' && data.image_base64) {
        addMessage({ id: Math.random().toString(36).substr(2,9)+Date.now().toString(36), role: 'twin', content: '🖼️ صورة مولدة', image: data.image_base64, timestamp: Date.now() });
        setInput('');
      } else {
        Alert.alert(lang === 'ar' ? 'خطأ' : 'Error', data.message || 'فشل توليد الصورة');
      }
    } catch (e) {
      Alert.alert(lang === 'ar' ? 'خطأ' : 'Error', 'تعذر الاتصال بالخادم');
    } finally { setLoading(false); }
  };

  const handleFeatureSend = () => {
    const prompts: Record<string, string> = {
      search: '/search ',
      coach: lang === 'ar' ? 'أريد جلسة تدريب: ' : 'Coaching session: ',
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
    { icon: ImageIcon, label_ar: 'إنشاء صورة', label_en: 'Generate Image', action: 'generate_image', color: '#06B6D4' },
  ];

  const renderMsg = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const isLast = index === chatHistory.length - 1;
    if (item.role === 'user') return <UserBubble item={item} isDark={isDark} />;
    return <TwinBubble item={item} isLast={isLast} pulseAnim={pulseAnim} isDark={isDark} onCopy={handleCopy} onRetry={handleRetry} onRegenerate={handleRegenerate} />;
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
        <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={openMenu} style={styles.menuBtn}><Menu size={22} stroke={colors.text} /></TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>{twinName || (lang === 'ar' ? 'توأمك' : 'Your Twin')}</Text>
            <View style={styles.indicatorsRow}>
              <EnergyCircle energy={twinEnergy} isDark={isDark} />
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.indicatorLabel, { color: colors.subtext }]}>{Math.round(bondLevel)}%</Text>
                <Text style={{ fontSize: 8, color: colors.subtext }}>{lang === 'ar' ? 'ترابط' : 'Bond'}</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={toggleSound} style={styles.soundBtn}>
            {voiceEnabled ? <Volume2 size={22} stroke={colors.text} /> : <VolumeX size={22} stroke={colors.subtext} />}
          </TouchableOpacity>
        </View>

        <FlatList ref={flatRef} data={chatHistory} keyExtractor={(item) => item.id}
          renderItem={renderMsg} ListFooterComponent={ListFooter}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          removeClippedSubviews initialNumToRender={10} maxToRenderPerBatch={10} windowSize={5}
          keyboardDismissMode="interactive" />

        <View style={[styles.inputBar, { backgroundColor: colors.headerBg, borderTopColor: colors.border }]}>
          <TouchableOpacity onPress={() => setShowAttach(true)} style={[styles.addBtn, { backgroundColor: colors.addBtnBg, borderColor: colors.addBtnBorder }]}>
            <Text style={[styles.addBtnText, { color: colors.sendActive }]}>+</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.textInput, isRTL && { textAlign: 'right' }, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
            value={input} onChangeText={setInput}
            placeholder={lang === 'ar' ? 'اكتب رسالتك... 💜' : 'Type your message... 💜'}
            placeholderTextColor={colors.subtext} multiline maxLength={2000} editable={!loading}
            onSubmitEditing={() => send()} />
          <TouchableOpacity onPress={() => send()}
            disabled={loading || (input.trim().length === 0 && !loading)}
            style={[styles.sendBtn, { backgroundColor: (input.trim().length > 0 && !loading) ? colors.sendActive : colors.sendInactive }]}>
            {loading ? <ActivityIndicator size="small" color={colors.subtext} /> : <Send size={22} stroke="#FFF" />}
          </TouchableOpacity>
        </View>

        <View style={[styles.quickToolsBar, { backgroundColor: colors.headerBg, borderTopColor: colors.border }]}>
          {[
            { icon: Cloud, label_ar: 'طقس', label_en: 'Weather', tool: 'weather', color: '#06B6D4' },
            { icon: Music, label_ar: 'موسيقى', label_en: 'Music', tool: 'spotify', color: '#EC4899' },
            { icon: Film, label_ar: 'يوتيوب', label_en: 'YouTube', tool: 'youtube', color: '#EF4444' },
            { icon: DollarSign, label_ar: 'عملات', label_en: 'Currency', tool: 'currency', color: '#10B981' },
            { icon: TrendingUp, label_ar: 'أخبار', label_en: 'News', tool: 'news', color: '#8B5CF6' },
          ].map((item, idx) => (
            <TouchableOpacity key={idx} style={styles.quickToolBtn} onPress={() => handleQuickTool(item.tool)}>
              <item.icon size={20} stroke={item.color} />
              <Text style={[styles.quickToolLabel, { color: colors.subtext }]}>{lang === 'ar' ? item.label_ar : item.label_en}</Text>
            </TouchableOpacity>
          ))}
        </View>

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
  indicatorsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 2 },
  indicatorLabel: { fontSize: 10, fontWeight: '600' },
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
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  actionBtn: { padding: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 8, borderTopWidth: 1, gap: 8 },
  addBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  addBtnText: { fontSize: 18, fontWeight: '700' },
  textInput: { flex: 1, backgroundColor: '#F8F8F8', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, fontSize: 15, maxHeight: 100, minHeight: 44, borderWidth: 1 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  quickToolsBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 6, borderTopWidth: 1, paddingHorizontal: 10 },
  quickToolBtn: { alignItems: 'center', padding: 6 },
  quickToolLabel: { fontSize: 10, marginTop: 2, fontWeight: '600' },
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
