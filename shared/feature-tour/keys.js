/** Storage key prefixes and cross-platform event name for feature-tour state. */

export const TOUR_COMPLETED_PREFIX = 'snle_tour_completed_';
export const FEATURE_NEW_DISMISSED_PREFIX = 'snle_feature_new_dismissed_';
export const FEATURE_NEW_DISMISS_EVENT = 'snle:feature-new-dismissed';
export const TOUR_COMPLETED_EVENT = 'snle:tour-completed';

export function tourCompletedKey(tourId) {
  return `${TOUR_COMPLETED_PREFIX}${tourId}`;
}

export function featureNewDismissedKey(featureId) {
  return `${FEATURE_NEW_DISMISSED_PREFIX}${featureId}`;
}
