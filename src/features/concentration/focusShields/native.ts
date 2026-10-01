import { requireOptionalNativeModule } from 'expo-modules-core';
import Constants from 'expo-constants';
import { unsupportedPermissions, type FocusShieldPermissions } from './logic';

export type LauncherApp = {
  packageName: string;
  label: string;
};

type FocusShieldsNative = {
  isSupported: () => boolean;
  getPermissionStatus: () => Promise<FocusShieldPermissions>;
  openUsageAccessSettings: () => Promise<void>;
  openOverlaySettings: () => Promise<void>;
  openNotificationSettings: () => Promise<void>;
  listLauncherApps: () => Promise<LauncherApp[]>;
  getAppIcon: (packageName: string) => Promise<string | null>;
  applyShields: (packageNames: string[], overlay: boolean, overlayUntilMs: number) => Promise<void>;
  clearShields: () => Promise<void>;
  isShieldActive: () => Promise<boolean>;
};

const native = requireOptionalNativeModule<FocusShieldsNative>('FocusShields');

export function getSelfPackageName(): string | null {
  return Constants.expoConfig?.android?.package ?? null;
}

export function isFocusShieldNativeAvailable(): boolean {
  return Boolean(native?.isSupported?.());
}

export async function getFocusShieldPermissions(): Promise<FocusShieldPermissions> {
  if (!native) return unsupportedPermissions();
  try {
    const status = await native.getPermissionStatus();
    return {
      supported: Boolean(status.supported),
      usageGranted: Boolean(status.usageGranted),
      overlayGranted: Boolean(status.overlayGranted),
      notificationsGranted: Boolean(status.notificationsGranted),
    };
  } catch {
    return unsupportedPermissions();
  }
}

export async function openUsageAccessSettings(): Promise<void> {
  await native?.openUsageAccessSettings();
}

export async function openOverlaySettings(): Promise<void> {
  await native?.openOverlaySettings();
}

export async function openNotificationSettings(): Promise<void> {
  await native?.openNotificationSettings();
}

export async function listLauncherApps(): Promise<LauncherApp[]> {
  if (!native) return [];
  try {
    const apps = await native.listLauncherApps();
    return Array.isArray(apps) ? apps : [];
  } catch {
    return [];
  }
}

export async function getAppIcon(packageName: string): Promise<string | null> {
  if (!native) return null;
  try {
    return (await native.getAppIcon(packageName)) || null;
  } catch {
    return null;
  }
}

export async function applyNativeShields(
  packageNames: string[],
  overlay: boolean,
  overlayUntilMs: number
): Promise<void> {
  if (!native) return;
  await native.applyShields(packageNames, overlay, overlayUntilMs);
}

export async function clearNativeShields(): Promise<void> {
  if (!native) return;
  await native.clearShields();
}
