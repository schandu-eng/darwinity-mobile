export const NOTES_STUDY_MODE_TOUR_ID = 'notes-study-mode';

/**
 * First-run tour for Notes practice highlighting (web).
 * Games / flashcard export CTAs were removed from the notes chrome;
 * practice starts from the highlighter on the formatting toolbar.
 */
export const NOTES_STUDY_MODE_TOUR_STEPS = [
  {
    id: 'revision-mark',
    title: 'Mark what to recall',
    body: 'Select a key word or short phrase, then tap the highlighter. Mark short phrases. Avoid whole sentences. Open Games from the sidebar to practice your marks.',
    placement: 'bottom',
    preferSelector: '[data-test="revisionMark"]',
  },
];
