import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthToken, setAuthUser, setUnauthorizedHandler, hydrateAuthTokenCache } from '@/api/client';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import { useOnboardingStore } from './welcomeFlowStore';
import { useBillingPlanStore } from './subscriptionStore';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  welcomeMessage: string | null;
  setUser: (user: User | null) => Promise<void>;
  setToken: (token: string | null) => Promise<void>;
  setAuth: (user: User | null, token: string | null) => Promise<void>;
  setWelcomeMessage: (message: string | null) => void;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

const TOKEN_KEY = '@darwinity_token';
const USER_KEY = '@darwinity_user';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  welcomeMessage: null,
  setUser: async (user) => {
    await setAuthUser(user);
    set({ user, isAuthenticated: !!user });
  },
  setToken: async (token) => {
    await setAuthToken(token);
    set({ token, isAuthenticated: !!token });
  },
  setAuth: async (user, token) => {
    await setAuthToken(token);
    await setAuthUser(user);
    set({ user, token, isAuthenticated: !!user && !!token });
  },
  setWelcomeMessage: (message) => {
    set({ welcomeMessage: message });
  },
  logout: async () => {
    analytics.track(EVENTS.LOGOUT);
    analytics.reset();

    await useOnboardingStore.getState().resetOnboarding();
    await useBillingPlanStore.getState().reset();

    await setAuthToken(null);
    await setAuthUser(null);
    set({ user: null, token: null, isAuthenticated: false, welcomeMessage: null });
  },
  initializeAuth: async () => {
    let token: string | null = null;
    let user: User | null = null;
    try {
      const entries = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
      const values = new Map(entries);
      token = values.get(TOKEN_KEY) ?? null;
      const userString = values.get(USER_KEY);
      if (userString) {
        try {
          user = JSON.parse(userString);
        } catch {
          user = null;
        }
      }
    } catch {
      token = null;
      user = null;
    }
    hydrateAuthTokenCache(token);
    if (token) {
      set({ token, user, isAuthenticated: !!(user && token), isLoading: false });
    } else {
      set({ token: null, user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

setUnauthorizedHandler(() => {
  void (async () => {
    await useBillingPlanStore.getState().reset();
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      welcomeMessage: null,
      isLoading: false,
    });
  })();
});
