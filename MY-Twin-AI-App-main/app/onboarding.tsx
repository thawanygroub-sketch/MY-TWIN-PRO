import {
  SafeAreaView, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Alert, ActivityIndicator, TextInput, Modal
} from 'react-native';
import { useState, useRef, useEffect } from 'react';
import { router } from 'expo-router';
import { useTwinStore, TwinGender } from '../store/useTwinStore';
import { supabase } from '../lib/supabase';
import { Sparkles, ArrowLeft, ArrowRight, Check, Volume2 } from 'lucide-react-native';

const QUESTIONS = {
  ar: [
    { id:'1', q:'عندما تواجه مشكلة كبيرة، كيف تتعامل معها عادةً؟', options:['أحللها بهدوء','أثق بحدسي','أطلب المساعدة','أتجنبها مؤقتاً'] },
    { id:'2', q:'ما هو أكثر شيء يدفعك للاستمرار في الحياة؟', options:['تحقيق إنجاز','قضاء وقت مع الأحباء','النجاح المهني','تحقيق السلام الداخلي'] },
    { id:'3', q:'أي نوع من العلاقات تشعر أنه الأقرب لقلبك؟', options:['مستقرة وداعمة','مليئة بالمغامرات','مع العائلة والأصدقاء','أفضل الاعتماد على نفسي'] },
    { id:'4', q:'كيف تصف يومك المثالي؟', options:['منجزاً ومليئاً بالمهام','في الطبيعة أو أسترخي','مع العائلة والأصدقاء','أستمتع بها لكن أحتاج مساحتي'] },
    { id:'5', q:'ما هو أكبر خوف يراودك أحياناً؟', options:['الفشل في تحقيق أهدافي','أحياناً أقلق من فقدانهم','عدم تحقيق تأثير في العالم','أخشى فقدان استقلاليتي'] },
    { id:'6', q:'عندما تشعر بالضغط، ما هو أول شيء تفعله؟', options:['أبحث عن حل مباشر','أتحدث مع أحدهم','أشغل نفسي بشيء آخر','أبقى وحدي لأفكر'] },
    { id:'7', q:'ما هي القيمة الأكثر أهمية بالنسبة لك؟', options:['الذكاء والدهاء','السعادة العائلية','التأثير في العالم','الحرية الشخصية'] },
  ],
  en: [
    { id:'1', q:'When facing a big problem, how do you usually handle it?', options:['Analyze it calmly','Trust my intuition','Ask for help','Avoid it temporarily'] },
    { id:'2', q:'What drives you most to keep going in life?', options:['Achieving a goal','Spending time with loved ones','Professional success','Achieving inner peace'] },
    { id:'3', q:'Which type of relationship feels closest to your heart?', options:['Stable and supportive','Full of adventures','With family and friends','I prefer to rely on myself'] },
    { id:'4', q:'How would you describe your perfect day?', options:['Productive and full of tasks','In nature or relaxing','With family and friends','I enjoy them but need my space'] },
    { id:'5', q:'What is your biggest fear sometimes?', options:['Failure to achieve my goals','Sometimes I worry about losing them','Not making an impact on the world','Losing my independence'] },
    { id:'6', q:'When you feel stressed, what is the first thing you do?', options:['Look for a direct solution','Talk to someone','Distract myself with something else','Stay alone to think'] },
    { id:'7', q:'What is the most important value to you?', options:['Intelligence and cleverness','Family happiness','Making an impact on the world','Personal freedom'] },
  ],
};

const TRAIT_INFO: Record<string, { ar: string; en: string; emoji: string; color: string }> = {
  analytical: { ar: 'تحليلي', en: 'Analytical', emoji: '🧠', color: '#3B82F6' },
  emotional: { ar: 'عاطفي', en: 'Emotional', emoji: '❤️', color: '#EC4899' },
  social: { ar: 'اجتماعي', en: 'Social', emoji: '🤝', color: '#10B981' },
  independent: { ar: 'مستقل', en: 'Independent', emoji: '🦅', color: '#F59E0B' },
  ambitious: { ar: 'طموح', en: 'Ambitious', emoji: '🚀', color: '#8B5CF6' },
  calm: { ar: 'هادئ', en: 'Calm', emoji: '😌', color: '#6366F1' },
};

