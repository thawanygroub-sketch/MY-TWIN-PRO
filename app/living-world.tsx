import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { apiPost, apiGet } from '../lib/httpClient';
import { useRTL } from '../lib/useRTL';
import { useAppTheme } from '../engine/colors';
import { useTwinStore } from '../store/useTwinStore';
import { bootstrapCoordinator } from '../src/core/BootstrapCoordinator';
import { stateBus } from '../src/core/StateBus';
import { presenceBridge } from '../src/core/PresenceBridge';
import { EventBus } from '../src/core/EventBus';
import { voiceEngine } from '../engine/voice/VoiceEngine';
import { devicePresenceEngine } from '../engine/device/DevicePresenceEngine';
import ConsciousBeing from '../src/components/conscious/ConsciousBeing';
import { Send, Mic, MicOff, Database, Eye, Heart, Sparkles, Target, Moon, X } from 'lucide-react-native';
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
const feelPatch = (r: any): any => {
  const em = String(r?.twin_emotional_state?.current_emotion || r?.emotion || '').toLowerCase();
  if ((r?.expression_intent?.smile || 0) > 0.4) return { connection: 0.8, emotionValence: 0.7, arousal: 0.5 };
  if (em.includes('joy') || em.includes('excit')) return { emotionValence: 0.7, arousal: 0.6 };
  if (em.includes('concern') || em.includes('sad')) return { emotionValence: -0.5, arousal: 0.4 };
  if (em.includes('curious')) return { curiosity: 0.8, focus: 0.5 };
  if (em.includes('surpr')) return { arousal: 0.9 };
  return { emotionValence: 0.15 };
};
export default function LivingWorld() {
  const userId = useTwinStore(s => s.userId) || '';
  const { colors } = useAppTheme();
  const rtl = useRTL();
  const lang = rtl.isRTL ? 'ar' : 'en';
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Array<{ id: string; sender: 'user' | 'twin'; text: string }>>([]);
  const [isListening, setIsListening] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [wing, setWing] = useState<string | null>(null);
  const [activeWing, setActiveWing] = useState<string | null>(null);
  const [wingData, setWingData] = useState<Array<{ k: string; v: string }>>([]);
  const [online, setOnline] = useState(true);
  const [diag, setDiag] = useState('');
  const [tele, setTele] = useState<{ n: number; hb: number | null } | null>(null);
  const wingT = useRef<any>(null);
  const light = useCallback((w: string, ms = 2600) => { setWing(w); if (wingT.current) clearTimeout(wingT.current); wingT.current = setTimeout(() => setWing(null), ms); }, []);
  useEffect(() => {
    if (userId) {
      bootstrapCoordinator.bootstrap().catch(() => {});
      try { voiceEngine.start(); } catch {}
      light('perception', 3000);
    }
    const onMem = () => light('memory');
    const onMile = () => light('goals');
    EventBus.on('MEMORY_SURFACED', onMem);
    EventBus.on('MILESTONE_REACHED', onMile);
    return () => { try { voiceEngine.stop(); } catch {} };
  }, [userId]);
  const openWing = useCallback(async (key: string) => {
    setActiveWing(key); light(key, 1500);
    try {
      if (key === 'memory') { const d: any = await apiGet(`/api/memories?user_id=${userId}`); const arr = Array.isArray(d) ? d : (d?.memories || []); setWingData(arr.slice(0, 8).map((m: any) => ({ k: m.layer || m.type || 'ذكرى', v: String(m.content || m.text || '').slice(0, 60) }))); }
      else if (key === 'goals') { const d: any = await apiGet(`/api/goals?user_id=${userId}`); const arr = Array.isArray(d) ? d : (d?.goals || []); setWingData(arr.slice(0, 8).map((g: any) => ({ k: g.status || 'هدف', v: String(g.title || g.text || '').slice(0, 60) }))); }
      else if (key === 'dreams') { const d: any = await apiGet(`/api/dreams?user_id=${userId}`); const arr = Array.isArray(d) ? d : (d?.dreams || []); setWingData(arr.slice(0, 8).map((x: any) => ({ k: x.kind || 'حلم', v: String(x.summary || x.text || '').slice(0, 60) }))); }
      else if (key === 'perception') { const s = devicePresenceEngine.getSensors(); setWingData([{ k: 'الحركة', v: s.userWalking ? 'يمشي معك' : s.userStationary ? 'ساكن' : 'متحرك' }, { k: 'الإضاءة', v: String(s.lightLevel ?? '—') }, { k: 'البطارية', v: `${s.deviceBattery ?? '—'}%` }, { k: 'الوقت', v: s.isNightTime ? 'ليل' : 'نهار' }]); }
      else if (key === 'emotion') { const st = stateBus.getState(); setWingData([{ k: 'الشعور', v: st.emotionValence > 0.3 ? 'دافئ' : st.emotionValence < -0.3 ? 'متكدر' : 'هادئ' }, { k: 'الطاقة', v: `${Math.round(st.energy * 100)}%` }, { k: 'الارتباط', v: `${Math.round(st.connection * 100)}%` }, { k: 'الفضول', v: `${Math.round(st.curiosity * 100)}%` }]); }
      else setWingData([{ k: 'الحدس', v: 'أتعلم من سياقاتك وستزداد حدسي مع كل حوار.' }]);
    } catch (e: any) { setWingData([{ k: 'تنبيه', v: String(e?.message || e).slice(0, 80) }]); }
  }, [userId, light]);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const d: any = await apiGet('/api/system/status');
        if (alive) { setTele({ n: d?.engines_count ?? 0, hb: d?.last_heartbeat_sec_ago ?? null }); setOnline(true); }
      } catch { if (alive) setOnline(false); }
    };
    load();
    const iv = setInterval(load, 60000);
    return () => { alive = false; clearInterval(iv); };
  }, []);
  const statusLine = tele
    ? (rtl.isRTL ? `${tele.n} محركًا حيًا • ${tele.hb != null ? `نبض قبل ${tele.hb}ث` : 'النبض نشط'} • ${online ? 'متصل' : 'دون اتصال'}` : `${tele.n} living engines • ${tele.hb != null ? `beat ${tele.hb}s ago` : 'beat active'} • ${online ? 'online' : 'offline'}`)
    : (online ? (rtl.isRTL ? 'متصل' : 'online') : (rtl.isRTL ? 'دون اتصال' : 'offline'));
  const handleSend = useCallback(async () => {
    if (!inputText.trim() || isThinking) return;
    const text = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'user', text }]);
    setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: 'twin', text: '' }]);
    EventBus.emit('USER_SEND_MESSAGE', {});
    stateBus.patch({ thinking: true, focus: 0.8 }); light('intuition');
    setIsThinking(true);
    try {
      const response: any = await apiPost('/api/chat', { message: text, user_id: userId });
      const silence = Number(response?.silence_ms || 0);
      if (silence > 0) await new Promise(r => setTimeout(r, Math.min(silence, 3500)));
      setOnline(true); setDiag('');
      stateBus.patch(feelPatch(response));
      if (response?.memory_surfaced) { EventBus.emit('MEMORY_SURFACED', {}); light('memory'); }
      light('emotion');
      try { voiceEngine.speak(response?.reply || '', response?.emotion); presenceBridge.speak(4000); } catch {}
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], text: response?.reply || SRV[lang as 'ar'] }; return u; });
    } catch (e: any) {
      setOnline(false);
      setDiag(String(e?.message || e).slice(0, 120));
      stateBus.patch({ emotionValence: -0.4, arousal: 0.4 });
      setMessages(prev => { const u = [...prev]; u[u.length - 1] = { ...u[u.length - 1], text: NET[lang as 'ar'] }; return u; });
    } finally {
      setIsThinking(false);
      stateBus.patch({ thinking: false });
    }
  }, [inputText, isThinking, userId, light, lang]);
  const toggleListening = async () => {
    if (isListening) { voiceEngine.stopListening(); setIsListening(false); stateBus.patch({ listening: false }); }
    else { try { await voiceEngine.startListening(); setIsListening(true); stateBus.patch({ listening: true }); } catch {} }
  };
  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.entityWrapper}><ConsciousBeing size={Math.min(height * 0.3, 280)} /></View>
      <View style={styles.capBlock}>
        <View style={styles.wingsRow}>
          {WINGS.map(w => (
            <TouchableOpacity key={w.key} onPress={() => openWing(w.key)} style={[styles.wing, wing === w.key && { backgroundColor: colors.accent + '22', borderColor: colors.accent }]}>
              <w.Icon size={15} stroke={wing === w.key ? colors.accent : colors.textSecondary} />
              <Text style={[styles.wingText, { color: wing === w.key ? colors.accent : colors.textSecondary }]}>{rtl.isRTL ? w.label : w.key}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[styles.status, { color: colors.textSecondary }]}>
          {statusLine}{diag ? ` • ${diag}` : ''}
        </Text>
      </View>
      {activeWing && (
        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.panelHead}>
            <Text style={[styles.panelTitle, { color: colors.text }]}>{WINGS.find(w => w.key === activeWing)?.label}</Text>
            <TouchableOpacity onPress={() => setActiveWing(null)}><X size={20} stroke={colors.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 180 }}>
            {wingData.length === 0 && <Text style={{ color: colors.textSecondary, padding: 8 }}>لا بيانات بعد — سأتعلم منك.</Text>}
            {wingData.map((d, i) => (
              <View key={i} style={[styles.panelRow, { borderBottomColor: colors.border }]}>
                <Text style={{ color: colors.accent, fontSize: 11, width: 70 }}>{d.k}</Text>
                <Text style={{ color: colors.text, fontSize: 13, flex: 1 }}>{d.v}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
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
  entityWrapper: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.32, alignItems: 'center', justifyContent: 'center' },
  capBlock: { position: 'absolute', top: height * 0.31, left: 0, right: 0, alignItems: 'center' },
  wingsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, flexWrap: 'wrap', paddingHorizontal: 12 },
  wing: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: 'transparent' },
  wingText: { fontSize: 11 },
  status: { marginTop: 6, fontSize: 10, opacity: 0.75, textAlign: 'center', paddingHorizontal: 10 },
  panel: { position: 'absolute', top: height * 0.31 + 66, left: 14, right: 14, borderRadius: 18, borderWidth: 1, padding: 12, zIndex: 5 },
  panelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  panelTitle: { fontSize: 15, fontWeight: '700' },
  panelRow: { flexDirection: 'row', gap: 8, paddingVertical: 8, borderBottomWidth: 0.5 },
  conversationContainer: { flex: 1, marginTop: height * 0.31 + 70, paddingHorizontal: 20 },
  bubble: { maxWidth: '80%', padding: 14, borderRadius: 20, marginBottom: 8 },
  userBubble: { alignSelf: 'flex-end' },
  twinBubble: { alignSelf: 'flex-start' },
  msgText: { fontSize: 16 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 8, marginHorizontal: 14, marginBottom: 32, borderRadius: 24 },
  voiceBtn: { padding: 8 },
  input: { flex: 1, fontSize: 16, paddingHorizontal: 8 },
});
