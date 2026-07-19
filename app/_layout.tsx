import React from 'react';
import { I18nManager, Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import {
  useFonts,
  Heebo_400Regular,
  Heebo_500Medium,
  Heebo_600SemiBold,
  Heebo_700Bold,
  Heebo_800ExtraBold,
} from '@expo-google-fonts/heebo';
import { colors } from '../src/ui/theme';
import AppBar from '../src/components/ui/AppBar';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'he';
}

const pageBg = Platform.OS === 'web' ? colors.bgWeb : colors.bg;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Heebo_400Regular,
    Heebo_500Medium,
    Heebo_600SemiBold,
    Heebo_700Bold,
    Heebo_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: pageBg }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      {Platform.OS === 'web' && <AppBar />}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: pageBg },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontFamily: 'Heebo_800ExtraBold',
            fontSize: 18,
            color: colors.text,
          },
          contentStyle: { backgroundColor: pageBg },
        }}
      />
    </View>
  );
}
