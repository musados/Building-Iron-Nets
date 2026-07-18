import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';
import { strings } from '../src/i18n/strings';

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

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: strings.planViewerTitle }} />
      <WebView
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
});
