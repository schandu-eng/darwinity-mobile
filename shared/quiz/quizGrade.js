/**
 * Client-side quiz grading, mirrors backend QuizSessionService._grade_answer.
 * Used in Learn mode when answer keys were shipped with the session bank.
 */

const OPTION_TEXT_KEYS = ['text', 'option', 'value', 'label', 'content', 'answer']

function choiceFromObject(opt) {
  if (!opt || typeof opt !== 'object') return ''
  for (const key of OPTION_TEXT_KEYS) {
    const val = opt[key]
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  const values = Object.values(opt)
  if (values.length === 1 && typeof values[0] === 'string' && values[0].trim()) {
    return values[0].trim()
  }
  return ''
}

/** Plain option / answer text. Unwraps `{text, is_correct}` objects and JSON strings of those. */
export function unwrapQuizChoice(opt) {
  if (opt == null) return ''
  if (typeof opt === 'object') return choiceFromObject(opt)
  const text = String(opt)
  const trimmed = text.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed)
      const nested = choiceFromObject(parsed)
      if (nested) return nested
    } catch {
      // keep original string
    }
  }
  return text
}

export function normalizeQuizAnswer(text) {
  return unwrapQuizChoice(text)
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function fillBlankMatches(answer, correct) {
  if (!answer || !correct) return false
  for (const prefix of ['the ', 'a ', 'an ']) {
    const strippedA = answer.startsWith(prefix) ? answer.slice(prefix.length) : answer
    const strippedC = correct.startsWith(prefix) ? correct.slice(prefix.length) : correct
    if (strippedA === strippedC) return true
  }
  const [shorter, longer] =
    answer.length <= correct.length ? [answer, correct] : [correct, answer]
  if (shorter.length >= 3 && longer.includes(shorter) && shorter.length / longer.length >= 0.6) {
    return true
  }
  if (!answer.includes(' ') && !correct.includes(' ')) {
    if (
      answer.replace(/s$/, '') === correct.replace(/s$/, '') &&
      Math.min(answer.length, correct.length) >= 3
    ) {
      return true
    }
  }
  return false
}

/**
 * @returns {{ is_correct: boolean, correct_answer: string, explanation: string|null, user_answer: string } | null}
 * null when the question has no answer key (e.g. exam mode); caller should use the API.
 */
export function gradeQuizAnswerLocally(question, userAnswer) {
  if (!question || question.correct_answer == null || question.correct_answer === '') {
    return null
  }
  const answer = unwrapQuizChoice(userAnswer)
  const correct = unwrapQuizChoice(question.correct_answer)
  const qType = question.question_type || 'multiple_choice'
  // Multi-blank UI joins with " | "; flatten pipes so local grade matches the API.
  const a = normalizeQuizAnswer(answer.replace(/\s*\|\s*/g, ' '))
  const c = normalizeQuizAnswer(correct.replace(/\s*\|\s*/g, ' '))
  let isCorrect = a === c
  if (!isCorrect && qType === 'fill_blank') {
    isCorrect = fillBlankMatches(a, c)
  }
  return {
    is_correct: isCorrect,
    correct_answer: correct,
    explanation: question.explanation ?? null,
    user_answer: answer,
  }
}
