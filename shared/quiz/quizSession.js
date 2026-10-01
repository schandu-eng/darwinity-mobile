import { applyConfigFromServer } from './quizConfig.js'
import { unwrapQuizChoice } from './quizGrade.js'

export function formatQuizApiError(err, fallback = 'Something went wrong') {
  const detail = err?.response?.data?.detail ?? err?.detail ?? err?.message ?? err
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === 'string' ? d : d?.message || d?.msg || JSON.stringify(d)))
      .join('; ')
  }
  if (detail && typeof detail === 'object') {
    if (detail.message) return String(detail.message)
    if (detail.msg) return String(detail.msg)
  }
  return fallback
}

export function normalizeQuestionText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function questionKey(question) {
  return normalizeQuestionText(question?.question)
}

export function findStarredForQuestion(starred, question) {
  const key = questionKey(question)
  if (!key) return null
  return (starred || []).find((item) => questionKey(item.question) === key) || null
}

export function isQuestionStarred(starred, question) {
  return Boolean(findStarredForQuestion(starred, question))
}

export function clockOffsetFromServerNow(serverNow) {
  if (!serverNow) return 0
  const parsed = Date.parse(serverNow)
  return Number.isFinite(parsed) ? parsed - Date.now() : 0
}

export function remainingMsFromDeadline(deadlineAt, clockOffsetMs, nowMs = Date.now()) {
  if (!deadlineAt) return null
  const end = Date.parse(deadlineAt)
  if (!Number.isFinite(end)) return null
  return end - (nowMs + (clockOffsetMs || 0))
}

export function remainingSecondsFromDeadline(deadlineAt, clockOffsetMs, nowMs = Date.now()) {
  const ms = remainingMsFromDeadline(deadlineAt, clockOffsetMs, nowMs)
  if (ms == null) return null
  return Math.max(0, Math.floor(ms / 1000))
}

