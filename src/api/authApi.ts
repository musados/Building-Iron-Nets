/**
 * לקוח לשירות ה-Auth הנפרד (auth-server/main.py).
 * הקליינט שולח רק אסימוני זהות / קוד OAuth — האימות הקריפטוגרפי,
 * החלפת הקוד מול Google וניהול ה-refresh tokens נעשים בצד השרת.
 */
import { AuthUser } from '../auth/tokenStore';

export interface LoginResponse {
  user: AuthUser;
  accessToken: string;
  /** שניות */
  accessTokenExpiresIn: number;
  refreshToken: string;
}

export class AuthHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

async function post<T>(
  authUrl: string,
  path: string,
  body: unknown
): Promise<T> {
  const response = await fetch(`${normalizeBaseUrl(authUrl)}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let detail = '';
    try {
      const parsed = JSON.parse(await response.text());
      detail = typeof parsed.detail === 'string' ? parsed.detail : '';
    } catch {
      detail = '';
    }
    throw new AuthHttpError(
      response.status,
      detail || `שגיאת שרת התחברות (${response.status})`
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function loginWithApple(
  authUrl: string,
  idToken: string,
  fullName?: string
): Promise<LoginResponse> {
  return post<LoginResponse>(authUrl, '/auth/login', {
    provider: 'apple',
    idToken,
    fullName,
  });
}

export function loginWithGoogleCode(
  authUrl: string,
  params: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
    clientId: string;
  }
): Promise<LoginResponse> {
  return post<LoginResponse>(authUrl, '/auth/login', {
    provider: 'google',
    ...params,
  });
}

export function refreshSession(
  authUrl: string,
  refreshToken: string
): Promise<LoginResponse> {
  return post<LoginResponse>(authUrl, '/auth/refresh', { refreshToken });
}

export function logoutSession(
  authUrl: string,
  refreshToken: string
): Promise<void> {
  return post<void>(authUrl, '/auth/logout', { refreshToken });
}
