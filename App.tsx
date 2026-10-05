// Atlas + Expo quickstart — the NATIVE-SESSION flow.
//
// A React Native app has no cookie jar against the Frontend API, so instead of
// the web cookie session it uses a bearer session: run first-party OAuth in the
// system browser (expo-auth-session), exchange the resulting access token for an
// Atlas session (`exchangeForSession`), and hold it in a `NativeSessionManager`
// that auto-refreshes the rotating refresh token and persists it to
// expo-secure-store.
//
// NOTE: `@atlasauth/expo` also re-exports the headless React hooks and
// `<AtlasProvider>` from `@atlasauth/react` (useUser / useAuth / <SignedIn>),
// but the prebuilt `<SignIn>` / `<UserButton>` widgets render DOM and are
// web-only — build native screens with RN primitives + these helpers.
import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import {
  makeRedirectUri,
  useAuthRequest,
  exchangeCodeAsync,
  type AuthRequestPromptOptions,
} from 'expo-auth-session';
import {
  createSecureStoreTokenCache,
  tokenStorageFor,
  createNativeSessionManager,
  exchangeForSession,
  clearNativeSession,
  type NativeSessionManager,
} from '@atlasauth/expo';

WebBrowser.maybeCompleteAuthSession();

const FRONTEND_API = process.env.EXPO_PUBLIC_ATLAS_FRONTEND_API ?? 'https://atlasauth.net';
const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_ATLAS_PUBLISHABLE_KEY ?? '';
const CLIENT_ID = process.env.EXPO_PUBLIC_ATLAS_OAUTH_CLIENT_ID ?? '';

const discovery = {
  authorizationEndpoint: `${FRONTEND_API}/oauth2/authorize`,
  tokenEndpoint: `${FRONTEND_API}/oauth2/token`,
};

// One secure-store slot, dedicated to the native session (separate from any
// AtlasProvider session slot).
const tokenCache = createSecureStoreTokenCache(SecureStore);
const sessionStorage = tokenStorageFor(tokenCache, 'atlas.native-session');

export default function App() {
  const [manager, setManager] = useState<NativeSessionManager | null>(null);
  const [status, setStatus] = useState('Loading…');

  const redirectUri = makeRedirectUri({ scheme: 'atlasexpo' });
  const [request, , promptAsync] = useAuthRequest(
    { clientId: CLIENT_ID, scopes: ['openid', 'profile', 'email'], redirectUri },
    discovery,
  );

  // Rehydrate the manager from secure store on boot.
  useEffect(() => {
    void (async () => {
      const m = await createNativeSessionManager({
        frontendApi: FRONTEND_API,
        publishableKey: PUBLISHABLE_KEY,
        clientId: CLIENT_ID,
        storage: sessionStorage,
      });
      setManager(m);
      setStatus(m.current ? 'Restored a session.' : 'Signed out.');
    })();
  }, []);

  async function signIn(options?: AuthRequestPromptOptions) {
    if (!manager || !request) return;
    const result = await promptAsync(options);
    if (result.type !== 'success' || !result.params.code) return setStatus('Sign-in cancelled.');

    // Exchange the auth code (PKCE) for a first-party OAuth access token…
    const tokens = await exchangeCodeAsync(
      {
        clientId: CLIENT_ID,
        code: result.params.code,
        redirectUri,
        extraParams: request.codeVerifier ? { code_verifier: request.codeVerifier } : undefined,
      },
      discovery,
    );
    if (!tokens.accessToken) return setStatus('No access token.');

    // …then for an Atlas session, handed to the manager (which persists it).
    const session = await exchangeForSession({
      baseUrl: FRONTEND_API,
      clientId: CLIENT_ID,
      accessToken: tokens.accessToken,
    });
    if (!session) return setStatus('Session exchange failed.');
    manager.setSession(session);
    await loadUser();
  }

  async function loadUser() {
    if (!manager) return;
    // authHeaders() returns a fresh bearer (+ publishable key), auto-refreshing.
    const res = await fetch(`${FRONTEND_API}/v1/client`, { headers: await manager.authHeaders() });
    const body = await res.json().catch(() => null);
    setStatus(body?.user ? `Signed in as ${body.user.first_name ?? body.user.id}` : 'Signed out.');
  }

  async function signOut() {
    manager?.clear();
    await clearNativeSession(sessionStorage);
    setStatus('Signed out.');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Atlas + Expo</Text>
      <Text style={styles.status}>{status}</Text>
      <View style={styles.buttons}>
        <Button title="Sign in" disabled={!request || !manager} onPress={() => void signIn()} />
        <Button title="Reload user" onPress={() => void loadUser()} />
        <Button title="Sign out" onPress={() => void signOut()} />
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 24 },
  title: { fontSize: 24, fontWeight: '600' },
  status: { fontSize: 16, color: '#444', textAlign: 'center' },
  buttons: { gap: 12, width: '100%' },
});