export function formatQuizTimerLabel(remainingSeconds) {
  if (remainingSeconds == null) return null
  const m = Math.floor(remainingSeconds / 60)
  const s = remainingSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function quizScoreSummary(score, total) {
  if (!score) return null
  const denom = score.total ?? score.answered ?? total
  const pct = denom > 0 ? Math.round((score.correct / denom) * 100) : 0
  return { total: denom, denom, pct, unanswered: score.unanswered ?? 0 }
}

export function inProgressQuizSet(quizSets) {
  return (quizSets || []).find((s) => s.kind === 'in_progress') || null
}

export function unansweredCount(set) {
  if (!set) return 0
  return (
    set.score?.unanswered ??
    Math.max(0, (set.question_count || 0) - (set.answered_count || 0))
  )
}

export function shouldResumeActive(set) {
  return Boolean(set && (set.kind === 'in_progress' || set.status === 'active'))
}

export function shouldReactivateIncomplete(set) {
  return Boolean(set && set.kind === 'incomplete' && unansweredCount(set) > 0)
}

export function isSessionCompleted(data) {
  return Boolean(data?.completed || data?.status === 'completed')
}

export function quizOptions(question) {
  if (!question) return null
  const raw = question.options || (question.question_type === 'true_false' ? ['True', 'False'] : null)
  if (!raw) return null
  if (!Array.isArray(raw)) return raw
  const mapped = raw.map(unwrapQuizChoice).filter((text) => text !== '')
  return mapped.length ? mapped : null
}

/**
 * Resume-aware playing snapshot. Restores the current answer/grade when the
 * server (or history) already has one for this question.
 */
export function playingStateFromSession(data, { fallbackTotal = 10 } = {}) {
  const question = data?.question ?? data?.current_question ?? null
  const questionId = data?.question_id ?? data?.current_question_id ?? null
  const total = data?.question_count ?? data?.total ?? fallbackTotal
  const position = Math.min(data?.position ?? 1, total)

  let grade = data?.grade || null
  let selectedAnswer = ''
  let submitted = false
  if (grade) {
    submitted = true
    if (grade.user_answer) selectedAnswer = grade.user_answer
  } else {
    const histAnswer = data?.history?.find((h) => h.id === questionId)?.user_answer ?? ''
    selectedAnswer = histAnswer ?? ''
    submitted = Boolean(histAnswer)
  }

  return {
    sessionId: data?.session_id ?? null,
    question,
    questionId: questionId ?? null,
    total,
    position,
    history: data?.history ?? null,
    deadlineAt: data?.deadline_at ?? null,
    clockOffsetMs: clockOffsetFromServerNow(data?.server_now),
    score: data?.score ?? null,
    config: data?.config ? applyConfigFromServer(data.config) : null,
    grade,
    selectedAnswer,
    submitted,
  }
}

export function reviewStateFromSession(data, { timedOut = false } = {}) {
  return {
    sessionId: data?.session_id ?? null,
    history: data?.history ?? null,
    score: data?.score ?? null,
    config: data?.config ? applyConfigFromServer(data.config) : null,
    timedOut: Boolean(timedOut),
  }
}

export function nextQuestionStateFromSession(data, { fallbackTotal, fallbackPosition, fallbackDeadlineAt } = {}) {
  const total = data?.question_count ?? data?.total ?? fallbackTotal
  const nextPos = data?.position ?? (fallbackPosition ?? 0) + 1
  return {
    question: data?.question ?? data?.current_question ?? null,
    questionId: data?.question_id ?? data?.current_question_id ?? null,
    total,
    position: Math.min(nextPos, total || nextPos),
    deadlineAt: data?.deadline_at ?? fallbackDeadlineAt ?? null,
    clockOffsetMs: data?.server_now ? clockOffsetFromServerNow(data.server_now) : null,
    history: data?.history ?? null,
  }
}

/**
 * @returns {{ kind: 'unavailable' } | { kind: 'next', question: object, id: number } | { kind: 'complete' }}
 * `unavailable` means the bank is empty — caller should fetch `/next`.
 * `complete` means this was the last banked stem — caller should POST `/complete`.
 */
export function nextLearnQuestionFromHistory({ history, currentQuestionId, position, total }) {
  if (!Array.isArray(history) || history.length === 0) return { kind: 'unavailable' }
  const idx = history.findIndex((h) => h.id === currentQuestionId)
  const nextRow = idx >= 0 ? history[idx + 1] : null
  if (nextRow?.question && position < total) {
    return { kind: 'next', question: nextRow.question, id: nextRow.id }
  }
  // Live continuous quiz: bank may still be filling — do not treat missing next as complete.
  if (position >= total) {
    return { kind: 'complete' }
  }
  return { kind: 'unavailable' }
}

export function appendQuizSlide(slides, entry) {
  if (!entry?.questionId || !entry?.question) return slides || []
  return [...(slides || []).filter((s) => s.questionId !== entry.questionId), entry]
}

/**
 * @param {{
 *   slides?: Array<{ questionId?: number, question?: object, userAnswer?: string, grade?: object|null, position?: number }>,
 *   slideIndex?: number,
 *   currentQuestion?: object|null,
 *   grade?: object|null,
 *   userAnswer?: string,
 *   submitted?: boolean,
 *   position?: number,
 *   total?: number,
 * }} [args]
 */
export function displayFromSlides({
  slides = [],
  slideIndex = 0,
  currentQuestion = null,
  grade = null,
  userAnswer = '',
  submitted = false,
  position = 0,
  total = 1,
} = {}) {
  const viewingPast = slideIndex < slides.length
  const activeSlide = viewingPast ? slides[slideIndex] : null
  return {
    viewingPast,
    displayQuestion: viewingPast ? activeSlide.question : currentQuestion,
    displayGrade: viewingPast ? activeSlide.grade : grade,
    displayAnswer: viewingPast ? activeSlide.userAnswer : userAnswer,
    displaySubmitted: viewingPast || submitted,
    displayPosition: Math.min(viewingPast ? activeSlide.position : position, total || 1),
    canGoPrev: slides.length > 0 && (viewingPast ? slideIndex > 0 : true),
    canGoNext: viewingPast,
  }
}

export function nextSlideIndexAfterPrev({ slideIndex, viewingPast, slidesLength }) {
  if (slideIndex > 0) return slideIndex - 1
  if (!viewingPast && slidesLength > 0) return slidesLength - 1
  return slideIndex
}

export function nextSlideIndexAfterNext({ slideIndex, viewingPast, slidesLength }) {
  if (viewingPast && slideIndex < slidesLength - 1) return slideIndex + 1
  if (viewingPast && slideIndex === slidesLength - 1) return slidesLength
  return slideIndex
}

export function quizSessionStartedProps({ contentId, sessionId, config, questionCount, forceNew }) {
  return {
    content_id: contentId,
    session_id: sessionId,
    mode: config?.mode,
    question_count: questionCount,
    timed: Boolean(config?.timed),
    difficulty: config?.difficulty,
    ...(forceNew != null ? { force_new: forceNew } : {}),
  }
}

export function quizAnswerSubmittedProps({ contentId, mode, isCorrect }) {
  return {
    content_id: contentId,
    mode,
    is_correct: isCorrect ?? null,
  }
}

export function quizSessionCompletedProps({ data, contentId, timedOut, fallbackTotal, fallbackMode }) {
  const score = data?.score || {}
  const denom = score.total ?? score.answered ?? data?.question_count ?? fallbackTotal
  const correct = score.correct ?? 0
  const percent = denom > 0 ? Math.round((correct / denom) * 100) : 0
  return {
    content_id: contentId,
    session_id: data?.session_id,
    score: correct,
    total: denom,
    percent,
    score_correct: correct,
    score_total: denom,
    mode: data?.config?.mode || fallbackMode,
    timed_out: Boolean(timedOut),
  }
}

export function quizSessionAbandonedProps({ contentId, mode }) {
  return {
    content_id: contentId,
    mode,
  }
}
