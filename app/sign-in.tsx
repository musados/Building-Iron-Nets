import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Feather } from '@expo/vector-icons';
import {
  loginWithApple,
  loginWithGoogleCode,
  LoginResponse,
} from '../src/api/authApi';
import {
  currentUser,
  initSession,
  setSessionFromLogin,
  signOut,
  subscribeToSession,
} from '../src/auth/session';
import { pullOrdersFromServer } from '../src/sync/orderSync';
import {
  getAuthUrlSetting,
  resolveAuthUrl,
  setAuthUrlSetting,
} from '../src/storage/settings';
import { notify } from '../src/ui/alerts';
import { colors, hit, radius, shadow, spacing, type, typo } from '../src/ui/theme';
import Button from '../src/components/ui/Button';
import { strings } from '../src/i18n/strings';

// סוגר את חלון ה-OAuth בחזרה לאפליקציה (נדרש לזרימת Google בווב)
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

interface GoogleAuthConfig {
  iosClientId?: string;
  androidClientId?: string;
  webClientId?: string;
  /** סכימת ה-redirect של iOS (com.googleusercontent.apps.xxx) */
  iosUrlScheme?: string;
}

function googleConfig(): GoogleAuthConfig {
  return (
    (Constants.expoConfig?.extra?.googleAuth as GoogleAuthConfig | undefined) ??
    {}
  );
}

function googleClientId(): string {
  const cfg = googleConfig();
  return (
    Platform.select({
      ios: cfg.iosClientId,
      android: cfg.androidClientId,
      default: cfg.webClientId,
    }) ?? ''
  );
}

function googleRedirectUri(): string {
  const cfg = googleConfig();
  if (Platform.OS === 'ios' && cfg.iosUrlScheme) {
    // ה-client של Google ל-iOS דורש redirect בסכימת ה-reverse client id
    return `${cfg.iosUrlScheme}:/oauthredirect`;
  }
  return AuthSession.makeRedirectUri({ scheme: 'ironnets', path: 'sign-in' });
}

