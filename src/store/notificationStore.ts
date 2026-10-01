import { create } from 'zustand';

/**
 * Success toast host is gone (same product decision as web's no-op toaster).
 * Call sites can keep using showSuccess without surfacing chrome.
 */
interface NotificationState {
  successMessage: string | null;
  showSuccess: (message: string) => void;
  clearSuccess: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  successMessage: null,
  showSuccess: () => {},
  clearSuccess: () => set({ successMessage: null }),
}));
