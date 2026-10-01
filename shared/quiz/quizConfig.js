export const QUIZ_QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'fill_blank', label: 'Fill in the blank' },
]

export const QUIZ_DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'mixed', label: 'Mixed' },
]

export const QUIZ_COUNTS = [5, 10, 15, 20]

export const MIN_QUESTION_COUNT = 1
export const MAX_QUESTION_COUNT = 50
/** Free plan: one LLM batch per note, then Pro. */
export const FREE_QUIZ_QUESTIONS_PER_NOTE = 5

export const QUIZ_BUILD_STAGES = [
  { id: 'read', label: 'Reading notes' },
  { id: 'draft', label: 'Drafting questions' },
  { id: 'check', label: 'Writing answers' },
  { id: 'ready', label: 'Almost ready' },
]

export const QUIZ_WAIT_TIPS = [
  'The first 5 questions unlock together — more craft in the background while you play.',
  'Star tough items while you play; they mix back into later rounds.',
  'Learn mode grades instantly; Exam waits until the end.',
  'Open Quiz Settings anytime to change topics, types, or reset progress.',
]

/** API-shaped defaults. Web maps this to camelCase in the UI layer. */
export function defaultQuizConfig() {
  return {
    question_types: ['multiple_choice'],
    difficulty: 'mixed',
    mode: 'learn',
    question_count: 15,
    timed: false,
    time_limit_seconds: null,
    mix_starred: true,
    starred_mix_ratio: 0.25,
    allow_repetition: false,
  }
}

export function clampQuestionCount(value, maxCount = MAX_QUESTION_COUNT) {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? '').replace(/\D/g, ''), 10)
  if (!Number.isFinite(n) || n < MIN_QUESTION_COUNT) return null
  const max = Number.isFinite(maxCount) ? maxCount : MAX_QUESTION_COUNT
  return Math.min(max, n)
}

export function applyConfigFromServer(config) {
  const base = defaultQuizConfig()
  if (!config) return base
  const nextCount = clampQuestionCount(config.question_count)
  return {
    ...base,
    question_types: Array.isArray(config.question_types)
      ? config.question_types
      : base.question_types,
    difficulty: typeof config.difficulty === 'string' ? config.difficulty : base.difficulty,
    mode: config.mode === 'exam' ? 'exam' : 'learn',
    question_count: nextCount ?? base.question_count,
    timed: Boolean(config.timed),
    time_limit_seconds:
      typeof config.time_limit_seconds === 'number' ? config.time_limit_seconds : null,
    mix_starred: config.mix_starred !== false,
    starred_mix_ratio:
      typeof config.starred_mix_ratio === 'number' ? config.starred_mix_ratio : 0.25,
    allow_repetition: Boolean(config.allow_repetition),
  }
}

export function buildQuizConfigPayload(config, chapterIds) {
  const questionCount = clampQuestionCount(config.question_count) ?? defaultQuizConfig().question_count
  return {
    chapter_ids: chapterIds ?? undefined,
    question_types: Array.isArray(config.question_types) && config.question_types.length
      ? config.question_types
      : ['multiple_choice'],
    difficulty: config.difficulty || 'mixed',
    mode: config.mode === 'exam' ? 'exam' : 'learn',
    question_count: questionCount,
    timed: Boolean(config.timed),
    time_limit_seconds: config.timed
      ? config.time_limit_seconds ?? questionCount * 60
      : null,
    mix_starred: config.mix_starred !== false,
    starred_mix_ratio: config.starred_mix_ratio ?? 0.25,
    allow_repetition: Boolean(config.allow_repetition),
  }
}

export function setKindInfo(kind) {
  if (kind === 'in_progress') return { kind, label: 'In progress' }
  if (kind === 'incomplete') return { kind, label: 'Incomplete' }
  return { kind: kind || 'completed', label: 'Completed' }
}

export function formatSetWhen(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function typeLabels(types) {
  const map = {
    multiple_choice: 'MCQ',
    true_false: 'T/F',
    fill_blank: 'Fill blank',
  }
  return (types || []).map((t) => map[t] || t).join(' · ')
}

export function quizSetActionLabel(set) {
  if (set?.kind === 'in_progress') return 'Resume'
  if (set?.kind === 'incomplete' && (set.answered_count || 0) === 0) return 'Start'
  return 'View'
}

export function isQuizQuotaExhausted(quota) {
  if (!quota || quota.unlimited) return false
  return Number(quota.remaining) <= 0
}

export function isQuizUpgradeGate(payload) {
  return Boolean(payload?.needs_upgrade)
}

export function countAnsweredQuizHistory(history) {
  if (!Array.isArray(history)) return 0
  return history.filter((row) => row != null && row.user_answer != null && String(row.user_answer).length > 0).length
}

/**
 * Free users get one 5-question batch per note. After that, continue should
 * open the trial/upgrade gate instead of waiting for a question that will never
 * arrive (which looks like the quiz is stuck).
 */
export function shouldGateFreeQuizContinue({
  isPro = false,
  freeQuota = null,
  history = [],
  hasBankedNext = false,
  sessionComplete = false,
} = {}) {
  if (isPro || hasBankedNext || sessionComplete) return false
  if (isQuizQuotaExhausted(freeQuota)) return true
  return countAnsweredQuizHistory(history) >= FREE_QUIZ_QUESTIONS_PER_NOTE
}

export function asQuizUpgradeGatePayload(data = {}) {
  const payload = data && typeof data === 'object' ? data : {}
  return {
    ...payload,
    needs_upgrade: true,
    question: null,
    current_question: null,
    question_id: null,
    current_question_id: null,
    crafting: false,
    completed: false,
  }
}
