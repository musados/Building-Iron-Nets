import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { strings } from '../src/i18n/strings';

// react-native-webview אינו נתמך בדפדפן — נטען רק בנייטיב
const NativeWebView =
  Platform.OS !== 'web'
    ? (require('react-native-webview').WebView as React.ComponentType<any>)
    : null;

export default function PlanViewerScreen() {
  const { uri } = useLocalSearchParams<{ uri?: string }>();

  if (!uri) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: strings.planViewerTitle }} />
        <Text style={styles.notFound}>{strings.orderNotFound}</Text>
      </View>
    );
  }

  if (Platform.OS === 'web' || !NativeWebView) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: strings.planViewerTitle }} />
        <Pressable
          style={styles.openBtn}
          onPress={() => window.open(uri, '_blank')}
        >
          <Text style={styles.openBtnText}>{strings.viewPlan}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: strings.planViewerTitle }} />
      <NativeWebView
        style={styles.flex}
        source={{ uri }}
        originWhitelist={['*']}
        allowFileAccess
        allowFileAccessFromFileURLs
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    fontSize: 16,
    color: '#888',
  },
  openBtn: {
    backgroundColor: '#b45309',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  openBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
