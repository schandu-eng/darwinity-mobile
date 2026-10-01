import { ONBOARDING_LIGHT } from './welcomeFlowTheme';

export type TrailLevelId =
  | 'drop'
  | 'fade'
  | 'kit'
  | 'podcast'
  | 'quiz'
  | 'cards'
  | 'summit';

export type TrailLevel = {
  id: TrailLevelId;
  number: number;
  title: string;
  subtitle: string;
  
  x: number;
  
  labelSide: 'left' | 'right';
  icon:
    | 'file-document-outline'
    | 'weather-fog'
    | 'sprout'
    | 'headphones'
    | 'help-circle-outline'
    | 'cards-outline'
    | 'flag-checkered';
};

export const TRAIL_LEVELS: TrailLevel[] = [
  {
    id: 'drop',
    number: 1,
    title: 'Origin Seed',
    subtitle: 'Plant a lecture',
    x: 0.28,
    labelSide: 'right',
    icon: 'file-document-outline',
  },
  {
    id: 'fade',
    number: 2,
    title: 'Near Extinction',
    subtitle: 'Watch memory fade',
    x: 0.62,
    labelSide: 'left',
    icon: 'weather-fog',
  },
  {
    id: 'kit',
    number: 3,
    title: 'Adaptation',
    subtitle: 'Grow your study kit',
    x: 0.32,
    labelSide: 'right',
    icon: 'sprout',
  },
  {
    id: 'podcast',
    number: 4,
    title: 'Echo Chamber',
    subtitle: 'Play the history podcast',
    x: 0.68,
    labelSide: 'left',
    icon: 'headphones',
  },
  {
    id: 'quiz',
    number: 5,
    title: 'Natural Selection',
    subtitle: 'Survive one question',
    x: 0.30,
    labelSide: 'right',
    icon: 'help-circle-outline',
  },
  {
    id: 'cards',
    number: 6,
    title: 'Living Fossils',
    subtitle: 'Flip a memory card',
    x: 0.64,
    labelSide: 'left',
    icon: 'cards-outline',
  },
  {
    id: 'summit',
    number: 7,
    title: 'Evolved Mind',
    subtitle: 'Finish the ascent',
    x: 0.42,
    labelSide: 'right',
    icon: 'flag-checkered',
  },
];

export const KIT_LABELS = ['Notes', 'Cards', 'Quiz', 'Podcast'] as const;

export const DROP_FILE_LABEL = 'World History lecture.pdf';
export const DROP_GATE_LABEL = 'Origin Seed';

export const NOTES_HEADING = 'Ancient Rome';
export const NOTE_LINES = [
  'Rome grew from a city on the Tiber',
  'Augustus brought roads, law, and peace',
  'The western empire fell in 476 CE',
] as const;

export const QUIZ_QUESTION = 'Who was the first President of the United States?';
export const QUIZ_OPTIONS = [
  'Abraham Lincoln',
  'George Washington',
  'Thomas Jefferson',
  'Benjamin Franklin',
] as const;
export const QUIZ_CORRECT = 'George Washington';

export const CARD_DECK_TERM = 'Magna Carta';
export const CARD_DECK_MEANING = 'A charter of rights signed in England in 1215.';

export const SAMPLE_PODCAST_TITLE = 'Ancient Rome · History recap';
export const SAMPLE_PODCAST_META = '0:33';

export const PODCAST_CLEAR_AFTER_SEC = 3;

export const trailColors = ONBOARDING_LIGHT;
