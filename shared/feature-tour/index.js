export {
  TOUR_COMPLETED_PREFIX,
  FEATURE_NEW_DISMISSED_PREFIX,
  FEATURE_NEW_DISMISS_EVENT,
  TOUR_COMPLETED_EVENT,
  tourCompletedKey,
  featureNewDismissedKey,
} from './keys.js';

export {
  isTourCompletedFromValue,
  isFeatureNewVisible,
} from './visibility.js';

export {
  padRect,
  computeTooltipPosition,
  computeArrowOffset,
} from './positioning.js';

export { splitTourBodyForEmphasis } from './formatTourBody.js';

export {
  CARD_DECK_DECK_TOUR_ID,
  CARD_DECK_DECK_TOUR_STEPS,
} from './tours/cardDeckTour.js';

export {
  CARD_DECK_REEL_TOUR_ID,
  CARD_DECK_REEL_NEW_TAG_IDS,
  CARD_DECK_REEL_TOUR_STEPS,
} from './tours/cardDeckReelTour.js';

export {
  CARD_DECK_EDIT_TOUR_ID,
  CARD_DECK_EDIT_TOUR_STEPS,
} from './tours/cardDeckEditTour.js';

export {
  DASHBOARD_TOUR_ID,
  DASHBOARD_TOUR_STEPS,
  adaptDashboardTourSteps,
} from './tours/studyHubTour.js';

export {
  LEARNING_CONTENT_TOUR_ID,
  LEARNING_CONTENT_TOUR_STEPS,
  PHONE_CHAT_TOUR_BODY,
  adaptLearningContentTourSteps,
} from './tours/studyMaterialTour.js';

export {
  NOTES_STUDY_MODE_TOUR_ID,
  NOTES_STUDY_MODE_TOUR_STEPS,
} from './tours/notesStudyModeTour.js';
