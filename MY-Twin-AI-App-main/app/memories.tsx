import {
  SafeAreaView, View, Text, StyleSheet, FlatList, ActivityIndicator,
  RefreshControl, TouchableOpacity, Alert
} from 'react-native';
import { useTwinStore } from '../store/useTwinStore';
import { supabase } from '../lib/supabase';
import { useState, useEffect, useCallback, useRef } from 'react';
import { router } from 'expo-router';
import {
  BrainCircuit, Heart, Star, Target, MessageCircle,
  Sparkles, Trophy, Smile, Moon, ArrowLeft, Trash2,
  Clock, Layers
} from 'lucide-react-native';

const EVENT_CONFIG: Record<string, { icon: any; color: string; label_ar: string; label_en: string }> = {
  memory: { icon: BrainCircuit, color: '#3B82F6', label_ar: 'ذكرى', label_en: 'Memory' },
  dream: { icon: Moon, color: '#8B5CF6', label_ar: 'حلم', label_en: 'Dream' },
  goal: { icon: Target, color: '#F59E0B', label_ar: 'هدف', label_en: 'Goal' },
  relationship: { icon: Heart, color: '#EC4899', label_ar: 'علاقة', label_en: 'Relationship' },
  achievement: { icon: Trophy, color: '#10B981', label_ar: 'إنجاز', label_en: 'Achievement' },
  emotion: { icon: Smile, color: '#F59E0B', label_ar: 'مشاعر', label_en: 'Emotion' },
  chat: { icon: MessageCircle, color: '#6B21A8', label_ar: 'محادثة', label_en: 'Chat' },
};

const MEMORY_CATEGORIES: Record<string, { icon: any; color: string; label_ar: string; label_en: string }> = {
  core: { icon: Sparkles, color: '#F59E0B', label_ar: 'أساسية', label_en: 'Core' },
  goal: { icon: Target, color: '#10B981', label_ar: 'هدف', label_en: 'Goal' },
  emotional: { icon: Heart, color: '#EC4899', label_ar: 'عاطفية', label_en: 'Emotional' },
  fact: { icon: BrainCircuit, color: '#3B82F6', label_ar: 'معلومة', label_en: 'Fact' },
  preference: { icon: Star, color: '#8B5CF6', label_ar: 'تفضيل', label_en: 'Preference' },
  daily: { icon: MessageCircle, color: '#6366F1', label_ar: 'يومية', label_en: 'Daily' },
  episodic: { icon: Clock, color: '#EC4899', label_ar: 'أحداث', label_en: 'Episodic' },
};

