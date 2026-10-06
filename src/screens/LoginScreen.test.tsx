import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { login } from '../api/endpoints';
import { useAuthStore } from '../store/authStore';
import LoginScreen from './LoginScreen';

jest.mock('../api/endpoints');
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockedLogin = login as jest.MockedFunction<typeof login>;

function renderScreen() {
  return render(
    // @ts-expect-error -- navigation/route props are irrelevant for this screen's own logic
    <LoginScreen navigation={{}} route={{}} />
  ); // render() is async in this @testing-library/react-native version
}

describe('LoginScreen', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null, user: null, isHydrating: false });
    jest.clearAllMocks();
  });

  it('signs the user in on successful login', async () => {
    mockedLogin.mockResolvedValue({
      token: 'tok-123',
      user: { id: '1', email: 'demo@ledgerwallet.app', fullName: 'Demo User' },
    });

    await renderScreen();
    await fireEvent.press(screen.getByText('Sign in'));

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe('tok-123');
    });
  });

  it('shows the server error message on failed login', async () => {
    const { ApiError } = jest.requireActual('../types/api');
    mockedLogin.mockRejectedValue(new ApiError('Invalid credentials', 401));

    await renderScreen();
    await fireEvent.press(screen.getByText('Sign in'));

    expect(await screen.findByText('Invalid credentials')).toBeTruthy();
    expect(useAuthStore.getState().token).toBeNull();
  });
});
