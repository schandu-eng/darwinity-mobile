export const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'mixed', label: 'Mixed' },
] as const;

export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 50;

export const EVAL_BUILD_STAGES = [
  { id: 'read', label: 'Reading notes & PYQs' },
  { id: 'draft', label: 'Drafting questions' },
  { id: 'check', label: 'Writing answers' },
  { id: 'ready', label: 'Almost ready' },
] as const;

export const EVAL_WAIT_TIPS = [
  'Questions are trained on your linked notes and past-year papers.',
  'MCQ gives four options; Q&A asks for short written answers.',
  'You can run as many practice tests as you want on this exam target.',
  'Hang tight, when this finishes, your first question appears automatically.',
];
