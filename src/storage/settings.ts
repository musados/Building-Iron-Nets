import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_URL_KEY = 'settings:serverUrl';
const AUTH_URL_KEY = 'settings:authUrl';

export async function getServerUrl(): Promise<string> {
  return (await AsyncStorage.getItem(SERVER_URL_KEY)) ?? '';
}

export async function setServerUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(SERVER_URL_KEY, url.trim());
}

export async function getAuthUrlSetting(): Promise<string> {
  return (await AsyncStorage.getItem(AUTH_URL_KEY)) ?? '';
}

export async function setAuthUrlSetting(url: string): Promise<void> {
  await AsyncStorage.setItem(AUTH_URL_KEY, url.trim());
}

/**
 * כתובת שירות ההתחברות. אם לא הוגדרה בנפרד — משתמשים בכתובת שרת העיבוד
 * (בפרודקשן Caddy מנתב /auth/* לשירות ה-auth תחת אותו דומיין).
 */
export async function resolveAuthUrl(): Promise<string> {
  return (await getAuthUrlSetting()) || (await getServerUrl());
}
