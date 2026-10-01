import { clearNativeShields } from '@/features/concentration/focusShields/native';
import { resetFocusShieldSync } from '@/features/concentration/focusShields/sync';
import { cancelNativeAlarm, stopNativeRinging } from '@/features/studyAlarm/native';

/** Clear device-only study state before logout or account deletion. */
export async function clearLocalDeviceState(): Promise<void> {
  resetFocusShieldSync();
  try {
    await clearNativeShields();
  } catch {
    /* native module may be absent */
  }
  try {
    await stopNativeRinging();
    await cancelNativeAlarm();
  } catch {
    /* native module may be absent */
  }
}
