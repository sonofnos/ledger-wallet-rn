export type DeviceSignerEvents = Record<string, never>;

export interface DeviceSignerNativeModule {
  getOrCreatePublicKey(): Promise<string>;
  sign(payload: string): Promise<string>;
  isHardwareBacked(): Promise<boolean>;
}
