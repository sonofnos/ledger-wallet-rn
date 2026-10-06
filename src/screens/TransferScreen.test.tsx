import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { useTransfer } from '../api/hooks';
import { DeviceSigner } from '../../modules/device-signer/src';
import TransferScreen from './TransferScreen';

jest.mock('../api/hooks');
jest.mock('../../modules/device-signer/src', () => ({
  DeviceSigner: {
    getOrCreatePublicKey: jest.fn(),
    sign: jest.fn(),
    isHardwareBacked: jest.fn(),
  },
}));

const mockedUseTransfer = useTransfer as jest.MockedFunction<typeof useTransfer>;
const mockedSign = DeviceSigner.sign as jest.Mock;

function renderScreen(navigation = { goBack: jest.fn() }) {
  return render(
    // @ts-expect-error -- navigation/route props are irrelevant for this screen's own logic
    <TransferScreen navigation={navigation} route={{}} />
  ); // render() and fireEvent() are both async in this @testing-library/react-native version
}

describe('TransferScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('signs on-device before submitting the transfer', async () => {
    const mutateAsync = jest.fn().mockResolvedValue({ id: 'tx-1', status: 'completed' });
    // @ts-expect-error -- only the fields the component reads are provided
    mockedUseTransfer.mockReturnValue({ mutateAsync });
    mockedSign.mockResolvedValue('base64-signature');

    await renderScreen();

    await fireEvent.changeText(screen.getByPlaceholderText('0123456789'), '9876543210');
    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), '25.50');
    await fireEvent.press(screen.getByText('Confirm with Face ID / fingerprint'));

    await waitFor(() => expect(mockedSign).toHaveBeenCalledTimes(1));
    const signedPayload = JSON.parse(mockedSign.mock.calls[0][0]);
    expect(signedPayload.toAccountNumber).toBe('9876543210');
    expect(signedPayload.amountCents).toBe(2550);

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ toAccountNumber: '9876543210', amountCents: 2550 })
      )
    );
    expect(await screen.findByText('Transfer sent')).toBeTruthy();
  });

  it('rejects an invalid amount before attempting to sign', async () => {
    const mutateAsync = jest.fn();
    // @ts-expect-error -- only the fields the component reads are provided
    mockedUseTransfer.mockReturnValue({ mutateAsync });

    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText('0123456789'), '9876543210');
    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), '0');
    await fireEvent.press(screen.getByText('Confirm with Face ID / fingerprint'));

    expect(await screen.findByText('Enter a valid account number and amount.')).toBeTruthy();
    expect(mockedSign).not.toHaveBeenCalled();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('shows an error and stays on the form when biometric signing fails', async () => {
    const mutateAsync = jest.fn();
    // @ts-expect-error -- only the fields the component reads are provided
    mockedUseTransfer.mockReturnValue({ mutateAsync });
    mockedSign.mockRejectedValue(new Error('User cancelled biometric prompt'));

    await renderScreen();
    await fireEvent.changeText(screen.getByPlaceholderText('0123456789'), '9876543210');
    await fireEvent.changeText(screen.getByPlaceholderText('0.00'), '10');
    await fireEvent.press(screen.getByText('Confirm with Face ID / fingerprint'));

    expect(await screen.findByText('User cancelled biometric prompt')).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
