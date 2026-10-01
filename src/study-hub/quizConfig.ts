import {
  applyConfigFromServer as applyConfigFromServerJs,
  buildQuizConfigPayload as buildQuizConfigPayloadJs,
  clampQuestionCount as clampQuestionCountJs,
  defaultQuizConfig as defaultQuizConfigJs,
  formatSetWhen as formatSetWhenJs,
  MAX_QUESTION_COUNT as MAX_QUESTION_COUNT_JS,
  MIN_QUESTION_COUNT as MIN_QUESTION_COUNT_JS,
  FREE_QUIZ_QUESTIONS_PER_NOTE as FREE_QUIZ_QUESTIONS_PER_NOTE_JS,
  QUIZ_COUNTS as QUIZ_COUNTS_JS,
  QUIZ_DIFFICULTIES as QUIZ_DIFFICULTIES_JS,
  QUIZ_QUESTION_TYPES as QUIZ_QUESTION_TYPES_JS,
  quizSetActionLabel as quizSetActionLabelJs,
  isQuizQuotaExhausted as isQuizQuotaExhaustedJs,
  isQuizUpgradeGate as isQuizUpgradeGateJs,
  shouldGateFreeQuizContinue as shouldGateFreeQuizContinueJs,
  asQuizUpgradeGatePayload as asQuizUpgradeGatePayloadJs,
  setKindInfo,
  typeLabels as typeLabelsJs,
} from '@shared/quiz/quizConfig.js';

export const QUIZ_QUESTION_TYPES = QUIZ_QUESTION_TYPES_JS;
export const QUIZ_COUNTS = QUIZ_COUNTS_JS;
export const MIN_QUESTION_COUNT = MIN_QUESTION_COUNT_JS;
export const MAX_QUESTION_COUNT = MAX_QUESTION_COUNT_JS;
export const FREE_QUIZ_QUESTIONS_PER_NOTE = FREE_QUIZ_QUESTIONS_PER_NOTE_JS;
export const QUIZ_DIFFICULTIES = QUIZ_DIFFICULTIES_JS;

export type QuizMode = 'learn' | 'exam';

export type QuizSessionConfigInput = {
  chapter_ids?: number[] | null;
  topic_ids?: number[] | null;
  question_types: string[];
  difficulty: string;
  mode: QuizMode;
  question_count: number;
  timed: boolean;
  time_limit_seconds?: number | null;
  mix_starred?: boolean;
  starred_mix_ratio?: number;
  allow_repetition?: boolean;
};

export const defaultQuizConfig = (): QuizSessionConfigInput =>
  defaultQuizConfigJs() as QuizSessionConfigInput;

export function applyConfigFromServer(
  config: Record<string, unknown> | null | undefined
): QuizSessionConfigInput {
  return applyConfigFromServerJs(config) as QuizSessionConfigInput;
}

export function buildQuizConfigPayload(
  config: QuizSessionConfigInput,
  chapterIds: number[] | null | undefined
): Record<string, unknown> {
  return buildQuizConfigPayloadJs(config, chapterIds);
}

export function clampQuestionCount(value: number | string | null | undefined, maxCount?: number): number | null {
  return clampQuestionCountJs(value, maxCount);
}

export function isQuizQuotaExhausted(quota: { unlimited?: boolean; remaining?: number | null } | null | undefined): boolean {
  return isQuizQuotaExhaustedJs(quota);
}

export function isQuizUpgradeGate(payload: { needs_upgrade?: boolean } | null | undefined): boolean {
  return isQuizUpgradeGateJs(payload);
}

export function shouldGateFreeQuizContinue(args: {
  isPro?: boolean;
  freeQuota?: { unlimited?: boolean; remaining?: number | null } | null;
  history?: Array<{ user_answer?: string | null }>;
  hasBankedNext?: boolean;
  sessionComplete?: boolean;
}): boolean {
  return shouldGateFreeQuizContinueJs(args as never);
}

export function asQuizUpgradeGatePayload<T extends Record<string, unknown>>(data?: T) {
  return asQuizUpgradeGatePayloadJs(data) as unknown as T & { needs_upgrade: true };
}

export function setKindMeta(kind: string | undefined): {
  label: string;
  backgroundColor: string;
  color: string;
} {
  const info = setKindInfo(kind);
  if (kind === 'in_progress') {
    return { label: info.label, backgroundColor: 'rgba(63,107,79,0.12)', color: '#3F6B4F' };
  }
  if (kind === 'incomplete') {
    return { label: info.label, backgroundColor: '#FFFBEB', color: '#92400E' };
  }
  return { label: info.label, backgroundColor: '#ECFDF5', color: '#065F46' };
}

export function formatSetWhen(iso: string | null | undefined): string {
  return formatSetWhenJs(iso);
}

export function typeLabels(types: string[] | null | undefined): string {
  return typeLabelsJs(types);
}

export function quizSetActionLabel(set: { kind?: string; answered_count?: number }): string {
  return quizSetActionLabelJs(set);
}