export default function MemoriesScreen() {
  const { lang, theme, userId } = useTwinStore();
  const isAr = lang === 'ar';
  const isDark = theme === 'dark';
  const t = (ar: string, en: string) => isAr ? ar : en;

  const [activeTab, setActiveTab] = useState<'memories' | 'timeline' | 'episodic'>('memories');
  const [memories, setMemories] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [episodic, setEpisodic] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const cancelledRef = useRef(false);

  const fetchData = useCallback(async (showRefresh = false) => {
    if (!userId) { setLoading(false); return; }
    if (showRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [memoriesRes, dreamsRes, goalsRes, emotionsRes, twinRes, episodicRes] = await Promise.all([
        supabase.from('memories').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
        supabase.from('dreams').select('*').eq('user_id', userId).limit(10),
        supabase.from('goals').select('*').eq('user_id', userId).limit(10),
        supabase.from('emotional_timeline').select('*').eq('user_id', userId).limit(15),
        supabase.from('twin_states').select('bond_level,updated_at').eq('user_id', userId).single(),
        supabase.from('memories').select('*').eq('user_id', userId).eq('memory_type', 'episodic').order('created_at', { ascending: false }).limit(20),
      ]);
      if (cancelledRef.current) return;

      setMemories(memoriesRes.data || []);
      setEpisodic(episodicRes.data || []);

      const all: any[] = [];
      (memoriesRes.data || []).forEach((m: any) => all.push({ id: `mem-${m.id}`, type: 'memory', title: m.content?.slice(0, 60), timestamp: m.created_at }));
      (dreamsRes.data || []).forEach((d: any) => all.push({ id: `dream-${d.id}`, type: 'dream', title: d.content?.slice(0, 60), timestamp: d.created_at }));
      (goalsRes.data || []).forEach((g: any) => all.push({ id: `goal-${g.id}`, type: 'goal', title: g.title, timestamp: g.created_at }));
      (emotionsRes.data || []).forEach((e: any) => { if (e.intensity > 0.6) all.push({ id: `emo-${e.id}`, type: 'emotion', title: e.primary_emotion, timestamp: e.created_at }); });
      const twinData = twinRes.data;
      if (twinData?.bond_level) {
        const b = twinData.bond_level;
        if (b >= 20) all.push({ id: 'rel-familiar', type: 'relationship', title: t('أصبحتما مألوفين', 'Became familiar'), timestamp: twinData.updated_at });
        if (b >= 50) all.push({ id: 'rel-friend', type: 'relationship', title: t('أصبحتما صديقين', 'Became friends'), timestamp: twinData.updated_at });
        if (b >= 80) all.push({ id: 'rel-soulmate', type: 'relationship', title: t('توأم روح', 'Soulmate'), timestamp: twinData.updated_at });
      }
      all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEvents(all);
    } catch (e) { console.error(e); }
    finally { if (!cancelledRef.current) { setLoading(false); setRefreshing(false); } }
  }, [userId]);

  useEffect(() => { cancelledRef.current = false; fetchData(); return () => { cancelledRef.current = true; }; }, [fetchData]);

  const bg = isDark ? '#1A1A1A' : '#F8F6F2';
  const card = isDark ? '#2A2A2A' : '#FFF';
  const border = isDark ? '#444' : '#F0F0F0';
  const txt = isDark ? '#FFF' : '#1A1A1A';
  const sub = isDark ? '#888' : '#666';
  const primary = isDark ? '#D8B4FE' : '#6B21A8';

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <View style={[styles.header, { borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ArrowLeft size={24} stroke={txt} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: txt }]}>{t('ذكرياتنا', 'Our Memories')}</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={[styles.tabs, { borderBottomColor: border }]}>
        {[
          { key: 'memories', icon: BrainCircuit, label: t('الذكريات', 'Memories') },
          { key: 'timeline', icon: Clock, label: t('الخط الزمني', 'Timeline') },
          { key: 'episodic', icon: Layers, label: t('الأحداث', 'Episodic') },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <tab.icon size={18} stroke={activeTab === tab.key ? primary : sub} />
            <Text style={[styles.tabText, { color: activeTab === tab.key ? primary : sub }]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'memories' ? (
        <FlatList
          data={memories}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} colors={[primary]} />}
          ListEmptyComponent={<View style={styles.empty}><BrainCircuit size={48} stroke={sub} /><Text style={[styles.emptyText, { color: sub }]}>{t('لا توجد ذكريات', 'No memories yet')}</Text></View>}
          renderItem={({ item }) => {
            const cat = MEMORY_CATEGORIES[item.memory_type] || MEMORY_CATEGORIES.daily;
            const Icon = cat.icon;
            return (
              <View style={[styles.memoryCard, { backgroundColor: card, borderColor: border }]}>
                <View style={[styles.memoryIcon, { backgroundColor: cat.color + '20' }]}><Icon size={16} color={cat.color} /></View>
                <View style={styles.memoryBody}>
                  <Text style={[styles.memoryContent, { color: txt }]}>{item.content}</Text>
                  <Text style={[styles.memoryDate, { color: sub }]}>{new Date(item.created_at).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}</Text>
                </View>
              </View>
            );
          }}
        />
      ) : activeTab === 'episodic' ? (
        <FlatList
          data={episodic}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<View style={styles.empty}><Clock size={48} stroke={sub} /><Text style={[styles.emptyText, { color: sub }]}>{t('لا توجد أحداث', 'No events yet')}</Text></View>}
          renderItem={({ item }) => (
            <View style={[styles.memoryCard, { backgroundColor: card, borderColor: border }]}>
              <View style={[styles.memoryIcon, { backgroundColor: '#EC489920' }]}><Clock size={16} color="#EC4899" /></View>
              <View style={styles.memoryBody}>
                <Text style={[styles.memoryContent, { color: txt }]}>{item.content}</Text>
                <Text style={[styles.memoryDate, { color: sub }]}>{new Date(item.created_at).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}</Text>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<View style={styles.empty}><Clock size={48} stroke={sub} /><Text style={[styles.emptyText, { color: sub }]}>{t('لا توجد أحداث', 'No events yet')}</Text></View>}
          renderItem={({ item, index }) => {
            const config = EVENT_CONFIG[item.type] || EVENT_CONFIG.chat;
            const Icon = config.icon;
            const isLast = index === events.length - 1;
            return (
              <View style={[styles.timelineRow, isAr && { flexDirection: 'row-reverse' }]}>
                <View style={styles.timelineLineCol}>
                  <View style={[styles.timelineDot, { backgroundColor: config.color }]} />
                  {!isLast && <View style={[styles.timelineConnector, { backgroundColor: isDark ? '#444' : '#E0D9F5' }]} />}
                </View>
                <View style={[styles.timelineCard, { backgroundColor: card, borderColor: border }]}>
                  <View style={styles.timelineCardHeader}>
                    <View style={[styles.timelineIcon, { backgroundColor: config.color + '20' }]}><Icon size={16} color={config.color} /></View>
                    <Text style={[styles.timelineTitle, { color: txt }]}>{item.title}</Text>
                    <Text style={[styles.timelineTime, { color: sub }]}>{new Date(item.timestamp).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', flex: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 14, gap: 8 },
  tabText: { fontSize: 15, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 40 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: 17, fontWeight: '600', marginTop: 16 },
  memoryCard: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10, gap: 12 },
  memoryIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  memoryBody: { flex: 1 },
  memoryContent: { fontSize: 15, lineHeight: 22, marginBottom: 6 },
  memoryDate: { fontSize: 11 },
  timelineRow: { flexDirection: 'row', marginBottom: 0 },
  timelineLineCol: { alignItems: 'center', width: 32, marginRight: 10 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineConnector: { width: 2, flex: 1, marginVertical: 4 },
  timelineCard: { flex: 1, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  timelineCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timelineIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  timelineTitle: { fontSize: 14, fontWeight: '600', flex: 1 },
  timelineTime: { fontSize: 11 },
});
