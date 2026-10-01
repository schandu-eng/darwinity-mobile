import {
  featureNewDismissedKey,
  isFeatureNewVisible as isFeatureNewVisibleShared,
} from '@shared/feature-tour/index.js';
import { isTourCompleted } from './tourStorage';
import { emitFeatureNewDismiss } from './featureNewEvents';
import { storageGet, storageRemove, storageSet } from './safeStorage';

async function isDismissed(featureId: string): Promise<boolean> {
  return (await storageGet(featureNewDismissedKey(featureId))) === '1';
}

export async function isFeatureNewVisible(
  featureId: string,
  { tourId }: { tourId?: string } = {},
): Promise<boolean> {
  const dismissed = await isDismissed(featureId);
  const tourCompleted = tourId ? await isTourCompleted(tourId) : false;
  return isFeatureNewVisibleShared(featureId, {
    isDismissed: dismissed,
    isTourCompleted: tourCompleted,
  });
}

export async function dismissFeatureNew(featureId: string): Promise<void> {
  if (!featureId) return;
  await storageSet(featureNewDismissedKey(featureId), '1');
  emitFeatureNewDismiss(featureId);
}

export async function resetFeatureNew(featureId: string): Promise<void> {
  if (!featureId) return;
  await storageRemove(featureNewDismissedKey(featureId));
}
