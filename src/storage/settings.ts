import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL_KEY = 'settings:serverUrl';

export async function getServerUrl(): Promise<string> {
  return (await AsyncStorage.getItem(SERVER_URL_KEY)) ?? '';
}

export async function setServerUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(SERVER_URL_KEY, url.trim());
}
