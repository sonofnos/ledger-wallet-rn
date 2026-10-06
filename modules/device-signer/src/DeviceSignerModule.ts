import { NativeModule, requireNativeModule } from 'expo';

import type { DeviceSignerEvents, DeviceSignerNativeModule } from './DeviceSigner.types';

declare class DeviceSignerModule
  extends NativeModule<DeviceSignerEvents>
  implements DeviceSignerNativeModule
{
  getOrCreatePublicKey(): Promise<string>;
  sign(payload: string): Promise<string>;
  isHardwareBacked(): Promise<boolean>;
}

export default requireNativeModule<DeviceSignerModule>('DeviceSigner');
