import { requireOptionalNativeModule } from 'expo-modules-core';

export type StudyAlarmPermissions = {
  supported: boolean;
  exactAlarmGranted: boolean;
  fullScreenGranted: boolean;
  notificationsGranted: boolean;
};

type StudyAlarmNative = {
  isSupported: () => boolean;
  getPermissionStatus: () => Promise<StudyAlarmPermissions>;
  openExactAlarmSettings: () => Promise<void>;
  configure: (enabled: boolean, hour: number, minute: number, days: number[]) => Promise<void>;
  cancel: () => Promise<void>;
  stopRinging: () => Promise<void>;
  isRinging: () => Promise<boolean>;
  consumePendingRing: () => Promise<boolean>;
  addListener?: (eventName: string, cb: () => void) => { remove: () => void };
};

const native = requireOptionalNativeModule<StudyAlarmNative>('StudyAlarm');

export function isStudyAlarmNativeAvailable(): boolean {
  return Boolean(native?.isSupported?.());
}

export async function getStudyAlarmPermissions(): Promise<StudyAlarmPermissions> {
  if (!native) {
    return {
      supported: false,
      exactAlarmGranted: false,
      fullScreenGranted: false,
      notificationsGranted: false,
    };
  }
  try {
    return await native.getPermissionStatus();
  } catch {
    return {
      supported: false,
      exactAlarmGranted: false,
      fullScreenGranted: false,
      notificationsGranted: false,
    };
  }
}

export async function openExactAlarmSettings(): Promise<void> {
  await native?.openExactAlarmSettings();
}

export async function configureNativeAlarm(
  enabled: boolean,
  hour: number,
  minute: number,
  days: number[]
): Promise<void> {
  await native?.configure(enabled, hour, minute, days);
}

export async function cancelNativeAlarm(): Promise<void> {
  await native?.cancel();
}

export async function stopNativeRinging(): Promise<void> {
  await native?.stopRinging();
}

export async function consumePendingRing(): Promise<boolean> {
  if (!native) return false;
  try {
    return Boolean(await native.consumePendingRing());
  } catch {
    return false;
  }
}

export function subscribeStudyAlarmRing(listener: () => void): () => void {
  if (!native?.addListener) return () => undefined;
  const sub = native.addListener('onRing', listener);
  return () => sub.remove();
}
