import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_FOCUS_SHIELD_PREFS,
  FOCUS_SHIELD_STORAGE_KEY,
  parseFocusShieldPrefs,
  uniquePackageNames,
  type FocusShieldPrefs,
} from './logic';

const prefsListeners = new Set<() => void>();

export function subscribeFocusShieldPrefs(listener: () => void): () => void {
  prefsListeners.add(listener);
  return () => {
    prefsListeners.delete(listener);
  };
}

function notifyPrefs(): void {
  prefsListeners.forEach((listener) => listener());
}

export async function loadFocusShieldPrefs(): Promise<FocusShieldPrefs> {
  try {
    const raw = await AsyncStorage.getItem(FOCUS_SHIELD_STORAGE_KEY);
    return parseFocusShieldPrefs(raw);
  } catch {
    return { ...DEFAULT_FOCUS_SHIELD_PREFS };
  }
}

export async function saveFocusShieldPrefs(prefs: FocusShieldPrefs): Promise<FocusShieldPrefs> {
  const next: FocusShieldPrefs = {
    enabled: Boolean(prefs.enabled),
    packageNames: uniquePackageNames(prefs.packageNames),
  };
  await AsyncStorage.setItem(FOCUS_SHIELD_STORAGE_KEY, JSON.stringify(next));
  notifyPrefs();
  return next;
}

export async function setFocusShieldEnabled(enabled: boolean): Promise<FocusShieldPrefs> {
  const current = await loadFocusShieldPrefs();
  return saveFocusShieldPrefs({ ...current, enabled });
}

export async function setFocusShieldPackages(packageNames: string[]): Promise<FocusShieldPrefs> {
  const current = await loadFocusShieldPrefs();
  return saveFocusShieldPrefs({ ...current, packageNames });
}
