import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { setAuthToken } from '../api/client';
import type { User } from '../types/api';

const TOKEN_KEY = 'ledger-wallet.auth-token';
const USER_KEY = 'ledger-wallet.user';

interface AuthState {
  token: string | null;
  user: User | null;
  isHydrating: boolean;
  hydrate: () => Promise<void>;
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isHydrating: true,

  hydrate: async () => {
    const [token, userJson] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);
    if (token && userJson) {
      setAuthToken(token);
      set({ token, user: JSON.parse(userJson) as User, isHydrating: false });
    } else {
      set({ isHydrating: false });
    }
  },

  signIn: async (token, user) => {
    setAuthToken(token);
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    ]);
    set({ token, user });
  },

  signOut: async () => {
    setAuthToken(null);
    await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(USER_KEY)]);
    set({ token: null, user: null });
  },
}));
