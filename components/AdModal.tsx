/** AdModal v2.1 — مسارات صحيحة، أيقونات موجودة، اقتصاد محكوم. */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { useTwinStore } from '../store/useTwinStore';
import { useAppTheme } from '../engine/colors';
import { Play, X, Zap, Moon } from 'lucide-react-native';
import { adService } from '../src/services/AdService';
import { economyEngine } from '../src/services/EconomyEngine';
import { livingError } from '../lib/livingErrors';

interface AdModalProps { visible: boolean; onClose: () => void; mode?: 'energy' | 'capability'; capability?: string; }

export function AdModal({ visible, onClose, mode = 'energy', capability = 'general' }: AdModalProps) {
  const { lang } = useTwinStore();
  const theme = useAppTheme();
  const isAr = lang === 'ar';
  const isDark = theme.isDark;
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const [loading, setLoading] = useState(false);
  const [adLoaded, setAdLoaded] = useState(false);
  const [info, setInfo] = useState('');
  const [left, setLeft] = useState({ energy: 0, capability: 0, available: false });

  useEffect(() => {
    if (!visible) return;
    setInfo(''); setAdLoaded(false);
    economyEngine.refresh().then(s => setLeft({
      energy: s?.energyAdsLeft ?? 0, capability: s?.capabilityAdsLeft ?? 0, available: !!s?.adsAvailable,
    }));
    adService.loadAd().then(() => setAdLoaded(adService.isReady())).catch(() => setAdLoaded(false));
  }, [visible]);

  const remaining = mode === 'energy' ? left.energy : left.capability;

  const handleWatch = useCallback(async () => {
    setLoading(true); setInfo('');
    try {
      const res = await adService.showAd(undefined, mode, capability);
      setInfo(res.livingMessage || '');
      if (res.success) setTimeout(onClose, 1200);
    } catch (e) { setInfo(livingError(e)); }
    finally { setLoading(false); }
  }, [mode, capability, onClose]);

  const handleRest = useCallback(async () => {
    setLoading(true); setInfo('');
    try { const r = await economyEngine.takeRest(); setInfo(r.livingMessage); setTimeout(onClose, 1000); }
    catch (e) { setInfo(livingError(e)); }
    finally { setLoading(false); }
  }, [onClose]);

  const colors = {
    bg: isDark ? '#0F0A1A' : '#FAFAF8', card: isDark ? '#1A1226' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#1A1226', subtext: isDark ? '#A78BFA' : '#6B7280',
    accent: '#7C3AED', border: isDark ? '#2D1B4D' : '#E8E8E3',
    success: '#10B981', warning: '#F59E0B',
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={st.overlay}>
        <View style={[st.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={st.closeBtn}><X size={20} stroke={colors.subtext} /></TouchableOpacity>
          <Text style={[st.title, { color: colors.text }]}>{t('طاقتي تحتاج لحظة', 'My energy needs a moment')}</Text>
          <Text style={[st.body, { color: colors.subtext }]}>
            {t('يمكنني أن أرتاح قليلًا، أو أنتعش بمشاهدة إعلان، أو أفتح ساعة قدرات.',
               'I can rest, refresh with an ad, or open a capability hour.')}
          </Text>
          {left.available && remaining > 0 && (
            <TouchableOpacity style={[st.btn, { backgroundColor: adLoaded ? colors.accent : colors.border }]}
              onPress={handleWatch} disabled={loading || !adLoaded} activeOpacity={0.8}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Play size={18} stroke="#FFF" />}
              <Text style={st.btnText}>
                {mode === 'energy' ? t('أنتعش بمشاهدة إعلان', 'Refresh with an ad') : t('ساعة قدرات بإعلان', 'Capability hour via ad')}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[st.btn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border }]}
            onPress={handleRest} disabled={loading} activeOpacity={0.8}>
            <Moon size={18} stroke={colors.subtext} />
            <Text style={[st.btnText, { color: colors.subtext }]}>{t('أرتاح قليلًا', 'Rest a little')}</Text>
          </TouchableOpacity>
          {left.available && remaining === 0 && (
            <Text style={[st.note, { color: colors.warning }]}>{t('اكتفيت من الانتعاش اليوم. غدًا أعود بنشاط كامل.', 'Done refreshing today.')}</Text>
          )}
          {!!info && <Text style={[st.note, { color: colors.success }]}>{info}</Text>}
        </View>
      </View>
    </Modal>
  );
}
const st = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 24 },
  card: { borderRadius: 28, padding: 24, width: '100%', maxWidth: 380, borderWidth: 1 },
  closeBtn: { position: 'absolute', top: 14, right: 14, padding: 8 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  body: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 18, color: '#6B7280' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, marginBottom: 10 },
  btnText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
  note: { fontSize: 13, textAlign: 'center', marginTop: 6 },
});
