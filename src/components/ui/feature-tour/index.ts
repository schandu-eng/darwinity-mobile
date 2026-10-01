export { default as OnboardingTourProvider } from './OnboardingTourProvider';
export { default as TourAnchor } from './TourAnchor';
export { default as FeatureNewTag } from './FeatureNewTag';
export { default as useFeatureTour } from './useFeatureTour';
export { default as useTourCompleted } from './useTourCompleted';
export { isTourCompleted, markTourCompleted, resetTourCompletion } from './tourStorage';
export {
  isFeatureNewVisible,
  dismissFeatureNew,
  resetFeatureNew,
} from './featureNewStorage';

export {
  CARD_DECK_DECK_TOUR_ID,
  CARD_DECK_DECK_TOUR_STEPS,
  CARD_DECK_REEL_TOUR_ID,
  CARD_DECK_REEL_NEW_TAG_IDS,
  CARD_DECK_REEL_TOUR_STEPS,
  LEARNING_CONTENT_TOUR_ID,
  LEARNING_CONTENT_TOUR_STEPS,
  adaptLearningContentTourSteps,
  DASHBOARD_TOUR_ID,
  DASHBOARD_TOUR_STEPS,
  adaptDashboardTourSteps,
} from '@shared/feature-tour/index.js';

export type { TourStep, TourPlacement } from './types';
