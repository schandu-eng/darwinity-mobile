import {
  tourCompletedKey,
  isTourCompletedFromValue,
} from '@shared/feature-tour/index.js';
import { emitTourCompleted } from './featureNewEvents';
import { storageGet, storageRemove, storageSet } from './safeStorage';

const DEV_ALWAYS_SHOW_TOURS =
  process.env.EXPO_PUBLIC_ALWAYS_SHOW_TOURS === 'true';

export async function isTourCompleted(tourId: string): Promise<boolean> {
  if (!tourId) return false;
  const value = await storageGet(tourCompletedKey(tourId));
  return isTourCompletedFromValue(value, { forceShow: DEV_ALWAYS_SHOW_TOURS });
}

export async function markTourCompleted(tourId: string): Promise<void> {
  if (DEV_ALWAYS_SHOW_TOURS) return;
  if (!tourId) return;
  await storageSet(tourCompletedKey(tourId), '1');
  emitTourCompleted(tourId);
}

export async function resetTourCompletion(tourId: string): Promise<void> {
  if (!tourId) return;
  await storageRemove(tourCompletedKey(tourId));
}
