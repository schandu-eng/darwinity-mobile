import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  STUDY_ALARM_CACHE_KEY,
  STUDY_ALARM_STORAGE_KEY,
  alarmCacheKey,
  parseStudyAlarm,
  parseStudyAlarmCaches,
  parseStudyAlarmPrefs,
  parseStudyAlarmStore,
  type StudyAlarm,
  type StudyAlarmCache,
  type StudyAlarmPrefs,
  type StudyAlarmStore,
} from './logic';

const prefsListeners = new Set<() => void>();

export function subscribeStudyAlarmPrefs(listener: () => void): () => void {
  prefsListeners.add(listener);
  return () => {
    prefsListeners.delete(listener);
  };
}

function notify(): void {
  prefsListeners.forEach((listener) => listener());
}

export async function loadStudyAlarmStore(): Promise<StudyAlarmStore> {
  try {
    return parseStudyAlarmStore(await AsyncStorage.getItem(STUDY_ALARM_STORAGE_KEY));
  } catch {
    return parseStudyAlarmStore(null);
  }
}

export async function saveStudyAlarmStore(
  store: StudyAlarmStore,
  options?: { silent?: boolean }
): Promise<StudyAlarmStore> {
  const next: StudyAlarmStore = {
    alarms: store.alarms.map((alarm, index) => parseStudyAlarm(alarm, alarm.id || `alarm-${index}`)),
    scheduledId: store.scheduledId,
  };
  await AsyncStorage.setItem(STUDY_ALARM_STORAGE_KEY, JSON.stringify(next));
  if (!options?.silent) notify();
  return next;
}

export async function loadStudyAlarms(): Promise<StudyAlarm[]> {
  return (await loadStudyAlarmStore()).alarms;
}

export async function saveStudyAlarms(alarms: StudyAlarm[]): Promise<StudyAlarm[]> {
  const current = await loadStudyAlarmStore();
  const next = await saveStudyAlarmStore({ ...current, alarms });
  return next.alarms;
}

export async function loadStudyAlarmPrefs(): Promise<StudyAlarmPrefs> {
  const store = await loadStudyAlarmStore();
  const scheduled = store.alarms.find((alarm) => alarm.id === store.scheduledId);
  const enabled = store.alarms.find((alarm) => alarm.enabled);
  const alarm = scheduled ?? enabled ?? store.alarms[0];
  if (!alarm) return parseStudyAlarmPrefs(null);
  const { id: _id, ...prefs } = alarm;
  return prefs;
}

export async function saveStudyAlarmPrefs(prefs: StudyAlarmPrefs): Promise<StudyAlarmPrefs> {
  const store = await loadStudyAlarmStore();
  const targetId = store.scheduledId ?? store.alarms[0]?.id;
  const nextAlarms = store.alarms.length
    ? store.alarms.map((alarm) =>
        alarm.id === targetId ? parseStudyAlarm({ ...prefs, id: alarm.id }, alarm.id) : alarm
      )
    : [parseStudyAlarm(prefs, targetId)];
  const next = await saveStudyAlarmStore({ ...store, alarms: nextAlarms });
  const saved = next.alarms.find((alarm) => alarm.id === targetId) ?? next.alarms[0];
  return parseStudyAlarmPrefs(JSON.stringify(saved ?? prefs));
}

export async function loadStudyAlarmCaches(): Promise<Record<string, StudyAlarmCache>> {
  try {
    return parseStudyAlarmCaches(await AsyncStorage.getItem(STUDY_ALARM_CACHE_KEY));
  } catch {
    return {};
  }
}

export async function loadStudyAlarmCache(): Promise<StudyAlarmCache | null> {
  const [caches, store] = await Promise.all([loadStudyAlarmCaches(), loadStudyAlarmStore()]);
  const scheduled = store.alarms.find((alarm) => alarm.id === store.scheduledId);
  const alarm = scheduled ?? store.alarms.find((item) => item.enabled) ?? store.alarms[0];
  if (alarm?.contentId != null) {
    const keyed = caches[alarmCacheKey(alarm.mode, alarm.contentId)];
    if (keyed) return keyed;
  }
  return Object.values(caches)[0] ?? null;
}

export async function saveStudyAlarmCache(cache: StudyAlarmCache): Promise<void> {
  const caches = await loadStudyAlarmCaches();
  caches[alarmCacheKey(cache.mode, cache.contentId)] = cache;
  await AsyncStorage.setItem(STUDY_ALARM_CACHE_KEY, JSON.stringify({ byKey: caches }));
}

export async function clearStudyAlarmCache(): Promise<void> {
  await AsyncStorage.removeItem(STUDY_ALARM_CACHE_KEY);
}
