import { create } from 'zustand';
import { AppState, Platform } from 'react-native';
import type { CustomerInfo } from 'react-native-purchases';
import { subscriptionService } from '@/services/subscriptionService';
import type { BillingPlanStatus } from '@/services/subscriptionService';
import {
  FREE_TIER_LIMITS,
  mergeContentLimitsFromApi,
  type ContentLimits,
} from '@/utils/contentLimits';

const FOREGROUND_REFRESH_STALE_MS = 5 * 60 * 1000;
const CUSTOMER_INFO_REFRESH_DEBOUNCE_MS = 1500;

const computeIsPro = (status: BillingPlanStatus | null): boolean => {
  if (status && typeof status.is_pro === 'boolean') {
    return status.is_pro;
  }
  if (!status?.has_subscription) return false;
  if (status.plan_name === 'Free') return false;
  if (typeof status.plan_id === 'number' && status.plan_id === 1) return false;
  return true;
};

let refreshInFlight: Promise<BillingPlanStatus | null> | null = null;
let customerInfoListener: ((info: CustomerInfo) => void) | null = null;
let customerInfoRefreshTimer: ReturnType<typeof setTimeout> | null = null;

interface BillingPlanStoreState {
  userId: number | null;
  status: BillingPlanStatus | null;
  isPro: boolean;
  contentLimits: ContentLimits;
  isLoading: boolean;
  lastRefreshedAt: number | null;
  start: (userId: number) => Promise<BillingPlanStatus | null>;
  refresh: (opts?: { force?: boolean }) => Promise<BillingPlanStatus | null>;
  refreshIfStale: (opts?: { staleMs?: number }) => Promise<BillingPlanStatus | null>;
  reset: () => Promise<void>;
}

export const useBillingPlanStore = create<BillingPlanStoreState>((set, get) => ({
  userId: null,
  status: null,
  isPro: false,
  contentLimits: FREE_TIER_LIMITS,
  isLoading: false,
  lastRefreshedAt: null,

  start: async (userId: number) => {
    const currentUserId = get().userId;
    if (currentUserId !== userId) {
      set({
        userId,
        status: null,
        isPro: false,
        contentLimits: FREE_TIER_LIMITS,
        lastRefreshedAt: null,
      });
    } else {
      set({ userId });
    }

    if (Platform.OS !== 'web') {
      try {
        await subscriptionService.initialize(userId);
        if (!customerInfoListener) {
          customerInfoListener = () => {
            const activeUserId = get().userId;
            if (!activeUserId) return;
            if (customerInfoRefreshTimer) {
              clearTimeout(customerInfoRefreshTimer);
            }
            customerInfoRefreshTimer = setTimeout(() => {
              void get().refresh({ force: true });
              customerInfoRefreshTimer = null;
            }, CUSTOMER_INFO_REFRESH_DEBOUNCE_MS);
          };
          subscriptionService.addCustomerInfoListener(customerInfoListener);
        }
      } catch (error) {
        console.warn('Failed to initialize RevenueCat for subscription store:', error);
      }
    }

    return get().refresh({ force: true });
  },

  refresh: async (opts?: { force?: boolean }) => {
    const { userId, lastRefreshedAt } = get();
    if (!userId) return null;

    if (!opts?.force && lastRefreshedAt && Date.now() - lastRefreshedAt < 15_000) {
      return get().status;
    }

    if (refreshInFlight) return refreshInFlight;

    set({ isLoading: true });
    refreshInFlight = (async () => {
      try {
        const status = await subscriptionService.getBillingPlanStatus(userId);
        set({
          status,
          isPro: computeIsPro(status),
          contentLimits: mergeContentLimitsFromApi(status.content_limits),
          lastRefreshedAt: Date.now(),
        });
        return status;
      } catch (error) {
        const axiosError = error as { code?: string; message?: string };
        const timedOut = axiosError?.code === 'ECONNABORTED';
        if (timedOut) {
          console.warn('BillingPlan status refresh timed out; keeping last known status');
        } else {
          console.warn('Failed to refresh subscription status:', axiosError?.message || error);
        }
        return get().status;
      } finally {
        set({ isLoading: false });
        refreshInFlight = null;
      }
    })();

    return refreshInFlight;
  },

  refreshIfStale: async (opts?: { staleMs?: number }) => {
    const staleMs = opts?.staleMs ?? FOREGROUND_REFRESH_STALE_MS;
    const { userId, lastRefreshedAt } = get();
    if (!userId) return null;

    if (lastRefreshedAt && Date.now() - lastRefreshedAt < staleMs) {
      return get().status;
    }
    return get().refresh({ force: true });
  },

  reset: async () => {
    if (customerInfoRefreshTimer) {
      clearTimeout(customerInfoRefreshTimer);
      customerInfoRefreshTimer = null;
    }

    if (customerInfoListener) {
      try {
        subscriptionService.removeCustomerInfoListener(customerInfoListener);
      } catch {
        
      }
      customerInfoListener = null;
    }

    if (Platform.OS !== 'web') {
      await subscriptionService.reset();
    }

    refreshInFlight = null;
    set({
      userId: null,
      status: null,
      isPro: false,
      contentLimits: FREE_TIER_LIMITS,
      isLoading: false,
      lastRefreshedAt: null,
    });
  },
}));

type GlobalWithBillingPlanStoreListener = typeof globalThis & {
  __darwinityBillingPlanStoreAppStateListenerRegistered__?: boolean;
};
const globalWithListener = globalThis as GlobalWithBillingPlanStoreListener;

if (!globalWithListener.__darwinityBillingPlanStoreAppStateListenerRegistered__) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void useBillingPlanStore.getState().refreshIfStale();
    }
  });
  globalWithListener.__darwinityBillingPlanStoreAppStateListenerRegistered__ = true;
}
