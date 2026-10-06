# Ledger Wallet (React Native / Expo)

A mobile wallet client built in Expo and TypeScript against a real backend ([ledger-wallet-api](../ledger-wallet-api)). Sign in, view balance and transaction history, and send money with a transfer confirmed by a device-bound biometric signature instead of a plain button tap.

Built as a portfolio project to demonstrate production-shaped React Native work: typed API integration, client-side state management, navigation, testing, a real custom native module in Swift and Kotlin, and an EAS Build/CI pipeline.

## Stack

- Expo SDK 57 (TypeScript, New Architecture enabled), React Navigation (native-stack)
- Zustand for auth/session state, TanStack React Query for server state (account balance, transactions, transfer mutation)
- expo-secure-store for persisting the auth token on-device
- A custom native module (`modules/device-signer`, built with the Expo Modules API) instead of a wrapped third-party library, see below
- Jest and React Native Testing Library, 18 tests covering pure logic, the API client, the auth store, and both screens' behavior, including mocking the native module
- EAS Build (`eas.json`: development/preview/production profiles) and GitHub Actions for CI (typecheck, lint, test) plus a manually-dispatched EAS Build workflow

## The native module: `modules/device-signer`

Most "native module experience" demos just wrap `expo-local-authentication`. This one writes the actual platform crypto.

- **iOS** (`ios/DeviceSignerModule.swift`): generates an EC P-256 key pair inside the Secure Enclave (`kSecAttrTokenIDSecureEnclave`), gated by an access-control policy requiring the current biometric enrollment (`.biometryCurrentSet`). Calling `sign()` hands the payload to `SecKeyCreateSignature` on that key. The OS surfaces the Face ID / Touch ID prompt automatically, no extra `LocalAuthentication` code needed. Falls back to a software-backed key with the same access-control gate if the Secure Enclave attribute is rejected (observed on some simulator configurations), logged plainly rather than silently claiming hardware backing it doesn't have.
- **Android** (`android/.../DeviceSignerModule.kt`): generates an EC key in the AndroidKeyStore with `setUserAuthenticationRequired(true)`. Unlike iOS, Android doesn't surface a prompt on its own. A key like this throws `UserNotAuthenticatedException` until a `BiometricPrompt` unlocks a `CryptoObject` wrapping the same `Signature` instance. That's why the Kotlin side is the bigger half of this bridge. Confirmed directly: running this on an emulator with no fingerprint enrolled throws `java.lang.IllegalStateException: At least one biometric must be enrolled to create keys requiring user authentication for every use`, caught and surfaced as an on-screen error rather than silently signing with an unprotected key.
- **Web** (`DeviceSignerModule.web.ts`): a software-only WebCrypto fallback so `expo start --web` doesn't crash. There is no biometric gate on web. This is not representative of the real security story; the native code is.

`DeviceSigner.sign(payload)` is used in the transfer flow (`src/screens/TransferScreen.tsx`) to produce an ECDSA signature over the transfer intent (recipient, amount, idempotency key) before submitting it. The private key never leaves hardware to produce that signature.

Because this module has real native code, Expo Go cannot run this app. It needs a development build:

```bash
npx expo run:ios      # or
npx expo run:android
```

or `eas build --profile development` for a cloud-built dev client.

## Running locally

```bash
npm install
# in a sibling terminal, start the backend (see ../ledger-wallet-api/README.md):
#   cd ../ledger-wallet-api && docker compose up -d && npm run dev
npx expo run:ios     # or npx expo run:android
```

The API base URL defaults to `http://localhost:3000` (iOS simulator) or `http://10.0.2.2:3000` (Android emulator). Override with `EXPO_PUBLIC_API_BASE_URL`. Demo login: `demo@ledgerwallet.app` / `Demo1234!`.

## Testing

```bash
npm run typecheck
npm run lint
npm test
```

18 tests: `apiRequest`'s auth-header and error-mapping behavior, the Zustand auth store's persist/hydrate/sign-out cycle against a mocked SecureStore, `formatMoney`'s currency formatting, and both screens' user-facing behavior. The transfer screen tests cover the full flow: invalid input is rejected before signing, signing happens before the transfer is submitted, and a failed biometric prompt surfaces its error without submitting anything.

## Real friction hit while building this

- `@testing-library/react-native` 14.x made `render()` and `fireEvent()` async, a change from earlier versions. Not awaiting them doesn't throw. It just silently lets the next line run against a stale render, which showed up as assertions failing with "0 calls" instead of a clear error. Every `render`/`fireEvent` call here is awaited.
- `@testing-library/react-native`'s `screen` singleton only becomes usable after `render()` resolves. Calling it from an un-awaited `render()` throws a generic "`render` function has not been called" that reads like a setup bug rather than a missing `await`.
- iOS Secure Enclave key generation isn't guaranteed to succeed in every simulator/CI combination. The Swift module falls back to a software EC key with the same biometric access-control gate instead of crashing, and reports which mode it's in via `isHardwareBacked()`.
- `expo run:ios`/`run:android` need `expo-dev-client` installed to work at all on this Expo SDK version. Without it the native build still succeeds, but the app launches to a hard "No script URL provided" error instead of the dev-client launcher, because there's no mechanism wired up to fetch the Metro bundle URL.
- Android's NDK resolution is version-exact: `local.properties`' `ndk.dir` has to point at the exact patch version `android/build.gradle` expects (`27.1.12297006` here), not just any installed NDK in the same major line.

## CI/CD

- `.github/workflows/ci.yml`: typecheck, lint and test on every push and PR.
- `.github/workflows/eas-build.yml`: manually-dispatched EAS Build (Android, iOS or all, any profile) via `expo/expo-github-action`, needs an `EXPO_TOKEN` repo secret.
- `eas.json`: `development` (dev client), `preview` (internal APK), `production` (app bundle, auto-incremented version) profiles.

## Deployment status

No Apple Developer account exists for this project, so there's no TestFlight distribution. The iOS evidence here is the simulator/dev-build flow and the native Secure Enclave code itself. Android is built via EAS and submitted to Google Play's Internal Testing track via EAS Submit.
