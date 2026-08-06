import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { syncInitialTheme, useAppTheme } from '../engine/colors';

const CRASH_KEY = 'mytwin-last-crash';
const g: any = global as any;
if (g.ErrorUtils) {
  const prev = g.ErrorUtils.getGlobalHandler ? g.ErrorUtils.getGlobalHandler() : null;
  g.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    try {
      console.error('[MYTWIN-FATAL]', String(error?.message), String(error?.stack || '').slice(0, 800));
      AsyncStorage.setItem(CRASH_KEY, JSON.stringify({ m: String(error?.message || ''), s: String(error?.stack || '').slice(0, 500), t: Date.now() }));
    } catch {}
    if (prev) prev(error, isFatal);
  });
}
function RootNavigator() {
  const { isDark } = useAppTheme();
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 400 }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="genesis" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="session-restore" />
          <Stack.Screen name="living-world" />
        </Stack>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
export default function RootLayout() {
  useEffect(() => {
    syncInitialTheme();
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CRASH_KEY);
        if (raw) {
          const c = JSON.parse(raw);
          await AsyncStorage.removeItem(CRASH_KEY);
          if (Date.now() - (c.t || 0) < 10 * 60 * 1000) {
            Alert.alert('تشخيص الكراش الأخير', `${c.m}\n---\n${c.s}`);
          }
        }
      } catch {}
    })();
  }, []);
  return <RootNavigator />;
}
