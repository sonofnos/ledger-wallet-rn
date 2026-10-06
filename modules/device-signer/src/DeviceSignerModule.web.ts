import { registerWebModule, NativeModule } from 'expo';

import type { DeviceSignerEvents, DeviceSignerNativeModule } from './DeviceSigner.types';

// Web has no Secure Enclave / Android Keystore and no biometric gate, so this
// is a software-only ECDSA key via WebCrypto purely to keep `expo start --web`
// previews from crashing. It is not representative of the real security
// story — that lives in the iOS/Android native implementations.
class DeviceSignerModule extends NativeModule<DeviceSignerEvents> implements DeviceSignerNativeModule {
  private keyPairPromise: Promise<CryptoKeyPair> | null = null;

  private getKeyPair(): Promise<CryptoKeyPair> {
    if (!this.keyPairPromise) {
      this.keyPairPromise = crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
      );
    }
    return this.keyPairPromise;
  }

  async getOrCreatePublicKey(): Promise<string> {
    const { publicKey } = await this.getKeyPair();
    const raw = await crypto.subtle.exportKey('raw', publicKey);
    return btoa(String.fromCharCode(...new Uint8Array(raw)));
  }

  async sign(payload: string): Promise<string> {
    const { privateKey } = await this.getKeyPair();
    const data = new TextEncoder().encode(payload);
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      data
    );
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }

  async isHardwareBacked(): Promise<boolean> {
    return false;
  }
}

export default registerWebModule(DeviceSignerModule, 'DeviceSignerModule');
