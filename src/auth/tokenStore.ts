/**
 * אחסון מאובטח של סשן ההתחברות במכשיר.
 * נייטיב: expo-secure-store (Keychain / Android Keystore).
 * ווב: localStorage — SecureStore אינו קיים בדפדפן; ה-refresh token מוגן
 * ברוטציה וזיהוי שימוש חוזר בצד השרת.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export interface AuthUser {
  id: string;
  provider: string;
  email: string | null;
  name: string | null;
}

export interface StoredSession {
  user: AuthUser;
  accessToken: string;
  /** epoch millis */
  accessTokenExpiresAt: number;
  refreshToken: string;
}

const SESSION_KEY = 'ironnets.session';

export async function loadStoredSession(): Promise<StoredSession | null> {
  try {
    const raw =
      Platform.OS === 'web'
        ? window.localStorage.getItem(SESSION_KEY)
        : await SecureStore.getItemAsync(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export async function persistSession(
  session: StoredSession | null
): Promise<void> {
  if (Platform.OS === 'web') {
    if (session) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_KEY);
    }
    return;
  }
  if (session) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  } else {
    await SecureStore.deleteItemAsync(SESSION_KEY);
  }
}
