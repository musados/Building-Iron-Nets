/**
 * ניהול סשן ההתחברות בזיכרון: טעינה מהאחסון המאובטח, רענון טוקן גישה
 * לפני פקיעה (single-flight), התנתקות ועדכון מאזינים ל-UI.
 */
import {
  AuthHttpError,
  LoginResponse,
  logoutSession,
  refreshSession,
} from '../api/authApi';
import { resolveAuthUrl } from '../storage/settings';
import {
  AuthUser,
  StoredSession,
  loadStoredSession,
  persistSession,
} from './tokenStore';

let session: StoredSession | null = null;
let loadPromise: Promise<void> | null = null;
let refreshPromise: Promise<string> | null = null;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeToSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function initSession(): Promise<void> {
  if (!loadPromise) {
    loadPromise = loadStoredSession().then((stored) => {
      session = stored;
      notifyListeners();
    });
  }
  return loadPromise;
}

export function currentUser(): AuthUser | null {
  return session?.user ?? null;
}

export function isSignedIn(): boolean {
  return session != null;
}

export async function setSessionFromLogin(
  login: LoginResponse
): Promise<void> {
  session = {
    user: login.user,
    accessToken: login.accessToken,
    accessTokenExpiresAt: Date.now() + login.accessTokenExpiresIn * 1000,
    refreshToken: login.refreshToken,
  };
  await persistSession(session);
  notifyListeners();
}

async function clearSession(): Promise<void> {
  session = null;
  await persistSession(null);
  notifyListeners();
}

/** טוקן גישה תקף — מרענן אוטומטית אם עומד לפוג בתוך דקה. */
export async function getAccessToken(): Promise<string> {
  await initSession();
  if (!session) throw new Error('נדרשת התחברות');
  if (Date.now() < session.accessTokenExpiresAt - 60_000) {
    return session.accessToken;
  }
  return forceRefreshAccessToken();
}

export async function forceRefreshAccessToken(): Promise<string> {
  if (!session) throw new Error('נדרשת התחברות');
  if (!refreshPromise) {
    const refreshToken = session.refreshToken;
    refreshPromise = (async () => {
      try {
        const authUrl = await resolveAuthUrl();
        const login = await refreshSession(authUrl, refreshToken);
        await setSessionFromLogin(login);
        return login.accessToken;
      } catch (e) {
        // 401 = הרענון נדחה (פקיעה/ביטול) — הסשן אינו תקף יותר
        if (e instanceof AuthHttpError && e.status === 401) {
          await clearSession();
        }
        throw e;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function signOut(): Promise<void> {
  const refreshToken = session?.refreshToken;
  try {
    if (refreshToken) {
      const authUrl = await resolveAuthUrl();
      await logoutSession(authUrl, refreshToken);
    }
  } catch {
    // גם אם השרת לא זמין — מתנתקים מקומית
  } finally {
    await clearSession();
  }
}
