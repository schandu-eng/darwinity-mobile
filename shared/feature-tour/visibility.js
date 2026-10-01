/**
 * Pure visibility helpers. Platforms supply stored values / flags;
 * this module does not touch localStorage or AsyncStorage.
 */

export function isTourCompletedFromValue(storedValue, { forceShow = false } = {}) {
  if (forceShow) return false;
  return storedValue === '1';
}

/**
 * @param {string} featureId
 * @param {{ isDismissed?: boolean, isTourCompleted?: boolean }} [options]
 */
export function isFeatureNewVisible(featureId, {
  isDismissed = false,
  isTourCompleted = false,
} = {}) {
  if (!featureId) return false;
  if (isDismissed) return false;
  if (isTourCompleted) return false;
  return true;
}
