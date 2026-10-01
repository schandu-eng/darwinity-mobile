import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RECENT_FOLDERS_KEY = '@darwinity_recent_folders';
const MAX_RECENTS = 12;

interface RecentFoldersState {
  openOrder: number[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  markOpened: (folderId: number) => void;
}

export const useRecentFoldersStore = create<RecentFoldersState>((set, get) => ({
  openOrder: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(RECENT_FOLDERS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];

      if (!get().hydrated) {
        set({ openOrder: Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number') : [], hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },

  markOpened: (folderId: number) => {
    const next = [folderId, ...get().openOrder.filter((id) => id !== folderId)].slice(0, MAX_RECENTS);
    set({ openOrder: next, hydrated: true });
    AsyncStorage.setItem(RECENT_FOLDERS_KEY, JSON.stringify(next)).catch(() => {});
  },
}));
