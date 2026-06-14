import React, { memo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Animated, Platform, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { Send, X, Camera, Image as ImageIcon, FileText, Search, Cloud, Music, Film, DollarSign, TrendingUp, Mic } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { ToolChip } from './ChatBubbles';

const SCREEN_WIDTH = require('react-native').Dimensions.get('window').width;

export const ChatInput = memo(({
  input, setInput, loading, isRTL, isDark, colors, lang,
  onSend, onToolAction, onCamera, onGallery, onFile,
  activeTools, onRemoveTool,
  showAttach, setShowAttach, attachAnim,
}: any) => {
  const [recording, setRecording] = useState(false);
  const [sttLoading, setSttLoading] = useState(false);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.granted) {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        setRecording(true);
        // بعد فترة قصيرة، توقف وأرسل للتحويل
        setTimeout(async () => {
          try {
            await recording.stopAndUnloadAsync();
            const uri = recording.getURI();
            if (uri) {
              setSttLoading(true);
              const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
              const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/stt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio: base64 }),
              });
              const data = await response.json();
              if (data.text) setInput(input + ' ' + data.text);
            }
          } catch (e) { console.warn(e); } finally { setRecording(false); setSttLoading(false); }
        }, 4000);
      }
    } catch (e) { console.warn('Mic error:', e); }
  };

  const unifiedMenu = [
    { icon: Camera, label_ar: 'كاميرا', label_en: 'Camera', color: '#8B5CF6', onPress: onCamera },
    { icon: ImageIcon, label_ar: 'معرض', label_en: 'Gallery', color: '#EC4899', onPress: onGallery },
    { icon: FileText, label_ar: 'ملف', label_en: 'File', color: '#F59E0B', onPress: onFile },
    { icon: Cloud, label_ar: 'طقس', label_en: 'Weather', color: '#06B6D4', tool: 'weather' },
    { icon: Music, label_ar: 'موسيقى', label_en: 'Music', color: '#EC4899', tool: 'spotify' },
    { icon: Film, label_ar: 'يوتيوب', label_en: 'YouTube', color: '#EF4444', tool: 'youtube' },
    { icon: DollarSign, label_ar: 'عملات', label_en: 'Currency', color: '#10B981', tool: 'currency' },
    { icon: TrendingUp, label_ar: 'أخبار', label_en: 'News', color: '#8B5CF6', tool: 'news' },
    { icon: Search, label_ar: 'بحث', label_en: 'Search', color: '#6366F1', tool: 'search' },
  ];

  return (
    <>
      {activeTools.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.chipsRow, { backgroundColor: colors.headerBg }]} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {activeTools.map((tool: any) => (<ToolChip key={tool.id} label={tool.label} icon={tool.icon} color={tool.color} onClose={() => onRemoveTool(tool.id)} />))}
        </ScrollView>
      )}

      <View style={[styles.inputBar, { backgroundColor: colors.headerBg, borderTopColor: colors.border }]}>
        <TouchableOpacity onPress={() => setShowAttach(true)} style={styles.addBtn}>
          <Text style={{ fontSize: 22, color: colors.subtext, fontWeight: '300' }}>+</Text>
        </TouchableOpacity>

        <TextInput
          style={[styles.textInput, isRTL && { textAlign: 'right' }, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
          value={input} onChangeText={setInput}
          placeholder={lang === 'ar' ? 'اكتب رسالتك...' : 'Message...'}
          placeholderTextColor={colors.subtext} multiline maxLength={2000} editable={!loading}
          onSubmitEditing={() => onSend()} />

        {/* زر الميكروفون */}
        <TouchableOpacity onPress={startRecording} style={[styles.micBtn, recording && { backgroundColor: '#EF4444' }]} disabled={sttLoading}>
          {sttLoading ? <ActivityIndicator size="small" color="#FFF" /> : <Mic size={20} stroke={recording ? '#FFF' : colors.subtext} />}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => onSend()} disabled={loading || (input.trim().length === 0 && !loading)}
          style={[styles.sendBtn, { backgroundColor: (input.trim().length > 0 && !loading) ? colors.sendActive : colors.sendInactive }]}>
          {loading ? <ActivityIndicator size="small" color={colors.subtext} /> : <Send size={22} stroke={isDark ? '#FFF' : '#FFF'} />}
        </TouchableOpacity>
      </View>

      <Modal visible={showAttach} transparent animationType="none" onRequestClose={() => setShowAttach(false)}>
        <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={() => setShowAttach(false)}>
          <Animated.View style={[styles.attachContainer, { backgroundColor: isDark ? '#2A2A2A' : '#FFF', transform: [{ translateY: attachAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }]}>
            <View style={styles.attachHeader}><Text style={[styles.attachTitle, { color: colors.text }]}>{lang === 'ar' ? 'إرفاق وأدوات' : 'Attach & Tools'}</Text><TouchableOpacity onPress={() => setShowAttach(false)}><X size={22} stroke={colors.subtext} /></TouchableOpacity></View>
            <View style={styles.attachGrid}>
              {unifiedMenu.map((item, idx) => (
                <TouchableOpacity key={idx} style={styles.attachItem} onPress={() => { setShowAttach(false); item.onPress ? item.onPress() : onToolAction({ type: item.tool, label: lang === 'ar' ? item.label_ar : item.label_en, icon: item.icon, color: item.color }); }}>
                  <View style={[styles.attachIconWrap, { backgroundColor: item.color + '20' }]}><item.icon size={26} stroke={item.color} /></View>
                  <Text style={[styles.attachLabel, { color: colors.text }]}>{lang === 'ar' ? item.label_ar : item.label_en}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  chipsRow: { paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: '#E5E5E5' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, borderTopWidth: 0.5, gap: 8 },
  addBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  textInput: { flex: 1, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, fontSize: 16, maxHeight: 120, minHeight: 44, borderWidth: 1 },
  micBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F5F5' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  attachOverlay: { flex: 1, justifyContent: 'flex-end' },
  attachContainer: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 34 },
  attachHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  attachTitle: { fontSize: 18, fontWeight: '700' },
  attachGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  attachItem: { width: (SCREEN_WIDTH - 80) / 3, alignItems: 'center', paddingVertical: 16, borderRadius: 16 },
  attachIconWrap: { width: 52, height: 52, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  attachLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
