import * as SecureStore from 'expo-secure-store';

import { useAuthStore } from './authStore';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
});

const user = { id: '1', email: 'demo@ledgerwallet.app', fullName: 'Demo User' };

describe('authStore', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('starts hydrating with no session', () => {
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('signIn persists the token and user, and hydrate reads it back', async () => {
    await useAuthStore.getState().signIn('tok-abc', user);
    expect(useAuthStore.getState().token).toBe('tok-abc');
    expect(useAuthStore.getState().user).toEqual(user);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('ledger-wallet.auth-token', 'tok-abc');

    // simulate a fresh app launch reading back the persisted session
    useAuthStore.setState({ token: null, user: null, isHydrating: true });
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().token).toBe('tok-abc');
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('signOut clears the persisted session', async () => {
    await useAuthStore.getState().signIn('tok-abc', user);
    await useAuthStore.getState().signOut();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('ledger-wallet.auth-token');
  });

  it('hydrate leaves state signed-out when nothing was persisted', async () => {
    await useAuthStore.getState().hydrate();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().isHydrating).toBe(false);
  });
});
