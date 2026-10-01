import { PermissionsAndroid, Platform } from 'react-native';
import {
  buildShieldCommand,
  shieldCommandsEqual,
  type FocusShieldSignal,
  type ShieldCommand,
} from './logic';
import {
  applyNativeShields,
  clearNativeShields,
  getFocusShieldPermissions,
  getSelfPackageName,
} from './native';
import { loadFocusShieldPrefs } from './storage';
import { getFocusShieldSignal } from './signal';

let lastCommand: ShieldCommand | null = null;
let inflight: Promise<void> | null = null;
let pending = false;

async function requestNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const version =
    typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  if (!Number.isFinite(version) || version < 33) return;
  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // Optional; overlay still works if the user denies notifications.
  }
}

async function execute(command: ShieldCommand): Promise<void> {
  if (command.type === 'clear') {
    await clearNativeShields();
    return;
  }
  await requestNotificationPermission();
  await applyNativeShields(command.packageNames, command.overlay, command.overlayUntilMs);
}

export function resetFocusShieldSync(): void {
  lastCommand = null;
}

export async function syncFocusShields(
  signal: FocusShieldSignal = getFocusShieldSignal()
): Promise<void> {
  if (inflight) {
    pending = true;
    return inflight;
  }

  inflight = (async () => {
    try {
      const [prefs, permissions] = await Promise.all([
        loadFocusShieldPrefs(),
        getFocusShieldPermissions(),
      ]);
      const self = getSelfPackageName();
      const command = buildShieldCommand({
        status: signal.status,
        phase: signal.phase,
        enabled: prefs.enabled,
        packageNames: prefs.packageNames,
        permissions,
        excludePackageNames: self ? [self] : [],
      });
      if (shieldCommandsEqual(lastCommand, command)) return;
      await execute(command);
      lastCommand = command;
    } catch (error) {
      console.warn('Focus shields sync failed', error);
      lastCommand = null;
    } finally {
      inflight = null;
      if (pending) {
        pending = false;
        void syncFocusShields();
      }
    }
  })();

  return inflight;
}