export default function SignInScreen() {
  const router = useRouter();
  const [user, setUser] = useState(currentUser());
  const [authUrl, setAuthUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const clientId = googleClientId();
  const redirectUri = googleRedirectUri();
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: clientId || 'missing-client-id',
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    GOOGLE_DISCOVERY
  );

  useEffect(() => {
    initSession().then(() => setUser(currentUser()));
    const unsubscribe = subscribeToSession(() => setUser(currentUser()));
    getAuthUrlSetting().then(setAuthUrl);
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync()
        .then(setAppleAvailable)
        .catch(() => setAppleAvailable(false));
    }
    return unsubscribe;
  }, []);

  const finishLogin = useCallback(
    async (login: LoginResponse) => {
      await setSessionFromLogin(login);
      try {
        const pulled = await pullOrdersFromServer();
        if (pulled > 0) notify(strings.syncPulled(pulled));
      } catch {
        // משיכת ההזמנות תנוסה שוב במסך הראשי
      }
      router.back();
    },
    [router]
  );

  const resolveUrl = useCallback(async (): Promise<string> => {
    await setAuthUrlSetting(authUrl);
    const url = await resolveAuthUrl();
    if (!url) {
      notify(strings.extractNeedsServer);
      return '';
    }
    return url;
  }, [authUrl]);

  // תשובת ה-OAuth של Google — מחליפים את הקוד בסשן דרך שירות ה-Auth
  useEffect(() => {
    if (!response) return;
    if (response.type === 'error') {
      notify(strings.signInFailed, response.error?.message);
      return;
    }
    if (response.type !== 'success' || !request) return;
    (async () => {
      setBusy(true);
      try {
        const url = await resolveUrl();
        if (!url) return;
        const login = await loginWithGoogleCode(url, {
          code: response.params.code,
          codeVerifier: request.codeVerifier ?? '',
          redirectUri,
          clientId,
        });
        await finishLogin(login);
      } catch (e) {
        notify(strings.signInFailed, e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const googleSignIn = () => {
    if (!clientId) {
      notify(strings.googleNotConfigured);
      return;
    }
    promptAsync();
  };

  const appleSignIn = async () => {
    setBusy(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error('Apple לא החזירה אסימון זהות');
      }
      const url = await resolveUrl();
      if (!url) return;
      // Apple מוסרת את השם רק בפעם הראשונה — מעבירים אותו לשרת לשמירה
      const fullName = [
        credential.fullName?.givenName,
        credential.fullName?.familyName,
      ]
        .filter(Boolean)
        .join(' ');
      const login = await loginWithApple(
        url,
        credential.identityToken,
        fullName || undefined
      );
      await finishLogin(login);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'ERR_REQUEST_CANCELED') {
        notify(strings.signInFailed, e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const doSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: strings.accountTitle }} />

      {user ? (
        <View style={styles.card}>
          <View style={styles.userRow}>
            <View style={styles.avatar}>
              <Feather name="user" size={24} color={colors.primary} />
            </View>
            <View style={styles.userTexts}>
              <Text style={[typo(type.caption), { color: colors.textSecondary }]}>
                {strings.signedInAs}
              </Text>
              <Text style={[typo(type.cardTitle), { color: colors.text }]}>
                {user.name || user.email || user.id}
              </Text>
              {user.email != null && user.name != null && (
                <Text
                  style={[typo(type.secondary), { color: colors.textSecondary }]}
                >
                  {user.email}
                </Text>
              )}
            </View>
          </View>
          <Button
            label={strings.syncNow}
            onPress={async () => {
              setBusy(true);
              try {
                const pulled = await pullOrdersFromServer();
                notify(strings.syncPulled(pulled));
              } catch (e) {
                notify(
                  strings.syncFailed,
                  e instanceof Error ? e.message : String(e)
                );
              } finally {
                setBusy(false);
              }
            }}
            variant="tonal"
            icon="refresh-cw"
            small
            loading={busy}
          />
          <Button
            label={strings.signOut}
            onPress={doSignOut}
            variant="gray"
            icon="log-out"
            small
            disabled={busy}
          />
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.heroIcon}>
            <Feather name="cloud" size={28} color={colors.primary} />
          </View>
          <Text
            style={[
              typo(type.cardTitle),
              { color: colors.text, textAlign: 'center' },
            ]}
          >
            {strings.signInTitle}
          </Text>
          <Text
            style={[
              typo(type.secondary),
              {
                color: colors.textSecondary,
                textAlign: 'center',
                lineHeight: 20,
              },
            ]}
          >
            {strings.signInHint}
          </Text>

          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              {Platform.OS === 'ios' && appleAvailable && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={
                    AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                  }
                  buttonStyle={
                    AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                  }
                  cornerRadius={12}
                  style={styles.appleButton}
                  onPress={appleSignIn}
                />
              )}
              <Button
                label={strings.signInWithGoogle}
                onPress={googleSignIn}
                variant="tonal"
                icon="log-in"
                disabled={!request}
              />
            </>
          )}

          <View style={styles.urlBlock}>
            <Text style={[typo(type.caption), { color: colors.textSecondary }]}>
              {strings.authUrlLabel}
            </Text>
            <TextInput
              style={[styles.input, typo(type.body)]}
              value={authUrl}
              onChangeText={setAuthUrl}
              placeholder={strings.authUrlPlaceholder}
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              textAlign="left"
            />
            <Text style={[typo(type.caption), { color: colors.textTertiary }]}>
              {strings.authUrlHint}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    padding: spacing.xl,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'stretch',
    ...shadow.card,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  appleButton: {
    height: hit.buttonPrimary,
    width: '100%',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userTexts: {
    flex: 1,
    gap: 2,
  },
  urlBlock: {
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.fillInput,
    borderRadius: radius.tile,
    paddingHorizontal: 12,
    minHeight: hit.input,
    color: colors.text,
  },
});
