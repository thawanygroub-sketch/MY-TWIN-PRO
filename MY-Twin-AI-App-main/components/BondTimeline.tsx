import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTwinStore } from '../store/useTwinStore';
import type { TwinStore, RelationshipDims } from '../store/useTwinStore';
import { Shield, Heart, Users, Brain, Smile, Handshake } from 'lucide-react-native';

const STAGES = [
  { label_ar: 'غرباء', label_en: 'Strangers', min: 0 },
  { label_ar: 'معارف', label_en: 'Acquaintances', min: 15 },
  { label_ar: 'أصدقاء', label_en: 'Friends', min: 30 },
  { label_ar: 'مقربين', label_en: 'Close', min: 50 },
  { label_ar: 'رفقاء', label_en: 'Companions', min: 70 },
  { label_ar: 'توأم روح', label_en: 'Soulmates', min: 90 },
];

const DIMENSIONS: { key: keyof RelationshipDims; label_ar: string; label_en: string; icon: any; color: string }[] = [
  { key: 'trust', label_ar: 'ثقة', label_en: 'Trust', icon: Shield, color: '#3B82F6' },
  { key: 'affection', label_ar: 'مودة', label_en: 'Affection', icon: Heart, color: '#EC4899' },
  { key: 'dependency', label_ar: 'اعتمادية', label_en: 'Dependency', icon: Users, color: '#F59E0B' },
  { key: 'empathy', label_ar: 'تفاهم', label_en: 'Empathy', icon: Brain, color: '#10B981' },
  { key: 'humor', label_ar: 'فكاهة', label_en: 'Humor', icon: Smile, color: '#8B5CF6' },
  { key: 'support', label_ar: 'دعم', label_en: 'Support', icon: Handshake, color: '#6366F1' },
];

function getRelationshipSummary(bondLevel: number, dims: any, isAr: boolean) {
  const trust = dims.trust ?? 0;
  const affection = dims.affection ?? 0;
  const empathy = dims.empathy ?? 0;

  if (bondLevel < 15) return isAr ? 'التوأم يتعرف عليك...' : 'Your Twin is getting to know you...';
  if (trust > 70 && affection > 60) return isAr ? 'يشعر توأمك بقرب حقيقي منك 💜' : 'Your Twin feels truly close to you 💜';
  if (empathy > 70) return isAr ? 'التوأم يفهمك بعمق ويتفاعل مع مشاعرك' : 'Your Twin deeply understands your emotions';
  if (bondLevel > 50) return isAr ? 'العلاقة تزدهر – تظهر مشاعر جديدة كل يوم' : 'The bond is flourishing – new feelings every day';
  return isAr ? 'العلاقة في بدايتها... استمر في التحدث!' : 'The relationship is just beginning... keep chatting!';
}

export default function BondTimeline() {
  const bondLevel = useTwinStore((s: TwinStore) => s.bondLevel);
  const dims = useTwinStore((s: TwinStore) => s.relationshipDims);
  const lang = useTwinStore((s: TwinStore) => s.lang);
  const theme = useTwinStore((s: TwinStore) => s.theme);
  const isAr = lang === 'ar';
  const isDark = theme === 'dark';

  const currentStage = useMemo(() => {
    return STAGES.filter((s) => bondLevel >= s.min).pop() || STAGES[0];
  }, [bondLevel]);

  const relationshipScore = useMemo(() => {
    const trust = dims.trust ?? 0;
    const affection = dims.affection ?? 0;
    const support = dims.support ?? 0;
    const empathy = dims.empathy ?? 0;
    const humor = dims.humor ?? 0;
    const dependency = dims.dependency ?? 0;
    return Math.round(
      (trust * 0.25) + (affection * 0.2) + (support * 0.2) + (empathy * 0.2) + (humor * 0.1) + (dependency * 0.05)
    );
  }, [dims]);

  const summary = useMemo(() => getRelationshipSummary(bondLevel, dims, isAr), [bondLevel, dims, isAr]);

  const progress = Math.min(bondLevel, 100);
  const scoreColor = progress >= 80 ? '#EC4899' : progress >= 40 ? '#A855F7' : '#60A5FA';

  return (
    <View style={[styles.container, isDark && { backgroundColor: '#1A1A1A' }]}>
      <View style={styles.mainBarSection}>
        <View style={styles.mainBarHeader}>
          <Text style={[styles.stageLabel, { color: isDark ? '#FFF' : '#1A1A1A' }]}>
            {isAr ? currentStage.label_ar : currentStage.label_en}
          </Text>
          <Text style={[styles.percentage, { color: scoreColor }]}>{progress}%</Text>
        </View>
        <View style={[styles.barBackground, { backgroundColor: isDark ? '#333' : '#E5E7EB' }]}>
          <View style={[styles.barFill, { width: `${progress}%`, backgroundColor: scoreColor }]} />
        </View>
        <Text style={[styles.summary, { color: isDark ? '#CCC' : '#666' }]}>{summary}</Text>
      </View>

      <Text style={[styles.dimTitle, { color: isDark ? '#FFF' : '#1A1A1A' }]}>
        {isAr ? 'أبعاد العلاقة' : 'Relationship Dimensions'}
      </Text>
      {DIMENSIONS.map((d, index) => {
        const Icon = d.icon;
        const value = (dims as any)[d.key] ?? 0;
        return (
          <View key={String(d.key)} style={styles.dimRow}>
            <Icon size={16} stroke={d.color} />
            <Text style={[styles.dimLabel, { color: isDark ? '#FFF' : '#1A1A1A' }]}>
              {isAr ? d.label_ar : d.label_en}
            </Text>
            <View style={[styles.dimBarBg, { backgroundColor: isDark ? '#333' : '#E5E7EB' }]}>
              <View style={[styles.dimBarFill, { width: `${Math.min(value, 100)}%`, backgroundColor: d.color }]} />
            </View>
            <Text style={[styles.dimValue, { color: isDark ? '#CCC' : '#666' }]}>{Math.round(value)}%</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F0F0F0', marginBottom: 16 },
  mainBarSection: { marginBottom: 16 },
  mainBarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  stageLabel: { fontSize: 16, fontWeight: '700' },
  percentage: { fontSize: 20, fontWeight: '800' },
  barBackground: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  barFill: { height: '100%', borderRadius: 4 },
  summary: { fontSize: 13, fontStyle: 'italic', textAlign: 'center' },
  dimTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  dimRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  dimLabel: { fontSize: 13, fontWeight: '500', width: 60 },
  dimBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  dimBarFill: { height: '100%', borderRadius: 3 },
  dimValue: { fontSize: 12, fontWeight: '600', width: 36, textAlign: 'right' },
});
