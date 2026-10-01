/**
 * Node-native tests for shared quiz session helpers.
 * Run: node --test shared/quiz/quizSession.test.mjs
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { gradeQuizAnswerLocally, normalizeQuizAnswer, unwrapQuizChoice } from './quizGrade.js'
import {
  applyConfigFromServer,
  buildQuizConfigPayload,
  clampQuestionCount,
  defaultQuizConfig,
  formatSetWhen,
  quizSetActionLabel,
  setKindInfo,
  typeLabels,
  FREE_QUIZ_QUESTIONS_PER_NOTE,
  isQuizQuotaExhausted,
  shouldGateFreeQuizContinue,
  asQuizUpgradeGatePayload,
} from './quizConfig.js'
import {
  appendQuizSlide,
  clockOffsetFromServerNow,
  displayFromSlides,
  findStarredForQuestion,
  formatQuizApiError,
  formatQuizTimerLabel,
  isQuestionStarred,
  isSessionCompleted,
  nextLearnQuestionFromHistory,
  nextQuestionStateFromSession,
  nextSlideIndexAfterNext,
  nextSlideIndexAfterPrev,
  playingStateFromSession,
  quizAnswerSubmittedProps,
  quizOptions,
  quizScoreSummary,
  quizSessionAbandonedProps,
  quizSessionCompletedProps,
  quizSessionStartedProps,
  remainingSecondsFromDeadline,
  reviewStateFromSession,
  shouldReactivateIncomplete,
  shouldResumeActive,
  unansweredCount,
} from './quizSession.js'

describe('gradeQuizAnswerLocally', () => {
  it('returns null without an answer key', () => {
    assert.equal(gradeQuizAnswerLocally({ question: 'Q' }, 'a'), null)
    assert.equal(gradeQuizAnswerLocally({ question: 'Q', correct_answer: '' }, 'a'), null)
    assert.equal(gradeQuizAnswerLocally(null, 'a'), null)
  })

  it('matches MCQ after punctuation and case normalize', () => {
    const grade = gradeQuizAnswerLocally(
      { question_type: 'multiple_choice', correct_answer: 'Mitochondria!', explanation: 'powerhouse' },
      'mitochondria'
    )
    assert.equal(grade.is_correct, true)
    assert.equal(grade.correct_answer, 'Mitochondria!')
    assert.equal(grade.explanation, 'powerhouse')
    assert.equal(grade.user_answer, 'mitochondria')
  })

  it('rejects a wrong MCQ', () => {
    const grade = gradeQuizAnswerLocally(
      { question_type: 'multiple_choice', correct_answer: 'True' },
      'False'
    )
    assert.equal(grade.is_correct, false)
  })

  it('unwraps JSON option objects for display and grading', () => {
    const encoded = '{"text": "Lactobacillus", "is_correct": true}'
    assert.equal(unwrapQuizChoice(encoded), 'Lactobacillus')
    assert.equal(unwrapQuizChoice({ text: 'Saccharomyces cerevisiae', is_correct: false }), 'Saccharomyces cerevisiae')
    const grade = gradeQuizAnswerLocally(
      { question_type: 'multiple_choice', correct_answer: encoded },
      '{"text": "Lactobacillus", "is_correct": true}'
    )
    assert.equal(grade.is_correct, true)
    assert.equal(grade.correct_answer, 'Lactobacillus')
    assert.equal(grade.user_answer, 'Lactobacillus')
    const mixed = gradeQuizAnswerLocally(
      { question_type: 'multiple_choice', correct_answer: encoded },
      'Lactobacillus'
    )
    assert.equal(mixed.is_correct, true)
  })

  it('matches fill-blank with an article stripped', () => {
    const grade = gradeQuizAnswerLocally(
      { question_type: 'fill_blank', correct_answer: 'the mitochondria', explanation: 'ok' },
      'mitochondria'
    )
    assert.equal(grade.is_correct, true)
    assert.equal(grade.explanation, 'ok')
  })

  it('matches fill-blank substring when the shorter side is at least 60%', () => {
    const grade = gradeQuizAnswerLocally(
      { question_type: 'fill_blank', correct_answer: 'respiration rate' },
      'respiration'
    )
    assert.equal(grade.is_correct, true)
  })

  it('does not match a too-short fill-blank substring', () => {
    const grade = gradeQuizAnswerLocally(
      { question_type: 'fill_blank', correct_answer: 'cellular respiration' },
      'cell'
    )
    assert.equal(grade.is_correct, false)
  })

  it('matches fill-blank singular/plural for single tokens', () => {
    const grade = gradeQuizAnswerLocally(
      { question_type: 'fill_blank', correct_answer: 'enzymes' },
      'enzyme'
    )
    assert.equal(grade.is_correct, true)
  })

  it('does not apply fill-blank fuzzy rules to MCQ', () => {
    const grade = gradeQuizAnswerLocally(
      { question_type: 'multiple_choice', correct_answer: 'the mitochondria' },
      'mitochondria'
    )
    assert.equal(grade.is_correct, false)
  })

  it('normalizes punctuation to spaces', () => {
    assert.equal(normalizeQuizAnswer('  Hello, World!! '), 'hello world')
  })
})

describe('playingStateFromSession', () => {
  it('restores the in-progress answer from history', () => {
    const state = playingStateFromSession({
      session_id: 9,
      question: { question: 'Q2' },
      question_id: 2,
      position: 2,
      question_count: 4,
      history: [
        { id: 1, question: { question: 'Q1' }, user_answer: 'A' },
        { id: 2, question: { question: 'Q2' }, user_answer: 'B' },
      ],
    })
    assert.equal(state.sessionId, 9)
    assert.equal(state.selectedAnswer, 'B')
    assert.equal(state.submitted, true)
    assert.equal(state.position, 2)
    assert.equal(state.grade, null)
  })

  it('prefers an explicit grade payload over history', () => {
    const state = playingStateFromSession({
      question: { question: 'Q' },
      question_id: 1,
      grade: { is_correct: true, user_answer: 'Yes', correct_answer: 'Yes' },
      history: [{ id: 1, question: { question: 'Q' }, user_answer: 'No' }],
    })
    assert.equal(state.selectedAnswer, 'Yes')
    assert.equal(state.submitted, true)
    assert.equal(state.grade.is_correct, true)
  })

  it('starts unanswered when history has no answer for this stem', () => {
    const state = playingStateFromSession({
      question: { question: 'Q2' },
      question_id: 2,
      position: 2,
      question_count: 2,
      history: [{ id: 1, question: { question: 'Q1' }, user_answer: 'A' }],
    })
    assert.equal(state.selectedAnswer, '')
    assert.equal(state.submitted, false)
  })
})

describe('nextLearnQuestionFromHistory', () => {
  it('returns the next banked stem, then complete on the last item', () => {
    const history = [
      { id: 1, question: { question: 'Q1' } },
      { id: 2, question: { question: 'Q2' } },
    ]
    const next = nextLearnQuestionFromHistory({
      history,
      currentQuestionId: 1,
      position: 1,
      total: 2,
    })
    assert.equal(next.kind, 'next')
    assert.equal(next.id, 2)
    assert.equal(
      nextLearnQuestionFromHistory({
        history,
        currentQuestionId: 2,
        position: 2,
        total: 2,
      }).kind,
      'complete'
    )
    assert.equal(
      nextLearnQuestionFromHistory({ history: [], currentQuestionId: 1, position: 1, total: 2 }).kind,
      'unavailable'
    )
  })

  it('returns unavailable when more questions are expected but not banked yet', () => {
    const history = [{ id: 1, question: { question: 'Q1' } }]
    assert.equal(
      nextLearnQuestionFromHistory({
        history,
        currentQuestionId: 1,
        position: 1,
        total: 15,
      }).kind,
      'unavailable'
    )
  })
})

describe('shouldGateFreeQuizContinue', () => {
  const fiveAnswered = Array.from({ length: FREE_QUIZ_QUESTIONS_PER_NOTE }, (_, i) => ({
    id: i + 1,
    user_answer: `A${i}`,
  }))

  it('opens the gate after five answered free questions with no next stem', () => {
    assert.equal(
      shouldGateFreeQuizContinue({
        isPro: false,
        history: fiveAnswered,
        hasBankedNext: false,
      }),
      true
    )
  })

  it('does not gate Pro users or when a next stem is already banked', () => {
    assert.equal(
      shouldGateFreeQuizContinue({ isPro: true, history: fiveAnswered, hasBankedNext: false }),
      false
    )
    assert.equal(
      shouldGateFreeQuizContinue({ isPro: false, history: fiveAnswered, hasBankedNext: true }),
      false
    )
    assert.equal(
      shouldGateFreeQuizContinue({
        isPro: false,
        history: fiveAnswered,
        sessionComplete: true,
        freeQuota: { unlimited: false, remaining: 0 },
      }),
      false
    )
  })

  it('gates when the server quota is already spent', () => {
    assert.equal(isQuizQuotaExhausted({ unlimited: false, remaining: 0 }), true)
    assert.equal(
      shouldGateFreeQuizContinue({
        isPro: false,
        freeQuota: { unlimited: false, remaining: 0 },
        history: [{ id: 1, user_answer: 'A' }],
        hasBankedNext: false,
      }),
      true
    )
  })

  it('marks a payload as the upgrade gate without a next question', () => {
    const gated = asQuizUpgradeGatePayload({ session_id: 9, question: { question: 'Q5' }, crafting: true })
    assert.equal(gated.needs_upgrade, true)
    assert.equal(gated.question, null)
    assert.equal(gated.crafting, false)
    assert.equal(gated.session_id, 9)
  })
})

describe('next / review snapshots', () => {
  it('advances to the next stem and keeps the deadline fallback', () => {
    const next = nextQuestionStateFromSession(
      { question: { question: 'Q3' }, question_id: 3, position: 3, question_count: 5 },
      { fallbackTotal: 10, fallbackPosition: 2, fallbackDeadlineAt: '2026-01-01T00:00:00Z' }
    )
    assert.equal(next.question.question, 'Q3')
    assert.equal(next.questionId, 3)
    assert.equal(next.position, 3)
    assert.equal(next.total, 5)
    assert.equal(next.deadlineAt, '2026-01-01T00:00:00Z')
  })

  it('builds a timed-out review snapshot', () => {
    const review = reviewStateFromSession(
      { session_id: 4, history: [], score: { correct: 1, answered: 2, total: 10 }, config: { mode: 'exam' } },
      { timedOut: true }
    )
    assert.equal(review.sessionId, 4)
    assert.equal(review.timedOut, true)
    assert.equal(review.config.mode, 'exam')
  })
})

describe('timer / score / slides', () => {
  it('clamps remaining seconds at zero', () => {
    const past = new Date(Date.now() - 5000).toISOString()
    assert.equal(remainingSecondsFromDeadline(past, 0), 0)
  })

  it('formats the timer label', () => {
    assert.equal(formatQuizTimerLabel(null), null)
    assert.equal(formatQuizTimerLabel(0), '0:00')
    assert.equal(formatQuizTimerLabel(75), '1:15')
  })

  it('computes clock offset from server_now', () => {
    const offset = clockOffsetFromServerNow(new Date(Date.now() + 1200).toISOString())
    assert.ok(offset > 500)
    assert.equal(clockOffsetFromServerNow(null), 0)
  })

  it('summarizes score with unanswered', () => {
    assert.deepEqual(quizScoreSummary({ correct: 3, answered: 4, total: 10, unanswered: 6 }, 10), {
      total: 10,
      denom: 10,
      pct: 30,
      unanswered: 6,
    })
    assert.equal(quizScoreSummary(null, 10), null)
  })

  it('replaces a slide with the same question id', () => {
    const first = appendQuizSlide([], {
      questionId: 1,
      question: { question: 'Q' },
      userAnswer: 'a',
      grade: null,
      position: 1,
    })
    const next = appendQuizSlide(first, {
      questionId: 1,
      question: { question: 'Q' },
      userAnswer: 'b',
      grade: { is_correct: true },
      position: 1,
    })
    assert.equal(next.length, 1)
    assert.equal(next[0].userAnswer, 'b')
  })

  it('reads the live question when slideIndex is past stored slides', () => {
    const display = displayFromSlides({
      slides: [{ questionId: 1, question: { question: 'old' }, userAnswer: 'a', grade: null, position: 1 }],
      slideIndex: 1,
      currentQuestion: { question: 'now' },
      userAnswer: 'b',
      submitted: false,
      position: 2,
      total: 5,
    })
    assert.equal(display.viewingPast, false)
    assert.equal(display.displayQuestion.question, 'now')
    assert.equal(display.displayPosition, 2)
    assert.equal(display.canGoPrev, true)
    assert.equal(display.canGoNext, false)
  })

  it('reads a past slide and walks next/prev indexes', () => {
    const slides = [
      { questionId: 1, question: { question: 'old' }, userAnswer: 'a', grade: null, position: 1 },
    ]
    const display = displayFromSlides({
      slides,
      slideIndex: 0,
      currentQuestion: { question: 'now' },
      userAnswer: 'b',
      submitted: false,
      position: 2,
      total: 5,
    })
    assert.equal(display.viewingPast, true)
    assert.equal(display.displayAnswer, 'a')
    assert.equal(display.displaySubmitted, true)
    assert.equal(nextSlideIndexAfterNext({ slideIndex: 0, viewingPast: true, slidesLength: 1 }), 1)
    assert.equal(nextSlideIndexAfterPrev({ slideIndex: 0, viewingPast: false, slidesLength: 1 }), 0)
  })
})

describe('open-set routing', () => {
  it('resumes active and reactivates incomplete with unanswered items', () => {
    assert.equal(shouldResumeActive({ kind: 'in_progress' }), true)
    assert.equal(shouldResumeActive({ status: 'active' }), true)
    assert.equal(shouldReactivateIncomplete({ kind: 'incomplete', question_count: 10, answered_count: 3 }), true)
    assert.equal(shouldReactivateIncomplete({ kind: 'incomplete', question_count: 10, answered_count: 10 }), false)
    assert.equal(isSessionCompleted({ status: 'completed' }), true)
    assert.equal(isSessionCompleted({ completed: true }), true)
    assert.equal(unansweredCount({ question_count: 10, answered_count: 4 }), 6)
    assert.equal(quizSetActionLabel({ kind: 'in_progress' }), 'Resume')
    assert.equal(quizSetActionLabel({ kind: 'incomplete', answered_count: 0 }), 'Start')
    assert.equal(quizSetActionLabel({ kind: 'completed' }), 'View')
  })
})

describe('starred / options / errors', () => {
  it('matches starred questions by normalized stem', () => {
    const starred = [{ id: 7, question: { question: '  What is ATP? ' } }]
    const found = findStarredForQuestion(starred, { question: 'what is atp?' })
    assert.equal(found.id, 7)
    assert.equal(isQuestionStarred(starred, { question: 'other' }), false)
  })

  it('builds true/false options when none are provided', () => {
    assert.deepEqual(quizOptions({ question_type: 'true_false' }), ['True', 'False'])
    assert.deepEqual(quizOptions({ options: ['A', 'B'] }), ['A', 'B'])
    assert.equal(quizOptions(null), null)
  })

  it('unwraps JSON option objects into plain choice text', () => {
    assert.deepEqual(
      quizOptions({
        options: [
          '{"text": "Clostridium butylicum", "is_correct": false}',
          { text: 'Lactobacillus', is_correct: true },
        ],
      }),
      ['Clostridium butylicum', 'Lactobacillus']
    )
  })

  it('formats API errors from fetch, axios, and arrays', () => {
    assert.equal(formatQuizApiError({ detail: 'Nope' }, 'fallback'), 'Nope')
    assert.equal(formatQuizApiError({ response: { data: { detail: 'Axios' } } }, 'fallback'), 'Axios')
    assert.equal(formatQuizApiError({ detail: [{ msg: 'a' }, 'b'] }, 'fallback'), 'a; b')
    assert.equal(formatQuizApiError({ detail: { message: 'Upgrade' } }, 'fallback'), 'Upgrade')
    assert.equal(formatQuizApiError({}, 'fallback'), 'fallback')
    assert.equal(formatQuizApiError({}, 'fallback'), 'fallback')
  })
})

describe('analytics payloads', () => {
  it('includes start, answer, complete, and abandon fields both apps expect', () => {
    assert.deepEqual(
      quizSessionStartedProps({
        contentId: 1,
        sessionId: 9,
        config: { mode: 'learn', timed: true, difficulty: 'mixed' },
        questionCount: 10,
        forceNew: true,
      }),
      {
        content_id: 1,
        session_id: 9,
        mode: 'learn',
        question_count: 10,
        timed: true,
        difficulty: 'mixed',
        force_new: true,
      }
    )
    assert.deepEqual(quizAnswerSubmittedProps({ contentId: 1, mode: 'exam', isCorrect: false }), {
      content_id: 1,
      mode: 'exam',
      is_correct: false,
    })
    const completed = quizSessionCompletedProps({
      data: { session_id: 9, score: { correct: 8, total: 10 }, config: { mode: 'learn' } },
      contentId: 1,
      timedOut: true,
      fallbackTotal: 10,
      fallbackMode: 'exam',
    })
    assert.equal(completed.percent, 80)
    assert.equal(completed.score_correct, 8)
    assert.equal(completed.timed_out, true)
    assert.deepEqual(quizSessionAbandonedProps({ contentId: 1, mode: 'learn' }), {
      content_id: 1,
      mode: 'learn',
    })
  })
})

describe('config payload', () => {
  it('clamps and fills timed seconds', () => {
    assert.equal(clampQuestionCount('12'), 12)
    assert.equal(clampQuestionCount(0), null)
    assert.equal(clampQuestionCount(80), 50)
    const payload = buildQuizConfigPayload(
      { ...applyConfigFromServer({ mode: 'exam', timed: true, question_count: 8 }), mix_starred: false },
      [3]
    )
    assert.equal(payload.mode, 'exam')
    assert.equal(payload.time_limit_seconds, 480)
    assert.equal(payload.mix_starred, false)
    assert.deepEqual(payload.chapter_ids, [3])
  })

  it('falls unknown modes back to learn and keeps mix_starred default true', () => {
    const cfg = applyConfigFromServer({ mode: 'surprise', mix_starred: undefined })
    assert.equal(cfg.mode, 'learn')
    assert.equal(cfg.mix_starred, true)
    assert.equal(defaultQuizConfig().question_count, 15)
    assert.equal(setKindInfo('in_progress').label, 'In progress')
    assert.equal(typeLabels(['multiple_choice', 'true_false']), 'MCQ · T/F')
    assert.equal(formatSetWhen(null), '')
  })
})
