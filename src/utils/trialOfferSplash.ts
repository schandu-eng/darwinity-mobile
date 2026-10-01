import AsyncStorage from '@react-native-async-storage/async-storage';
import { isTrialAvailableFromStatus, trialDaysFromStatus } from '@/utils/trialAvailability';

const STORAGE_PREFIX = 'darwinity.trialOffer.seen.';

export function trialOfferStorageKey(userId: string | number): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export async function hasSeenTrialOfferSplash(userId: string | number | null | undefined): Promise<boolean> {
  if (!userId) return true;
  try {
    const value = await AsyncStorage.getItem(trialOfferStorageKey(userId));
    return value === '1';
  } catch {
    return true;
  }
}

export async function markTrialOfferSplashSeen(userId: string | number | null | undefined): Promise<void> {
  if (!userId) return;
  try {
    await AsyncStorage.setItem(trialOfferStorageKey(userId), '1');
  } catch {
    /* ignore */
  }
}

export function shouldOfferTrialSplash(
  status?: {
    trial_available?: boolean;
    trial_start_date?: string | null;
    is_pro?: boolean;
    is_trial?: boolean;
  } | null,
  country?: string | null,
): boolean {
  if (!status) return false;
  if (status.is_pro || status.is_trial) return false;
  return isTrialAvailableFromStatus(status, country);
}

export { trialDaysFromStatus };
