# atlas-expo-quickstart

An Expo (React Native) app that signs in with the Atlas **native-session** flow,
using `@atlasauth/expo`.

## What's wired (`App.tsx`)

1. **OAuth in the system browser** — `expo-auth-session` runs the PKCE flow
   against the instance's `/oauth2/authorize` + `/oauth2/token` and returns a
   first-party OAuth access token.
2. **`exchangeForSession(...)`** turns that access token into an Atlas session.
3. **`createNativeSessionManager({ ..., storage })`** holds the session, lazily
   refreshes the (rotating) refresh token, and persists each rotation to
   `expo-secure-store` via `createSecureStoreTokenCache(SecureStore)` +
   `tokenStorageFor(...)`.
4. Authenticated calls use `await manager.authHeaders()` (a fresh bearer + the
   publishable key) against `/v1/client`.

`@atlasauth/expo` also re-exports the headless hooks + `<AtlasProvider>` from
`@atlasauth/react` (`useUser`, `useAuth`, `<SignedIn>`/`<SignedOut>`). The
prebuilt `<SignIn>` / `<UserButton>` widgets are **web-only** (they render DOM) —
native screens use RN primitives + these helpers, as shown here.

## Run

```sh
npm install
cp .env.example .env     # set EXPO_PUBLIC_* values; register atlasexpo:// as a redirect URI
npx expo start
```

Open in Expo Go or a dev build. The `atlasexpo://` scheme (in `app.json`) is the
OAuth redirect target.

## Packages

- `@atlasauth/expo` — `createSecureStoreTokenCache`, `tokenStorageFor`,
  `createNativeSessionManager`, `exchangeForSession`, `clearNativeSession`,
  `NativeSessionManager` (+ re-exported `@atlasauth/react` hooks)
- peers: `expo-auth-session`, `expo-secure-store`, `expo-web-browser`
