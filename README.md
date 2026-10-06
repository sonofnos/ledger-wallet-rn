# Ledger Wallet (React Native / Expo)

A mobile wallet client built in Expo + TypeScript against a real backend ([ledger-wallet-api](../ledger-wallet-api)): sign in, view balance and transaction history, and send money with a transfer confirmed by a **device-bound biometric signature**, not just a button tap.

Built as a portfolio project to demonstrate production-shaped React Native work: typed API integration, client-side state management, navigation, testing, a real custom native module (Swift + Kotlin), and an EAS Build/CI pipeline.

## Stack

- **Expo SDK 57** (TypeScript, New Architecture enabled), React Navigation (native-stack)
- **Zustand** for auth/session state, **TanStack React Query** for server state (account balance, transactions, transfer mutation)
- **expo-secure-store** for persisting the auth token on-device
- A **custom native module** (`modules/device-signer`, built with the Expo Modules API) rather than a wrapped third-party library — see below
- **Jest + React Native Testing Library** (18 tests: pure logic, the API client, the auth store, and both screens' behavior, including mocking the native module)
- **EAS Build** (`eas.json`: development/preview/production profiles) + **GitHub Actions** for CI (typecheck, lint, test) and a manually-dispatched EAS Build workflow

## The native module: `modules/device-signer`

Most "native module experience" demos just wrap `expo-local-authentication`. This one writes the actual platform crypto:

- **iOS** (`ios/DeviceSignerModule.swift`): generates an EC P-256 key pair inside the **Secure Enclave** (`kSecAttrTokenIDSecureEnclave`), gated by an access-control policy requiring the current biometric enrollment (`.biometryCurrentSet`). Calling `sign()` hands the payload to `SecKeyCreateSignature` on that key — the OS surfaces the Face ID / Touch ID prompt automatically, no extra `LocalAuthentication` code needed. Falls back to a software-backed key with the same access-control gate if the Secure Enclave attribute is rejected (observed on some simulator configurations) — logged plainly rather than silently claiming hardware backing it doesn't have.
- **Android** (`android/.../DeviceSignerModule.kt`): generates an EC key in the **AndroidKeyStore** with `setUserAuthenticationRequired(true)`. Unlike iOS, Android does *not* surface a prompt on its own — a key like this throws `UserNotAuthenticatedException` until a `BiometricPrompt` unlocks a `CryptoObject` wrapping the same `Signature` instance, which is why the Kotlin side is the bigger half of this bridge.
- **Web** (`DeviceSignerModule.web.ts`): a software-only WebCrypto fallback purely so `expo start --web` doesn't crash. No biometric gate exists on web — this is explicitly not representative of the real security story, which is the point of writing this natively rather than reaching for a JS-only library.

`DeviceSigner.sign(payload)` is used in the transfer flow (`src/screens/TransferScreen.tsx`) to produce an ECDSA signature over the transfer intent (recipient, amount, idempotency key) before submitting it — a device-bound proof of intent that the private key never leaves hardware to produce.

Because this module has real native code, **Expo Go cannot run this app** — it needs a development build:

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

The API base URL defaults to `http://localhost:4000` (iOS simulator) / `http://10.0.2.2:4000` (Android emulator) — override with `EXPO_PUBLIC_API_BASE_URL`. Demo login: `demo@ledgerwallet.app` / `Demo1234!`.

## Testing

```bash
npm run typecheck
npm run lint
npm test
```

18 tests: `apiRequest`'s auth-header/error-mapping behavior, the Zustand auth store's persist/hydrate/sign-out cycle against a mocked SecureStore, `formatMoney`'s currency formatting, and both screens' user-facing behavior (login success/failure, and the transfer screen's full flow — invalid input is rejected before signing, signing happens before the transfer is submitted, and a failed biometric prompt surfaces its error without submitting).

## Real friction hit while building this

- `@testing-library/react-native` 14.x made `render()` **and** `fireEvent()` async (a change from earlier versions) — not awaiting them doesn't throw, it just silently lets the next line run against a stale render, which showed up as assertions failing with "0 calls" instead of a clear error. Every `render`/`fireEvent` call here is awaited.
- `@testing-library/react-native`'s `screen` singleton only becomes usable *after* `render()` resolves — calling it from an un-awaited `render()` throws a generic "`render` function has not been called" that looks like a setup bug rather than a missing `await`.
- iOS Secure Enclave key generation isn't guaranteed to succeed in every simulator/CI combination; the Swift module falls back to a software EC key with the same biometric access-control gate rather than crashing, and reports which mode it's in via `isHardwareBacked()`.

## CI/CD

- `.github/workflows/ci.yml`: typecheck + lint + test on every push/PR.
- `.github/workflows/eas-build.yml`: manually-dispatched EAS Build (Android/iOS/all, any profile) via `expo/expo-github-action`, needs an `EXPO_TOKEN` repo secret.
- `eas.json`: `development` (dev client), `preview` (internal APK), `production` (app bundle, auto-incremented version) profiles.

## Deployment status

No Apple Developer account exists for this project, so there's no TestFlight distribution — iOS evidence here is the simulator/dev-build flow and the native Secure Enclave code itself. The plan for Android is an EAS production build submitted to Google Play's **Internal Testing** track via EAS Submit; see the repo's commit history / release notes for whether that step has completed.
