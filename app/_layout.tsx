import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { syncInitialTheme, useAppTheme } from '../engine/colors';
const g: any = global as any;
if (g.ErrorUtils) {
  const prev = g.ErrorUtils.getGlobalHandler ? g.ErrorUtils.getGlobalHandler() : null;
  g.ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
    try { console.error('[MYTWIN-FATAL]', String(error?.message), String(error?.stack || '').slice(0, 800)); } catch {}
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
  useEffect(() => { syncInitialTheme(); }, []);
  return <RootNavigator />;
}
