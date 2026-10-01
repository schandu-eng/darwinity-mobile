export const LEARNING_CONTENT_TOUR_ID = 'learning-content-study-tabs';

export const PHONE_CHAT_TOUR_BODY =
  'Tap the Ask AI button to chat about this content: clarifications, summaries, or deeper explanations. Drag it if it is in the way.';

const PHONE_TAB_STEP_IDS = new Set(['notes', 'flashcards', 'quizzes', 'podcast']);

/**
 * Phone has no study-tools sidebar and no Chat tab in the bottom bar.
 * Chat is retargeted to the floating Ask AI control.
 * Bottom-tab steps sit above the tab bar (`top`); Chat sits above the FAB (`top`).
 * Mind map lives in the Notes/Map switcher under the header (`bottom`).
 */
export function adaptLearningContentTourSteps(
  steps,
  { isPhone = false, flowchartEnabled = true } = {},
) {
  let next = steps;
  if (isPhone) {
    next = next
      .filter((step) => step.id !== 'sidebar-tabs')
      .map((step) => {
        if (step.id === 'chat') {
          return {
            ...step,
            tab: 'summary',
            placement: 'top',
            body: PHONE_CHAT_TOUR_BODY,
          };
        }
        if (step.id === 'flowchart') {
          return { ...step, placement: 'bottom' };
        }
        if (PHONE_TAB_STEP_IDS.has(step.id)) {
          return { ...step, placement: 'top' };
        }
        return step;
      });
  }
  if (!flowchartEnabled) {
    next = next.filter((step) => step.id !== 'flowchart');
  }
  return next;
}

/**
 * First-run tour for content study tools.
 * Optional `tab` switches the content viewer to that study tab before measuring the anchor.
 * Mobile maps most step ids onto bottom-tab buttons (no in-place tab panels).
 * Chat on phone anchors the floating Ask AI CTA instead (Chat is not in the bottom bar).
 * Mind map on phone is the Notes/Map switcher. Podcast is a study-tab on phone.
 */
export const LEARNING_CONTENT_TOUR_STEPS = [
  {
    id: 'sidebar-tabs',
    title: 'Study tools',
    body: 'Jump between Notes, Mind map, Test yourself, Flashcards, Podcast, Games, and Chat for this content.',
    placement: 'right',
  },
  {
    id: 'notes',
    title: 'Notes',
    body: 'Your editable study space. Format text, add images, tables, equations, and your own explanations.',
    placement: 'left',
    tab: 'summary',
  },
  {
    id: 'flowchart',
    title: 'Mind map',
    body: 'Explore a branching overview of your notes. Expand themes, zoom, and pan. View only.',
    placement: 'left',
    tab: 'flowchart',
  },
  {
    id: 'quizzes',
    title: 'Test yourself',
    body: 'Test yourself with AI quizzes tuned to chapters, difficulty, and question types.',
    placement: 'left',
    tab: 'quizzes',
  },
  {
    id: 'flashcards',
    title: 'Flashcards',
    body: 'Generate spaced-repetition decks from your notes and review until they stick.',
    placement: 'left',
    tab: 'flashcards',
  },
  {
    id: 'podcast',
    title: 'Podcast',
    body: 'Hear your notes as a conversation. Generate or play audio without leaving this study space.',
    placement: 'left',
    tab: 'podcast',
  },
  {
    id: 'chat',
    title: 'Chat',
    body: 'Ask Darwin AI anything about this content: clarifications, summaries, or deeper explanations.',
    placement: 'left',
    tab: 'chat',
  },
];
