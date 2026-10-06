import DeviceSignerModule from './DeviceSignerModule';

export type { DeviceSignerNativeModule } from './DeviceSigner.types';

/**
 * Device-bound transaction signing.
 *
 * Generates (once) an EC P-256 key pair inside the Secure Enclave on iOS or
 * the AndroidKeyStore on Android, gated behind the device's biometric
 * enrollment. `sign` produces an ECDSA signature over the given payload and
 * can only succeed after a Face ID / Touch ID / fingerprint check. The
 * private key material never leaves hardware and is never readable by JS.
 */
export const DeviceSigner = {
  getOrCreatePublicKey: (): Promise<string> => DeviceSignerModule.getOrCreatePublicKey(),
  sign: (payload: string): Promise<string> => DeviceSignerModule.sign(payload),
  isHardwareBacked: (): Promise<boolean> => DeviceSignerModule.isHardwareBacked(),
};
