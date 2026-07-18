import React from 'react';
import { I18nManager, Platform } from 'react-native';
import { Stack } from 'expo-router';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'he';
}

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#b45309' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#fdfcfa' },
      }}
    />
  );
}
