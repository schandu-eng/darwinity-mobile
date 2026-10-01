import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark';

const THEME_MODE_KEY = '@darwinity_theme_mode';

function parseThemeMode(value: string | null | undefined): ThemeMode {
  return value === 'dark' ? 'dark' : 'light';
}

interface ThemeState {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  initializeTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeMode: 'light',
  setThemeMode: async (mode) => {
    const next = parseThemeMode(mode);
    set({ themeMode: next });
    try {
      await AsyncStorage.setItem(THEME_MODE_KEY, next);
    } catch {
      /* keep in-memory preference if persistence fails */
    }
  },
  initializeTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_MODE_KEY);
      set({ themeMode: parseThemeMode(stored) });
    } catch {
      set({ themeMode: 'light' });
    }
  },
}));

export const useAppTheme = (): ThemeMode => useThemeStore((state) => state.themeMode);