function analyzePersonality(answers: Record<string, string>, lang: string) {
  const traitMap: Record<string, Record<string, string[]>> = {
    ar: {
      analytical: ['أحللها بهدوء','منجزاً ومليئاً بالمهام','أبحث عن حل مباشر','الذكاء والدهاء'],
      emotional: ['أثق بحدسي','قضاء وقت مع الأحباء','أحياناً أقلق من فقدانهم','أتحدث مع أحدهم','السعادة العائلية'],
      social: ['أطلب المساعدة','مستقرة وداعمة','مع العائلة والأصدقاء','أستمتع بها لكن أحتاج مساحتي','التأثير في العالم'],
      independent: ['أتجنبها مؤقتاً','أفضل الاعتماد على نفسي','أبقى وحدي لأفكر','أشغل نفسي بشيء آخر','تحقيق السلام الداخلي','الحرية الشخصية'],
      ambitious: ['تحقيق إنجاز','النجاح المهني','منجزاً ومليئاً بالمهام','أبحث عن حل مباشر'],
      calm: ['أشغل نفسي بشيء آخر','في الطبيعة أو أسترخي','الراحة والاسترخاء'],
    },
    en: {
      analytical: ['Analyze it calmly','Productive and full of tasks','Look for a direct solution','Intelligence and cleverness'],
      emotional: ['Trust my intuition','Spending time with loved ones','Sometimes I worry about losing them','Talk to someone','Family happiness'],
      social: ['Ask for help','Stable and supportive','With family and friends','I enjoy them but need my space','Making an impact on the world'],
      independent: ['Avoid it temporarily','I prefer to rely on myself','Stay alone to think','Distract myself with something else','Achieving inner peace','Personal freedom'],
      ambitious: ['Achieving a goal','Professional success','Productive and full of tasks','Look for a direct solution'],
      calm: ['Distract myself with something else','In nature or relaxing','Rest and relaxation'],
    },
  };
  const map = traitMap[lang] || traitMap['ar'];
  const traits: Record<string, number> = { analytical:0, emotional:0, social:0, independent:0, ambitious:0, calm:0 };
  Object.values(answers).forEach(ans => { for (const [trait, options] of Object.entries(map)) { if (options.includes(ans)) traits[trait] += 2; } });
  const sorted = Object.entries(traits).sort((a,b) => b[1] - a[1]);
  return { traits, dominant: sorted[0][0], secondary: sorted[1][0] };
}
export default function Onboarding() {
  const { userId, twinName, twinGender, setTwinName, setTwinGender, addMessage, lang, theme } = useTwinStore();
  const isAr = lang === 'ar'; const isDark = theme === 'dark';
  const questions = QUESTIONS[lang as keyof typeof QUESTIONS] || QUESTIONS['ar'];

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [userName, setUserName] = useState('');
  const [freeInfo, setFreeInfo] = useState('');
  const [newTwinName, setNewTwinName] = useState(twinName || (isAr ? 'توأمك' : 'Your Twin'));
  const [newTwinGender, setNewTwinGender] = useState<TwinGender>(twinGender || 'female');
  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => { Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start(); }, [step]);

  const handleAnswer = (qId: string, opt: string) => {
    setAnswers(prev => ({ ...prev, [qId]: opt }));
    if (step < questions.length - 1) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => setStep(prev => prev + 1));
    }
  };

  const handleBack = () => { if (step > 0) { Animated.timing(fadeAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => setStep(prev => prev - 1)); } };
  const handleSkip = () => setStep(questions.length - 1);

  const handleFinalSubmit = async () => {
    if (!userName.trim()) { Alert.alert(isAr ? 'تنبيه' : 'Notice', isAr ? 'من فضلك أدخل اسمك' : 'Please enter your name'); return; }
    setLoading(true);
    try {
      let analysis = analyzePersonality(answers, lang);
      // ✅ محاولة تحليل LLM عبر API
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        try {
          const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/analyze-personality`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
            body: JSON.stringify({ answers, lang })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.analysis) analysis = data.analysis;
          }
        } catch {}
      }

      setAnalysisResult(analysis);
      setTwinName(newTwinName.trim() || (isAr ? 'توأمك' : 'Your Twin'));
      setTwinGender(newTwinGender);
      
      const { error } = await supabase.from('profiles').upsert({
        id: userId, 
        twin_name: newTwinName.trim() || (isAr ? 'توأمك' : 'Your Twin'),
        twin_gender: newTwinGender,
        full_name: userName.trim(), 
        onboarded: true,
        personality_analysis: analysis,
        free_info: freeInfo,
      });
      if (error) throw error;

      // تخزين كذاكرة دائمة
      const d = TRAIT_INFO[analysis.dominant];
      const s = TRAIT_INFO[analysis.secondary];
      const memoryContent = isAr
        ? `تحليل شخصية ${userName.trim()}: الطابع الأساسي ${d.ar}، الثانوي ${s.ar}.`
        : `Personality analysis for ${userName.trim()}: primary ${d.en}, secondary ${d.en}.`;
      await supabase.from('memories').insert({
        user_id: userId,
        content: memoryContent,
        importance: 0.9,
        emotion: 'neutral',
        memory_type: 'core'
      });
      
      setShowAnalysis(true);
    } catch (e: any) { 
      console.error('❌ فشل:', e);
      Alert.alert(isAr ? 'خطأ' : 'Error', e.message || (isAr ? 'فشل الحفظ' : 'Save failed')); 
    } finally { setLoading(false); }
  };

  const handleContinueToChat = () => {
    setShowAnalysis(false);
    const analysis = analysisResult;
    if (!analysis) { router.replace('/chat'); return; }
    const d = TRAIT_INFO[analysis.dominant];
    const s = TRAIT_INFO[analysis.secondary];
    const genderEmoji = newTwinGender === 'male' ? '♂️' : '♀️';
    const welcomeMsg = isAr
      ? `🎯 مرحباً ${userName.trim()}!\n\nأنا ${newTwinName.trim() || 'توأمك'} ${genderEmoji}\n\n**طابعك الأساسي:** ${d.emoji} ${d.ar}\n**الثانوي:** ${s.emoji} ${s.ar}\n\nأنا هنا لمساعدتك في رحلتك. اسألني أي شيء! 💜`
      : `🎯 Welcome ${userName.trim()}!\n\nI'm ${newTwinName.trim() || 'Your Twin'} ${genderEmoji}\n\n**Primary trait:** ${d.emoji} ${d.en}\n**Secondary:** ${s.emoji} ${s.en}\n\nI'm here to help you on your journey. Ask me anything! 💜`;
    addMessage({ role: 'twin', content: welcomeMsg, id: Math.random().toString(36).substr(2,9)+Date.now().toString(36), timestamp: Date.now() });
    router.replace('/chat');
  };

  const currentQ = questions[step];
  const isLastStep = step === questions.length - 1;

  return (
    <SafeAreaView style={[styles.safe, isDark && { backgroundColor: '#1A1A1A' }]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={[styles.card, isDark && { backgroundColor: '#2A2A2A', borderColor: '#444' }, { opacity: fadeAnim }]}>
          <View style={styles.headerRow}>
            <View style={styles.progressBar}>{questions.map((_, i) => (<View key={i} style={[styles.dot, i <= step && styles.dotActive]} />))}</View>
            {!isLastStep && (<TouchableOpacity onPress={handleSkip} style={styles.skipBtn}><Text style={[styles.skipText, isDark && { color: '#D8B4FE' }]}>{isAr ? 'تخطي' : 'Skip'}</Text><ArrowRight size={16} stroke={isDark ? '#D8B4FE' : '#6B21A8'} /></TouchableOpacity>)}
          </View>
          {!isLastStep ? (<>
            <Sparkles size={40} stroke={isDark ? '#D8B4FE' : '#6B21A8'} style={{ alignSelf:'center', marginBottom:20 }} />
            <Text style={[styles.question, isDark && { color:'#FFF' }]}>{currentQ.q}</Text>
            {currentQ.options.map((opt, i) => (<TouchableOpacity key={i} style={[styles.option, answers[currentQ.id]===opt && styles.selectedOption, isDark && { borderColor:'#444' }]} onPress={() => handleAnswer(currentQ.id, opt)}><Text style={[styles.optionText, isDark && { color:'#CCC' }]}>{opt}</Text></TouchableOpacity>))}
            {step > 0 && (<TouchableOpacity style={styles.backBtn} onPress={handleBack}><ArrowLeft size={18} stroke={isDark ? '#D8B4FE' : '#6B21A8'} /><Text style={[styles.backText, isDark && { color: '#D8B4FE' }]}>{isAr ? 'رجوع' : 'Back'}</Text></TouchableOpacity>)}
          </>) : (<>
            <Sparkles size={48} stroke={isDark ? '#D8B4FE' : '#6B21A8'} style={{ alignSelf:'center', marginBottom:20 }} />
            <Text style={[styles.title, isDark && { color:'#FFF' }]}>{isAr ? 'خطوة أخيرة!' : 'Final Step!'}</Text>
            <Text style={[styles.label, isDark && { color:'#CCC' }]}>{isAr ? 'ما اسمك؟' : 'What is your name?'}</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor:'#333', color:'#FFF', borderColor:'#444' }]} placeholder={isAr ? 'أدخل اسمك' : 'Enter your name'} placeholderTextColor="#999" value={userName} onChangeText={setUserName} />
            <Text style={[styles.label, isDark && { color:'#CCC' }]}>{isAr ? 'ماذا تريد أن تسمي توأمك؟' : 'What would you name your Twin?'}</Text>
            <TextInput style={[styles.input, isDark && { backgroundColor:'#333', color:'#FFF', borderColor:'#444' }]} placeholder={isAr ? 'اسم التوأم' : 'Twin name'} placeholderTextColor="#999" value={newTwinName} onChangeText={setNewTwinName} />
            <Text style={[styles.label, isDark && { color:'#CCC' }]}>{isAr ? 'اختر صوت توأمك' : 'Choose Twin Voice'}</Text>
            <View style={styles.genderRow}>
              <TouchableOpacity style={[styles.genderBtn, newTwinGender==='female' && styles.genderBtnActive]} onPress={() => setNewTwinGender('female')}><Text style={styles.genderEmoji}>♀️</Text><Volume2 size={20} stroke={newTwinGender==='female' ? '#6B21A8' : '#999'} /><Text style={[styles.genderText, newTwinGender==='female' && styles.genderTextActive]}>{isAr ? 'أنثى' : 'Female'}</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.genderBtn, newTwinGender==='male' && styles.genderBtnActive]} onPress={() => setNewTwinGender('male')}><Text style={styles.genderEmoji}>♂️</Text><Volume2 size={20} stroke={newTwinGender==='male' ? '#6B21A8' : '#999'} /><Text style={[styles.genderText, newTwinGender==='male' && styles.genderTextActive]}>{isAr ? 'ذكر' : 'Male'}</Text></TouchableOpacity>
            </View>
            <Text style={[styles.label, isDark && { color:'#CCC' }]}>{isAr ? 'أخبرني عن نفسك (اختياري)' : 'Tell me about yourself (optional)'}</Text>
            <TextInput style={[styles.textArea, isDark && { backgroundColor:'#333', color:'#FFF', borderColor:'#444' }]} placeholder={isAr ? 'اكتب بحرية...' : 'Write freely...'} placeholderTextColor="#999" value={freeInfo} onChangeText={setFreeInfo} multiline numberOfLines={4} />
            <TouchableOpacity style={[styles.submitBtn, (!userName.trim() || loading) && { opacity:0.6 }]} onPress={handleFinalSubmit} disabled={!userName.trim() || loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : (<><Check size={20} stroke="#FFF" /><Text style={styles.submitText}>{isAr ? 'ابدأ رحلتك' : 'Start Your Journey'}</Text></>)}
            </TouchableOpacity>
          </>)}
        </Animated.View>
      </ScrollView>
      <Modal visible={showAnalysis} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, isDark && { backgroundColor:'#2A2A2A' }]}>
            <Sparkles size={40} stroke="#A855F7" style={{ alignSelf:'center', marginBottom:16 }} />
            <Text style={[styles.modalTitle, isDark && { color:'#FFF' }]}>{isAr ? 'تم تحليل شخصيتك!' : 'Your Personality Analysis!'}</Text>
            {analysisResult && (<>
              <View style={styles.traitsRow}>
                <View style={[styles.traitCard, { borderColor: TRAIT_INFO[analysisResult.dominant]?.color }]}><Text style={styles.traitEmoji}>{TRAIT_INFO[analysisResult.dominant]?.emoji}</Text><Text style={[styles.traitLabel, isDark && { color:'#FFF' }]}>{isAr ? TRAIT_INFO[analysisResult.dominant]?.ar : TRAIT_INFO[analysisResult.dominant]?.en}</Text><Text style={styles.traitType}>{isAr ? 'الأساسي' : 'Primary'}</Text></View>
                <View style={[styles.traitCard, { borderColor: TRAIT_INFO[analysisResult.secondary]?.color }]}><Text style={styles.traitEmoji}>{TRAIT_INFO[analysisResult.secondary]?.emoji}</Text><Text style={[styles.traitLabel, isDark && { color:'#FFF' }]}>{isAr ? TRAIT_INFO[analysisResult.secondary]?.ar : TRAIT_INFO[analysisResult.secondary]?.en}</Text><Text style={styles.traitType}>{isAr ? 'الثانوي' : 'Secondary'}</Text></View>
              </View>
              <Text style={[styles.modalSubtext, isDark && { color:'#CCC' }]}>{isAr ? 'فهم شخصيتك يساعدني في أن أكون أقرب إليك 💜' : 'Understanding your personality helps me be closer to you 💜'}</Text>
            </>)}
            <TouchableOpacity style={styles.modalBtn} onPress={handleContinueToChat}><Check size={20} stroke="#FFF" /><Text style={styles.modalBtnText}>{isAr ? 'ابدأ المحادثة' : 'Start Chat'}</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#F0F0F0', elevation: 2 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  progressBar: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E0D9F5' },
  dotActive: { backgroundColor: '#6B21A8', width: 24 },
  skipBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  skipText: { color: '#6B21A8', fontWeight: '600', fontSize: 14 },
  question: { fontSize: 18, fontWeight: '700', color: '#1A1A1A', textAlign: 'center', marginBottom: 20 },
  option: { padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#E0D9F5', marginBottom: 10 },
  selectedOption: { borderColor: '#6B21A8', backgroundColor: '#F3F0FF' },
  optionText: { fontSize: 15, color: '#1A1A1A', textAlign: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, gap: 6 },
  backText: { color: '#6B21A8', fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 8, marginTop: 12 },
  input: { backgroundColor: '#F8F6F2', borderRadius: 12, padding: 14, fontSize: 15, color: '#1A1A1A', borderWidth: 1, borderColor: '#E0D9F5', marginBottom: 8 },
  genderRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  genderBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: '#E0D9F5', alignItems: 'center', gap: 8 },
  genderBtnActive: { borderColor: '#6B21A8', backgroundColor: '#F3F0FF' },
  genderEmoji: { fontSize: 24 },
  genderText: { fontSize: 15, fontWeight: '600', color: '#666' },
  genderTextActive: { color: '#6B21A8' },
  textArea: { backgroundColor: '#F8F6F2', borderRadius: 12, padding: 14, fontSize: 15, color: '#1A1A1A', borderWidth: 1, borderColor: '#E0D9F5', minHeight: 100, textAlignVertical: 'top', marginBottom: 20 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6B21A8', padding: 16, borderRadius: 12, gap: 8 },
  submitText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: { backgroundColor: '#FFF', borderRadius: 24, padding: 28, margin: 24, alignItems: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1A1A1A', textAlign: 'center', marginBottom: 20 },
  traitsRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  traitCard: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 2 },
  traitEmoji: { fontSize: 40, marginBottom: 8 },
  traitLabel: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' },
  traitType: { fontSize: 12, color: '#888', marginTop: 4 },
  modalSubtext: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  modalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#6B21A8', padding: 16, borderRadius: 14, gap: 8, width: '100%' },
  modalBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
});
