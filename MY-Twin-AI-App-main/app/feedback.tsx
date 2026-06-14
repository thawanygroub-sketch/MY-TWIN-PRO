import { SafeAreaView, View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTwinStore } from '../store/useTwinStore';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';
import { router } from 'expo-router';
import { ThumbsUp, ThumbsDown, ArrowLeft } from 'lucide-react-native';

export default function FeedbackDashboard() {
  const { lang, theme, userId } = useTwinStore();
  const isAr = lang === 'ar'; const isDark = theme === 'dark';
  const t = (ar: string, en: string) => isAr ? ar : en;
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase.from('message_feedback').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
      if (data) setFeedbacks(data);
      setLoading(false);
    })();
  }, [userId]);

  const bg = isDark ? '#1A1A1A' : '#F8F6F2';
  const card = isDark ? '#2A2A2A' : '#FFF';
  const border = isDark ? '#444' : '#F0F0F0';
  const txt = isDark ? '#FFF' : '#1A1A1A';
  const sub = isDark ? '#888' : '#666';
  const primary = isDark ? '#D8B4FE' : '#6B21A8';

  if (loading) return <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}><ActivityIndicator size="large" color={primary} style={{ marginTop: 80 }} /></SafeAreaView>;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <View style={[styles.header, { borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><ArrowLeft size={24} stroke={txt} /></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: txt }]}>{t('تقييمات المستخدم', 'User Feedback')}</Text>
        <View style={styles.backBtn} />
      </View>
      <FlatList
        data={feedbacks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<View style={{ alignItems: 'center', marginTop: 60 }}><Text style={[styles.emptyText, { color: sub }]}>{t('لا توجد تقييمات', 'No feedback yet')}</Text></View>}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
            <View style={styles.cardRow}>
              {item.rating === 'like' ? <ThumbsUp size={18} stroke="#10B981" /> : <ThumbsDown size={18} stroke="#EF4444" />}
              <Text style={[styles.cardText, { color: txt }]}>{item.message_id}</Text>
              <Text style={[styles.cardDate, { color: sub }]}>{new Date(item.created_at).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', flex: 1 },
  listContent: { padding: 16 },
  emptyText: { fontSize: 17, fontWeight: '600' },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardText: { fontSize: 14, flex: 1 },
  cardDate: { fontSize: 12 },
});
