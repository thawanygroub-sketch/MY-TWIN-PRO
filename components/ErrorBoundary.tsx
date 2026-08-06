import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
interface Props { children: React.ReactNode }
interface State { hasError: boolean; error: string | null }
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error: error.message || error.toString() }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('[MYTWIN-RENDER]', error.message, info.componentStack); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={s.root}>
          <Text style={s.title}>لحظة صعوبة عابرة.</Text>
          <Text style={s.sub}>أنا ما زلت هنا — هذا تشخيص داخلي:</Text>
          <ScrollView style={s.box}><Text style={s.msg}>{this.state.error}</Text></ScrollView>
          <TouchableOpacity style={s.btn} onPress={() => this.setState({ hasError: false, error: null })}>
            <Text style={s.btnText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', backgroundColor: '#0A0014', padding: 24 },
  title: { color: '#E9D5FF', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  sub: { color: '#6B5B8A', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  box: { backgroundColor: '#12002A', borderRadius: 14, padding: 14, maxHeight: 300 },
  msg: { color: '#FB7185', fontSize: 12, lineHeight: 18 },
  btn: { marginTop: 18, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#A855F740', alignItems: 'center' },
  btnText: { color: '#A855F7', fontWeight: '700' },
});
