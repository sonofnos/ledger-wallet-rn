import { Platform } from 'react-native';

// Overridable at build time via EAS/env (EXPO_PUBLIC_* vars are inlined at
// build time by Expo). Falls back to sensible per-platform localhost
// addresses for local development against the backend's `npm run dev`.
const DEFAULT_LOCAL_URL = Platform.select({
  android: 'http://10.0.2.2:3000',
  default: 'http://localhost:3000',
});

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_LOCAL_URL;
