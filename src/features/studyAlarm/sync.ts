import { PermissionsAndroid, Platform } from 'react-native';
import { pickNextAlarm } from './logic';
import { cancelNativeAlarm, configureNativeAlarm, getStudyAlarmPermissions } from './native';
import { loadStudyAlarmCaches, loadStudyAlarmStore, saveStudyAlarmStore } from './storage';

async function requestNotifications(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const version =
    typeof Platform.Version === 'number' ? Platform.Version : Number(Platform.Version);
  if (!Number.isFinite(version) || version < 33) return;
  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    /* optional */
  }
}

export async function syncStudyAlarmSchedule(): Promise<void> {
  const store = await loadStudyAlarmStore();
  const caches = await loadStudyAlarmCaches();
  const next = pickNextAlarm(store.alarms, caches);
  const permissions = await getStudyAlarmPermissions();
  const enabled = Boolean(next && permissions.supported);

  if (!enabled || !next) {
    await cancelNativeAlarm();
    if (store.scheduledId) {
      await saveStudyAlarmStore({ ...store, scheduledId: null }, { silent: true });
    }
    return;
  }
  await requestNotifications();
  await configureNativeAlarm(true, next.hour, next.minute, next.days);
  if (store.scheduledId !== next.id) {
    await saveStudyAlarmStore({ ...store, scheduledId: next.id }, { silent: true });
  }
}
