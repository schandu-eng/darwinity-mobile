import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { handleBillingPlanLimitError } from '@/utils/subscriptionErrorHandler';
import { useProFeatureAccess } from '@/hooks/useProFeatureAccess';
import { learningEndpoints } from '@/api/endpoints/studyHub';
import type {
  QuizGrade,
  QuizSessionHistoryItem,
  QuizSessionQuestion,
  QuizSessionResponse,
  QuizSet,
  QuizStarredItem,
} from '@/api/schemas/studyHub';
import {
  applyConfigFromServer,
  buildQuizConfigPayload,
  clampQuestionCount,
  defaultQuizConfig,
  MIN_QUESTION_COUNT,
  MAX_QUESTION_COUNT,
  FREE_QUIZ_QUESTIONS_PER_NOTE,
  isQuizQuotaExhausted,
  isQuizUpgradeGate,
  shouldGateFreeQuizContinue,
  asQuizUpgradeGatePayload,
  type QuizSessionConfigInput,
} from '@/study-hub/quizConfig';
import { gradeQuizAnswerLocally } from '@/study-hub/quizGrade';
import { playQuizAnswerResult } from '@/study-hub/quizAnswerFeedback';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import {
  isQuizGeneratingPayload,
  isQuizPollCancelled,
  pollQuizGenerationJob,
  pollUntilQuestionReady,
} from '@/study-hub/quizGenerationPoll';
import {
  appendQuizSlide,
  displayFromSlides,
  findStarredForQuestion as findStarredInList,
  formatQuizApiError,
  formatQuizTimerLabel,
  inProgressQuizSet,
  isQuestionStarred as isStarredInList,
  isSessionCompleted,
  nextLearnQuestionFromHistory,
  nextQuestionStateFromSession,
  nextSlideIndexAfterNext,
  nextSlideIndexAfterPrev,
  playingStateFromSession,
  quizAnswerSubmittedProps,
  quizScoreSummary,
  quizSessionAbandonedProps,
  quizSessionCompletedProps,
  quizSessionStartedProps,
  remainingMsFromDeadline,
  remainingSecondsFromDeadline,
  reviewStateFromSession,
  shouldReactivateIncomplete,
  shouldResumeActive,
} from '@shared/quiz/quizSession.js';

export type QuizPhase = 'setup' | 'playing' | 'review' | 'starred';

type QuizSlide = {
  questionId: number;
  question: QuizSessionQuestion;
  userAnswer: string;
  grade: QuizGrade | null;
  position: number;
};

type UseQuizSessionArgs = {
  contentId: number;
  userId: number | undefined;
  chapterIds: number[] | null;
  enabled?: boolean;
};

export function useQuizSession({
  contentId,
  userId,
  chapterIds,
  enabled = true,
}: UseQuizSessionArgs) {
  const { allowed: isPro } = useProFeatureAccess();
  const [phase, setPhase] = useState<QuizPhase>('setup');
  const [draftConfig, setDraftConfig] = useState<QuizSessionConfigInput>(defaultQuizConfig);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<QuizSessionQuestion | null>(null);
  const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null);
  const [history, setHistory] = useState<QuizSessionHistoryItem[]>([]);
  const [position, setPosition] = useState(0);
  const [total, setTotal] = useState(10);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [grade, setGrade] = useState<QuizGrade | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const [score, setScore] = useState<{
    correct: number;
    answered: number;
    total?: number;
    unanswered?: number;
  } | null>(null);
  const [starred, setStarred] = useState<QuizStarredItem[]>([]);
  const [quizSets, setQuizSets] = useState<QuizSet[]>([]);
  const [freeQuota, setFreeQuota] = useState<{
    unlimited?: boolean;
    limit?: number | null;
    used?: number | null;
    remaining?: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [crafting, setCrafting] = useState(false);
  const [error, setError] = useState('');
  const [timedOut, setTimedOut] = useState(false);
  const [timeoutFinalizeFailed, setTimeoutFinalizeFailed] = useState(false);
  const [slides, setSlides] = useState<QuizSlide[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);

  const mode = draftConfig.mode;
  const bootstrapped = useRef(false);
  const completingRef = useRef(false);
  const persistAnswerRef = useRef<Promise<unknown>>(Promise.resolve());
  const quizCompletedRef = useRef(false);
  const phaseRef = useRef(phase);
  const configRef = useRef(draftConfig);
  const pollAbortRef = useRef<AbortController | null>(null);
  const waitForQuizGenerationRef = useRef<
    (jobId: string, seedData?: QuizSessionResponse | null) => Promise<void>
  >(async () => {});
  const recoverEmptySessionRef = useRef<(sessionId: number) => Promise<void>>(async () => {});
  const applyPlayingRef = useRef<
    (data: QuizSessionResponse, opts?: { forceNew?: boolean; skipJobWait?: boolean; skipRecovery?: boolean; trackStart?: boolean }) => void
  >(() => {});
  const quotaExhausted = !isPro && isQuizQuotaExhausted(freeQuota);
  const maxQuestionCount = MAX_QUESTION_COUNT;

  const applyFreeQuota = (data: { free_quota?: typeof freeQuota } | null | undefined) => {
    if (data?.free_quota) setFreeQuota(data.free_quota);
  };

  const markQuizQuotaExhausted = () => {
    setFreeQuota((prev) => {
      if (prev?.unlimited) return prev;
      const limit = prev?.limit ?? FREE_QUIZ_QUESTIONS_PER_NOTE;
      return { unlimited: false, limit, used: limit, remaining: 0 };
    });
  };

  const handleQuizRequestError = (e: unknown, fallback: string) => {
    const err = e as { response?: { status?: number; data?: { detail?: unknown } } };
    if (handleBillingPlanLimitError(err?.response?.status, err?.response?.data ?? null)) {
      markQuizQuotaExhausted();
    }
    return formatQuizApiError(e, fallback);
  };

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    configRef.current = draftConfig;
  }, [draftConfig]);

  const applyUpgradeGate = (data: QuizSessionResponse) => {
    applyFreeQuota(data as { free_quota?: typeof freeQuota });
    markQuizQuotaExhausted();
    if (data.session_id) setSessionId(data.session_id);
    if (data.config) setDraftConfig(data.config as QuizSessionConfigInput);
    if (data.history) setHistory(data.history as QuizSessionHistoryItem[]);
    setCurrentQuestion(null);
    setCurrentQuestionId(null);
    setGrade(null);
    setSubmitted(false);
    setSelectedAnswer('');
    setCrafting(false);
    setGenerating(false);
    setAdvancing(false);
    setBusy(false);
    setNeedsUpgrade(true);
    setPhase('playing');
    setPosition(data.position || 1);
    setTotal(data.question_count ?? data.total ?? 15);
  };

  const applyPlaying = useCallback(
    (data: QuizSessionResponse, opts?: { forceNew?: boolean; skipJobWait?: boolean; skipRecovery?: boolean; trackStart?: boolean }) => {
      if (!opts?.skipJobWait && isQuizGeneratingPayload(data)) {
        void waitForQuizGenerationRef.current((data as { job_id: string }).job_id, data);
        return;
      }
      if (isQuizUpgradeGate(data)) {
        applyUpgradeGate(data);
        return;
      }
      setNeedsUpgrade(false);
      const playing = playingStateFromSession(data, { fallbackTotal: 10 });
      if (
        !opts?.skipRecovery &&
        playing.sessionId &&
        !playing.question &&
        !isSessionCompleted(data)
      ) {
        void recoverEmptySessionRef.current(playing.sessionId);
        return;
      }
      if (playing.sessionId) setSessionId(playing.sessionId);
      if (playing.config) setDraftConfig(playing.config as QuizSessionConfigInput);
      setCurrentQuestion(playing.question as QuizSessionQuestion | null);
      setCurrentQuestionId(playing.questionId);
      setTotal(playing.total);
      setPosition(playing.position);
      if (playing.history) setHistory(playing.history as QuizSessionHistoryItem[]);
      setDeadlineAt(playing.deadlineAt);
      setClockOffsetMs(playing.clockOffsetMs);
      if (playing.score) setScore(playing.score);
      setGrade(playing.grade as QuizGrade | null);
      setSelectedAnswer(playing.selectedAnswer);
      setSubmitted(playing.submitted);
      applyFreeQuota(data as { free_quota?: typeof freeQuota });
      setPhase('playing');
      setTimedOut(false);
      setTimeoutFinalizeFailed(false);
      setCrafting(
        Boolean((data as QuizSessionResponse & { crafting?: boolean }).crafting) || !playing.question
      );
      setSlides([]);
      setSlideIndex(0);
      quizCompletedRef.current = false;
      if (opts?.trackStart === false) return;
      const cfg = (playing.config as QuizSessionConfigInput | null) || configRef.current;
      analytics.track(
        EVENTS.QUIZ_SESSION_STARTED,
        quizSessionStartedProps({
          contentId,
          sessionId: playing.sessionId,
          config: cfg,
          questionCount: playing.total,
          forceNew: opts?.forceNew,
        })
      );
    },
    [contentId]
  );

  const applyReview = useCallback(
    (data: QuizSessionResponse, opts?: { timedOut?: boolean; trackCompletion?: boolean }) => {
      const review = reviewStateFromSession(data, { timedOut: opts?.timedOut });
      if (review.sessionId) setSessionId(review.sessionId);
      if (review.config) setDraftConfig(review.config as QuizSessionConfigInput);
      if (review.history) setHistory(review.history as QuizSessionHistoryItem[]);
      if (review.score) setScore(review.score);
      applyFreeQuota(data as { free_quota?: typeof freeQuota });
      const historyLen = (review.history || data.history || []).length;
      if (
        !(data as { free_quota?: { unlimited?: boolean } }).free_quota?.unlimited &&
        historyLen >= FREE_QUIZ_QUESTIONS_PER_NOTE
      ) {
        const remaining = (data as { free_quota?: { remaining?: number } }).free_quota?.remaining;
        if (remaining == null || Number(remaining) <= 0) {
          markQuizQuotaExhausted();
        }
      }
      setDeadlineAt(null);
      setTimedOut(review.timedOut);
      setPhase('review');
      setSlides([]);
      setSlideIndex(0);
      if (opts?.trackCompletion !== false) {
        quizCompletedRef.current = true;
        analytics.track(
          EVENTS.QUIZ_SESSION_COMPLETED,
          quizSessionCompletedProps({
            data,
            contentId,
            timedOut: Boolean(opts?.timedOut),
            fallbackTotal: data.question_count ?? 10,
            fallbackMode: (data.config as { mode?: string } | undefined)?.mode,
          })
        );
      }
    },
    [contentId]
  );

  const refreshStarred = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await learningEndpoints.listStarredQuizQuestions(contentId, userId);
      setStarred(res.items || []);
    } catch {
      /* non-fatal */
    }
  }, [contentId, userId]);

  const loadQuizSets = useCallback(async () => {
    if (!userId) return;
    try {
      const data = await learningEndpoints.listQuizSessions(contentId, userId);
      setQuizSets(data.items);
      applyFreeQuota(data);
    } catch {
      /* keep previous list */
    }
  }, [contentId, userId]);

  const bootstrap = useCallback(async () => {
    if (!userId || !enabled) return;
    setLoading(true);
    setError('');
    void refreshStarred();
    void loadQuizSets();
    try {
      let session: QuizSessionResponse | null = null;
      try {
        session = await learningEndpoints.getQuizSession(contentId, userId);
      } catch {
        session = null;
      }
      applyFreeQuota(session);
      if (session && isQuizGeneratingPayload(session)) {
        setLoading(false);
        setGenerating(true);
        setCrafting(true);
        setPhase('playing');
        await waitForQuizGenerationRef.current((session as { job_id: string }).job_id, session);
        return;
      }
      if (
        session?.session_id &&
        !isSessionCompleted(session) &&
        (session.question || session.current_question || (session.history || []).length > 0)
      ) {
        setLoading(false);
        setGenerating(false);
        applyPlayingRef.current(session, { trackStart: false });
        return;
      }
      setPhase('setup');
      setGenerating(false);
    } catch (e: any) {
      setError(formatQuizApiError(e, 'Failed to load quiz'));
      setPhase('setup');
      setGenerating(false);
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }, [userId, enabled, contentId, refreshStarred, loadQuizSets]);

  const waitForQuizGeneration = useCallback(
    async (jobId: string, seedData?: QuizSessionResponse | null) => {
      if (!userId) return;
      pollAbortRef.current?.abort();
      const controller = new AbortController();
      pollAbortRef.current = controller;
      setGenerating(true);
      setBusy(true);
      setCrafting(true);
      setPhase('playing');
      setGenerationProgress(Number((seedData as { progress?: number } | null)?.progress) || 0);
      if (seedData?.session_id) setSessionId(seedData.session_id);
      if (seedData?.config) setDraftConfig(seedData.config as QuizSessionConfigInput);
      try {
        const sessionData = await pollQuizGenerationJob({
          jobId,
          contentId,
          userId,
          onProgress: (progress) => setGenerationProgress(progress),
          signal: controller.signal,
        });
        applyPlayingRef.current(sessionData, { skipJobWait: true });
        await Promise.all([refreshStarred(), loadQuizSets()]);
      } catch (e: any) {
        if (isQuizPollCancelled(e)) return;
        setError(handleQuizRequestError(e, 'Failed to prepare quiz questions'));
        setPhase('playing');
        setCrafting(false);
        await loadQuizSets();
      } finally {
        setBusy(false);
        setGenerating(false);
        setGenerationProgress(0);
        pollAbortRef.current = null;
      }
    },
    [userId, contentId, refreshStarred, loadQuizSets]
  );

  useEffect(() => {
    waitForQuizGenerationRef.current = waitForQuizGeneration;
  }, [waitForQuizGeneration]);

  const recoverEmptySession = useCallback(
    async (sid: number) => {
      if (!sid || !userId || generating) return;
      setBusy(true);
      setError('');
      try {
        const data = await learningEndpoints.reactivateQuizSession(sid, userId);
        if (isQuizGeneratingPayload(data)) {
          await waitForQuizGeneration((data as { job_id: string }).job_id, data);
          return;
        }
        applyPlayingRef.current(data, { skipJobWait: true, skipRecovery: true, trackStart: false });
        await loadQuizSets();
      } catch (e: any) {
        setError(handleQuizRequestError(e, 'Failed to prepare quiz questions'));
        setPhase('playing');
      } finally {
        setBusy(false);
      }
    },
    [userId, generating, waitForQuizGeneration, loadQuizSets]
  );

  useEffect(() => {
    recoverEmptySessionRef.current = recoverEmptySession;
  }, [recoverEmptySession]);

  useEffect(() => {
    applyPlayingRef.current = applyPlaying;
  }, [applyPlaying]);

  useEffect(() => {
    return () => pollAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!enabled || !userId) {
      setLoading(false);
      return;
    }
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    bootstrap();
  }, [bootstrap, enabled, userId]);

  useEffect(() => {
    return () => {
      if (phaseRef.current === 'playing' && !quizCompletedRef.current) {
        analytics.track(
          EVENTS.QUIZ_SESSION_ABANDONED,
          quizSessionAbandonedProps({
            contentId,
            mode: configRef.current?.mode,
          })
        );
      }
    };
  }, [contentId]);

  const inProgressSet = useMemo(() => inProgressQuizSet(quizSets), [quizSets]);

  const resetToCollection = useCallback(() => {
    setPhase('setup');
    setSessionId(null);
    setCurrentQuestion(null);
    setCurrentQuestionId(null);
    setGrade(null);
    setSubmitted(false);
    setSelectedAnswer('');
    setSlides([]);
    setSlideIndex(0);
    setScore(null);
    setHistory([]);
    setTimedOut(false);
    setTimeoutFinalizeFailed(false);
    setCrafting(false);
    setNeedsUpgrade(false);
    setDeadlineAt(null);
    setError('');
    void loadQuizSets();
    void refreshStarred();
  }, [loadQuizSets, refreshStarred]);

  const leavePlaying = useCallback(() => {
    if (phaseRef.current === 'playing' && !quizCompletedRef.current) {
      analytics.track(
        EVENTS.QUIZ_SESSION_ABANDONED,
        quizSessionAbandonedProps({
          contentId,
          mode: draftConfig.mode,
        })
      );
      quizCompletedRef.current = true;
    }
    resetToCollection();
  }, [contentId, draftConfig.mode, resetToCollection]);

  const startSession = useCallback(
    async (opts?: { forceNew?: boolean; configOverride?: QuizSessionConfigInput }) => {
      if (!userId || busy) return false;
      const forceNew = opts?.forceNew !== false;
      const nextDraft = opts?.configOverride ?? draftConfig;
      const clamped = clampQuestionCount(nextDraft.question_count, maxQuestionCount);
      if (clamped == null) {
        setError(`Enter a number between ${MIN_QUESTION_COUNT} and ${maxQuestionCount}`);
        return false;
      }
      if (opts?.configOverride) setDraftConfig({ ...nextDraft, question_count: clamped });
      setBusy(true);
      setError('');
      setPhase('playing');
      setCrafting(true);
      let handedOffGeneration = false;
      try {
        const config = buildQuizConfigPayload(
          { ...nextDraft, question_count: clamped },
          chapterIds
        );
        const data = await learningEndpoints.startQuizSession(contentId, userId, config, forceNew);
        applyFreeQuota(data as { free_quota?: typeof freeQuota });
        setGrade(null);
        setSubmitted(false);
        setSelectedAnswer('');
        setScore(null);
        setTimedOut(false);
        if (isQuizGeneratingPayload(data)) {
          handedOffGeneration = true;
          await waitForQuizGeneration((data as { job_id: string }).job_id, data);
        } else {
          applyPlaying(data, { forceNew, skipJobWait: true });
        }
        await Promise.all([refreshStarred(), loadQuizSets()]);
        return true;
      } catch (e: any) {
        setError(handleQuizRequestError(e, 'Failed to start quiz'));
        setPhase('setup');
        setCrafting(false);
        setGenerating(false);
        return false;
      } finally {
        if (!handedOffGeneration) setBusy(false);
      }
    },
    [userId, busy, draftConfig, chapterIds, contentId, applyPlaying, waitForQuizGeneration, refreshStarred, loadQuizSets, maxQuestionCount]
  );

  const openQuizSet = useCallback(
    async (set: QuizSet) => {
      if (!set?.session_id || !userId || busy) return;
      setBusy(true);
      setError('');
      try {
        if (shouldResumeActive(set)) {
          const data = await learningEndpoints.getQuizSession(contentId, userId);
          if (!data.session_id || isSessionCompleted(data)) {
            setError('That quiz is no longer in progress');
            await loadQuizSets();
            return;
          }
          applyPlaying(data, { trackStart: false });
          return;
        }

        if (shouldReactivateIncomplete(set)) {
          const data = await learningEndpoints.reactivateQuizSession(set.session_id, userId);
          applyPlaying(data, { trackStart: false });
          await loadQuizSets();
          return;
        }

        const data = await learningEndpoints.reviewQuizSession(set.session_id, userId);
        applyReview(data, { trackCompletion: false });
      } catch (e: any) {
        setError(formatQuizApiError(e, 'Failed to open quiz set'));
      } finally {
        setBusy(false);
      }
    },
    [userId, busy, contentId, applyPlaying, applyReview, loadQuizSets]
  );

  const appendCurrentSlide = useCallback(
    (override: Partial<Pick<QuizSlide, 'userAnswer' | 'grade'>> = {}) => {
      if (!currentQuestion || !currentQuestionId) return slides;
      const next = appendQuizSlide(slides, {
        questionId: currentQuestionId,
        question: currentQuestion,
        userAnswer: override.userAnswer ?? selectedAnswer,
        grade: override.grade ?? grade,
        position,
      }) as QuizSlide[];
      setSlides(next);
      return next;
    },
    [currentQuestion, currentQuestionId, selectedAnswer, grade, position, slides]
  );

  const applyNextPayload = useCallback(
    (data: QuizSessionResponse, nextSlideIndex?: number) => {
      if (isSessionCompleted(data)) {
        applyReview(data);
        return;
      }
      if (isQuizUpgradeGate(data)) {
        applyUpgradeGate(data);
        return;
      }
      const next = nextQuestionStateFromSession(data, {
        fallbackTotal: total,
        fallbackPosition: position,
        fallbackDeadlineAt: deadlineAt,
      });
      setCurrentQuestion(next.question as QuizSessionQuestion | null);
      setCurrentQuestionId(next.questionId);
      setPosition(next.position);
      setTotal(next.total);
      setSelectedAnswer('');
      setSubmitted(false);
      setGrade(null);
      setDeadlineAt(next.deadlineAt);
      if (next.clockOffsetMs != null) setClockOffsetMs(next.clockOffsetMs);
      if (typeof nextSlideIndex === 'number') setSlideIndex(nextSlideIndex);
      if (next.history) setHistory(next.history as QuizSessionHistoryItem[]);
      setCrafting(
        Boolean((data as QuizSessionResponse & { crafting?: boolean }).crafting) || !next.question
      );
    },
    [applyReview, total, position, deadlineAt]
  );

  const submitAndContinue = useCallback(async () => {
    if (!userId || !sessionId || !currentQuestionId || busy) return;
    if (!selectedAnswer.trim()) {
      setError('Please answer before continuing');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await learningEndpoints.nextQuizQuestion(
        sessionId,
        userId,
        selectedAnswer,
        currentQuestionId
      );
      analytics.track(
        EVENTS.QUIZ_ANSWER_SUBMITTED,
        quizAnswerSubmittedProps({
          contentId,
          mode,
          isCorrect: data.grade?.is_correct ?? null,
        })
      );
      if (isSessionCompleted(data)) {
        const nextSlides = appendCurrentSlide({ grade: data.grade, userAnswer: selectedAnswer });
        setSlides(nextSlides);
        applyReview(data);
        return;
      }
      const nextSlides = appendCurrentSlide({
        grade: data.grade || { question_id: currentQuestionId, is_correct: null },
        userAnswer: selectedAnswer,
      });
      setSlides(nextSlides);
      applyNextPayload(data, nextSlides.length);
    } catch (e: any) {
      setError(formatQuizApiError(e, 'Failed to continue'));
    } finally {
      setBusy(false);
    }
  }, [
    userId,
    sessionId,
    currentQuestionId,
    busy,
    selectedAnswer,
    applyReview,
    applyNextPayload,
    appendCurrentSlide,
    contentId,
    mode,
  ]);

  const submitAnswerOnly = useCallback(async () => {
    if (!userId || !sessionId || !currentQuestionId || busy || submitted || !selectedAnswer.trim()) return;
    if (remainingSecondsFromDeadline(deadlineAt, clockOffsetMs) === 0) return;
    setError('');

    if (mode === 'learn') {
      const localGrade = gradeQuizAnswerLocally(currentQuestion, selectedAnswer);
      if (localGrade) {
        setGrade({ ...localGrade, question_id: currentQuestionId });
        setSubmitted(true);
        playQuizAnswerResult(localGrade.is_correct);
        analytics.track(
          EVENTS.QUIZ_ANSWER_SUBMITTED,
          quizAnswerSubmittedProps({
            contentId,
            mode,
            isCorrect: Boolean(localGrade.is_correct),
          })
        );
        setHistory((prev) =>
          (prev || []).map((h) =>
            h.id === currentQuestionId
              ? { ...h, user_answer: selectedAnswer, is_correct: localGrade.is_correct }
              : h
          )
        );
        persistAnswerRef.current = learningEndpoints
          .nextQuizQuestion(sessionId, userId, selectedAnswer, currentQuestionId, {
            gradeOnly: true,
          })
          .then((data) => {
            if (data.server_now) setClockOffsetMs(Date.parse(data.server_now) - Date.now());
            if (Array.isArray(data.history)) setHistory(data.history as QuizSessionHistoryItem[]);
            learningEndpoints.preGenerateQuizQuestion(sessionId, userId).catch(() => {});
            return data;
          })
          .catch((e: any) => {
            setError(formatQuizApiError(e, 'Failed to save answer'));
          });
        return;
      }
    }

    setBusy(true);
    try {
      const data = await learningEndpoints.nextQuizQuestion(
        sessionId,
        userId,
        selectedAnswer,
        currentQuestionId,
        { gradeOnly: true }
      );
      analytics.track(
        EVENTS.QUIZ_ANSWER_SUBMITTED,
        quizAnswerSubmittedProps({
          contentId,
          mode,
          isCorrect: data.grade?.is_correct ?? null,
        })
      );
      if (data.grade) {
        setGrade(data.grade);
        setSubmitted(true);
        if (typeof data.grade.is_correct === 'boolean') {
          playQuizAnswerResult(data.grade.is_correct);
        }
      }
      if (Array.isArray(data.history)) setHistory(data.history as QuizSessionHistoryItem[]);
      if (isSessionCompleted(data)) {
        const nextSlides = appendCurrentSlide({ grade: data.grade, userAnswer: selectedAnswer });
        setSlides(nextSlides);
        applyReview(data);
        return;
      }
      learningEndpoints.preGenerateQuizQuestion(sessionId, userId).catch(() => {});
    } catch (e: any) {
      setError(formatQuizApiError(e, 'Failed to submit answer'));
    } finally {
      setBusy(false);
    }
  }, [
    userId,
    sessionId,
    currentQuestionId,
    currentQuestion,
    busy,
    submitted,
    selectedAnswer,
    deadlineAt,
    clockOffsetMs,
    applyReview,
    appendCurrentSlide,
    mode,
    contentId,
  ]);

  const selectAnswer = useCallback(
    async (opt: string) => {
      if (!opt || submitted || busy || crafting) return;
      if (remainingSecondsFromDeadline(deadlineAt, clockOffsetMs) === 0) return;
      setSelectedAnswer(opt);
      if (mode !== 'learn') return;
      if (!userId || !sessionId || !currentQuestionId) return;

      const localGrade = gradeQuizAnswerLocally(currentQuestion, opt);
      if (localGrade) {
        setGrade({ ...localGrade, question_id: currentQuestionId });
        setSubmitted(true);
        playQuizAnswerResult(localGrade.is_correct);
        analytics.track(
          EVENTS.QUIZ_ANSWER_SUBMITTED,
          quizAnswerSubmittedProps({
            contentId,
            mode,
            isCorrect: Boolean(localGrade.is_correct),
          })
        );
        setHistory((prev) =>
          (prev || []).map((h) =>
            h.id === currentQuestionId
              ? { ...h, user_answer: opt, is_correct: localGrade.is_correct }
              : h
          )
        );
        persistAnswerRef.current = learningEndpoints
          .nextQuizQuestion(sessionId, userId, opt, currentQuestionId, { gradeOnly: true })
          .then((data) => {
            if (data.server_now) setClockOffsetMs(Date.parse(data.server_now) - Date.now());
            if (Array.isArray(data.history)) setHistory(data.history as QuizSessionHistoryItem[]);
            learningEndpoints.preGenerateQuizQuestion(sessionId, userId).catch(() => {});
            return data;
          })
          .catch((e: any) => {
            setError(formatQuizApiError(e, 'Failed to save answer'));
          });
        return;
      }

      setBusy(true);
      try {
        const data = await learningEndpoints.nextQuizQuestion(
          sessionId,
          userId,
          opt,
          currentQuestionId,
          { gradeOnly: true }
        );
        if (data.server_now) setClockOffsetMs(Date.parse(data.server_now) - Date.now());
        setGrade(data.grade || null);
        setSubmitted(true);
        if (typeof data.grade?.is_correct === 'boolean') {
          playQuizAnswerResult(data.grade.is_correct);
        }
        if (Array.isArray(data.history)) setHistory(data.history as QuizSessionHistoryItem[]);
        analytics.track(
          EVENTS.QUIZ_ANSWER_SUBMITTED,
          quizAnswerSubmittedProps({
            contentId,
            mode,
            isCorrect: data.grade?.is_correct ?? null,
          })
        );
        learningEndpoints.preGenerateQuizQuestion(sessionId, userId).catch(() => {});
      } catch (e: any) {
        setError(formatQuizApiError(e, 'Failed to submit answer'));
      } finally {
        setBusy(false);
      }
    },
    [
      submitted,
      busy,
      crafting,
      deadlineAt,
      clockOffsetMs,
      mode,
      userId,
      sessionId,
      currentQuestionId,
      currentQuestion,
      contentId,
    ]
  );

  const continueAfterFeedback = useCallback(async () => {
    if (!userId || !sessionId || advancing || busy) return;
    const priorGrade = grade;
    const priorAnswer = selectedAnswer;
    const priorPosition = position;
    const priorQuestion = currentQuestion;
    const priorQuestionId = currentQuestionId;
    const nextSlides = appendCurrentSlide();
    const historyForGate = (history || []).map((row) =>
      row.id === priorQuestionId && (row.user_answer == null || String(row.user_answer).length === 0)
        ? { ...row, user_answer: priorAnswer || 'answered' }
        : row
    );
    // Keep live view and clear feedback immediately so the answered slide in
    // history does not flash the feedback panel before the next question loads.
    setSlideIndex(nextSlides.length);
    setGrade(null);
    setSubmitted(false);
    setAdvancing(true);
    setError('');
    setPosition(Math.min(priorPosition + 1, total));
    try {
      await persistAnswerRef.current;

      const banked =
        mode === 'learn'
          ? nextLearnQuestionFromHistory({
              history: historyForGate,
              currentQuestionId: priorQuestionId,
              position: priorPosition,
              total,
            })
          : { kind: 'unavailable' as const };

      if (banked.kind === 'next') {
        setCurrentQuestion(banked.question as QuizSessionQuestion);
        setCurrentQuestionId(banked.id);
        setPosition(Math.min(priorPosition + 1, total));
        setSelectedAnswer('');
        setSubmitted(false);
        setGrade(null);
        setSlideIndex(nextSlides.length);
        setCrafting(false);
        return;
      }

      if (
        shouldGateFreeQuizContinue({
          isPro,
          freeQuota,
          history: historyForGate,
          hasBankedNext: false,
          sessionComplete: banked.kind === 'complete',
        })
      ) {
        applyUpgradeGate(
          asQuizUpgradeGatePayload({
            session_id: sessionId,
            history: historyForGate,
            position: priorPosition,
            total,
            question_count: total,
            free_quota: freeQuota,
          }) as QuizSessionResponse
        );
        return;
      }

      if (banked.kind === 'complete') {
        if (!isPro) {
          setCrafting(true);
          setCurrentQuestion(null);
          const gateData = await learningEndpoints.nextQuizQuestion(sessionId, userId, null, null);
          applyNextPayload(gateData, nextSlides.length);
          return;
        }
        const data = await learningEndpoints.completeQuizSession(sessionId, userId);
        applyReview(data);
        return;
      }

      setCrafting(true);
      setCurrentQuestion(null);
      let data = await learningEndpoints.nextQuizQuestion(sessionId, userId, null, null);
      if (
        isQuizUpgradeGate(data) ||
        shouldGateFreeQuizContinue({
          isPro,
          freeQuota: (data as QuizSessionResponse & { free_quota?: typeof freeQuota }).free_quota ?? freeQuota,
          history: data.history || historyForGate,
        })
      ) {
        applyUpgradeGate(asQuizUpgradeGatePayload(data as Record<string, unknown>) as QuizSessionResponse);
        return;
      }
      if (isSessionCompleted(data)) {
        applyNextPayload(data, nextSlides.length);
        return;
      }
      if (
        (data as QuizSessionResponse & { crafting?: boolean })?.crafting ||
        (!data?.question && !data?.current_question && !isSessionCompleted(data))
      ) {
        data = await pollUntilQuestionReady({
          contentId,
          userId,
          sessionId,
          signal: pollAbortRef.current?.signal,
        });
      }
      setCrafting(false);
      applyNextPayload(data, nextSlides.length);
    } catch (e: any) {
      if (!isQuizPollCancelled(e)) {
        setError(formatQuizApiError(e, 'Failed to load next question'));
      }
      setPosition(priorPosition);
      setCurrentQuestion(priorQuestion);
      setCurrentQuestionId(priorQuestionId);
      setGrade(priorGrade);
      setSelectedAnswer(priorAnswer);
      setSubmitted(Boolean(priorGrade));
      setSlideIndex(nextSlides.length);
      setCrafting(false);
    } finally {
      setAdvancing(false);
    }
  }, [
    userId,
    sessionId,
    advancing,
    busy,
    applyReview,
    applyNextPayload,
    appendCurrentSlide,
    position,
    total,
    mode,
    history,
    currentQuestionId,
    currentQuestion,
    grade,
    selectedAnswer,
    contentId,
    isPro,
    freeQuota,
  ]);

  const continueAfterUpgrade = useCallback(async () => {
    if (!sessionId || !userId) return;
    setNeedsUpgrade(false);
    setCrafting(true);
    setAdvancing(true);
    setError('');
    try {
      let data = await learningEndpoints.nextQuizQuestion(sessionId, userId, null, null);
      if (isQuizGeneratingPayload(data)) {
        await waitForQuizGenerationRef.current((data as { job_id: string }).job_id, data);
        return;
      }
      if (isQuizUpgradeGate(data)) {
        applyUpgradeGate(data);
        return;
      }
      if (
        (data as QuizSessionResponse & { crafting?: boolean })?.crafting ||
        (!data?.question && !data?.current_question && !isSessionCompleted(data))
      ) {
        data = await pollUntilQuestionReady({
          contentId,
          userId,
          sessionId,
          signal: pollAbortRef.current?.signal,
        });
      }
      applyPlayingRef.current(data, { skipJobWait: true, skipRecovery: true, trackStart: false });
    } catch (e: any) {
      setError(formatQuizApiError(e, 'Failed to continue quiz'));
      setNeedsUpgrade(true);
    } finally {
      setCrafting(false);
      setAdvancing(false);
    }
  }, [sessionId, userId, contentId]);

  const continueAfterUpgradeRef = useRef(continueAfterUpgrade);
  continueAfterUpgradeRef.current = continueAfterUpgrade;

  useEffect(() => {
    if (!isPro || !needsUpgrade || !sessionId) return;
    void continueAfterUpgradeRef.current();
  }, [isPro, needsUpgrade, sessionId]);

  const completeDueToTimeout = useCallback(async () => {
    if (!userId || !sessionId || completingRef.current) return;
    completingRef.current = true;
    setTimeoutFinalizeFailed(false);
    try {
      const data = await learningEndpoints.completeQuizSession(sessionId, userId);
      applyReview(data, { timedOut: true });
    } catch (e: any) {
      setTimeoutFinalizeFailed(true);
      setError(formatQuizApiError(e, 'Time is up. Could not finish quiz'));
    } finally {
      completingRef.current = false;
    }
  }, [userId, sessionId, applyReview]);

  const resetLiveQuiz = useCallback(async () => {
    if (!sessionId || !userId || busy) return;
    setBusy(true);
    setCrafting(true);
    setPhase('playing');
    setError('');
    try {
      const data = await learningEndpoints.resetQuizSession(sessionId, userId);
      setSlides([]);
      setSlideIndex(0);
      setGrade(null);
      setSubmitted(false);
      setSelectedAnswer('');
      if (isQuizGeneratingPayload(data)) {
        await waitForQuizGeneration((data as { job_id: string }).job_id, data);
      } else {
        setCrafting(false);
        applyPlaying(data, { skipJobWait: true, skipRecovery: true });
      }
    } catch (e: any) {
      setError(handleQuizRequestError(e, 'Failed to reset quiz'));
      setCrafting(false);
    } finally {
      setBusy(false);
    }
  }, [sessionId, userId, busy, waitForQuizGeneration, applyPlaying]);

  const applyLiveSettings = useCallback(async () => {
    if (!sessionId || !userId || busy) return false;
    setBusy(true);
    setPhase('playing');
    setError('');
    try {
      await persistAnswerRef.current;
      const clamped = clampQuestionCount(draftConfig.question_count);
      if (clamped == null) {
        setError(`Enter a number between ${MIN_QUESTION_COUNT} and ${MAX_QUESTION_COUNT}`);
        return false;
      }
      const payload = buildQuizConfigPayload(
        { ...draftConfig, question_count: clamped },
        chapterIds
      );
      const data = await learningEndpoints.updateQuizConfig(
        sessionId,
        userId,
        payload,
        currentQuestionId || null
      );
      if (data.config) {
        setDraftConfig(applyConfigFromServer(data.config as Record<string, unknown>));
      }
      if (Array.isArray(data.history)) setHistory(data.history as QuizSessionHistoryItem[]);
      if (data.session_id) setSessionId(data.session_id);

      if (isQuizGeneratingPayload(data)) {
        setSlides([]);
        setSlideIndex(0);
        setGrade(null);
        setSubmitted(false);
        setSelectedAnswer('');
        setCrafting(true);
        await waitForQuizGeneration((data as { job_id: string }).job_id, data);
        await loadQuizSets();
        return true;
      }
      if (isSessionCompleted(data)) {
        applyReview(data);
        return true;
      }

      const sameSession = !data.session_id || data.session_id === sessionId;
      if (sameSession && (data.question || data.question_id)) {
        setCurrentQuestion((data.question as QuizSessionQuestion) || null);
        setCurrentQuestionId(data.question_id || null);
        if (data.position != null) setPosition(data.position);
        if (data.total != null) setTotal(data.total);
        setCrafting(false);
        setGenerating(false);
        return true;
      }

      setSlides([]);
      setSlideIndex(0);
      setGrade(null);
      setSubmitted(false);
      setSelectedAnswer('');
      if ((data as QuizSessionResponse & { crafting?: boolean }).crafting || !data.question) {
        setCrafting(true);
        const ready = await pollUntilQuestionReady({
          contentId,
          userId,
          sessionId: data.session_id || sessionId,
        });
        setCrafting(false);
        applyPlaying(ready, { skipJobWait: true, skipRecovery: true, trackStart: false });
      } else {
        setCrafting(false);
        applyPlaying(data, { skipJobWait: true, skipRecovery: true, trackStart: !sameSession });
      }
      await loadQuizSets();
      return true;
    } catch (e: any) {
      if (isQuizPollCancelled(e)) return false;
      setError(handleQuizRequestError(e, 'Failed to update quiz settings'));
      setCrafting(false);
      return false;
    } finally {
      setBusy(false);
    }
  }, [
    sessionId,
    userId,
    busy,
    draftConfig,
    chapterIds,
    currentQuestionId,
    waitForQuizGeneration,
    loadQuizSets,
    applyReview,
    contentId,
    applyPlaying,
  ]);

  const jumpToQuestion = useCallback(
    (questionNumber: number) => {
      const idx = Math.max(1, Math.min(total, Number(questionNumber) || 1));
      const row = history[idx - 1];
      if (!row) return;
      if (row.user_answer != null) {
        const slideIdx = slides.findIndex((s) => s.questionId === row.id);
        if (slideIdx >= 0) {
          setSlideIndex(slideIdx);
          return;
        }
        const synthetic = appendQuizSlide([], {
          questionId: row.id,
          question: row.question,
          userAnswer: row.user_answer || '',
          grade: {
            is_correct: row.is_correct,
            correct_answer: row.question?.correct_answer,
            explanation: row.question?.explanation,
            user_answer: row.user_answer,
          },
          position: idx,
        }) as QuizSlide[];
        setSlides(synthetic);
        setSlideIndex(0);
        return;
      }
      setSlides([]);
      setSlideIndex(0);
      setCurrentQuestion(row.question as QuizSessionQuestion);
      setCurrentQuestionId(row.id);
      setPosition(idx);
      setSelectedAnswer('');
      setGrade(null);
      setSubmitted(false);
      setCrafting(false);
    },
    [total, history, slides]
  );

  const findStarredForQuestion = useCallback(
    (question: QuizSessionQuestion | Record<string, unknown> | null | undefined) =>
      findStarredInList(starred, question),
    [starred]
  );

  const toggleStarCurrent = useCallback(
    async (
      questionOverride: QuizSessionQuestion | null = null,
      topicIdOverride: number | null = null
    ) => {
      const q = questionOverride || currentQuestion;
      if (!userId || !q) return;
      const existing = findStarredForQuestion(q);
      if (existing) {
        setStarred((prev) => prev.filter((item) => item.id !== existing.id));
        try {
          await learningEndpoints.unstarQuizQuestion(existing.id, userId);
        } catch (e: any) {
          setError(formatQuizApiError(e, 'Failed to unstar'));
          await refreshStarred();
        }
        return;
      }
      const fullQuestion = {
        ...q,
        correct_answer: grade?.correct_answer ?? q.correct_answer,
        explanation: grade?.explanation ?? q.explanation,
      };
      const topicId =
        topicIdOverride ?? history.find((h) => h.id === currentQuestionId)?.topic_id ?? null;
      try {
        await learningEndpoints.starQuizQuestion(contentId, userId, fullQuestion, topicId);
        await refreshStarred();
      } catch (e: any) {
        setError(formatQuizApiError(e, 'Failed to star question'));
      }
    },
    [
      userId,
      currentQuestion,
      findStarredForQuestion,
      grade,
      history,
      currentQuestionId,
      contentId,
      refreshStarred,
    ]
  );

  const unstar = useCallback(
    async (starredId: number) => {
      if (!userId) return;
      setStarred((prev) => prev.filter((item) => item.id !== starredId));
      try {
        await learningEndpoints.unstarQuizQuestion(starredId, userId);
      } catch (e: any) {
        setError(formatQuizApiError(e, 'Failed to unstar'));
        await refreshStarred();
      }
    },
    [userId, refreshStarred]
  );

  const display = displayFromSlides({
    slides,
    slideIndex,
    currentQuestion,
    grade,
    userAnswer: selectedAnswer,
    submitted,
    position,
    total,
  }) as {
    viewingPast: boolean;
    displayQuestion: QuizSessionQuestion | null;
    displayGrade: QuizGrade | null;
    displayAnswer: string;
    displaySubmitted: boolean;
    displayPosition: number;
    canGoPrev: boolean;
    canGoNext: boolean;
  };
  const isCurrentStarred = isStarredInList(starred, display.displayQuestion);

  const goPrevSlide = useCallback(() => {
    setSlideIndex((i) =>
      nextSlideIndexAfterPrev({
        slideIndex: i,
        viewingPast: i < slides.length,
        slidesLength: slides.length,
      })
    );
  }, [slides.length]);

  const goNextSlide = useCallback(() => {
    setSlideIndex((i) =>
      nextSlideIndexAfterNext({
        slideIndex: i,
        viewingPast: i < slides.length,
        slidesLength: slides.length,
      })
    );
  }, [slides.length]);

  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!deadlineAt || phase !== 'playing') return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadlineAt, phase]);

  const remainingMs = remainingMsFromDeadline(deadlineAt, clockOffsetMs, nowMs);
  const remainingSeconds = remainingSecondsFromDeadline(deadlineAt, clockOffsetMs, nowMs);
  const timerLabel = formatQuizTimerLabel(remainingSeconds);

  useEffect(() => {
    if (phase !== 'playing' || remainingMs == null || remainingMs > 0) return;
    completeDueToTimeout();
  }, [phase, remainingMs, completeDueToTimeout]);

  const scoreSummary = useMemo(() => quizScoreSummary(score, total), [score, total]);

  return {
    phase,
    setPhase,
    draftConfig,
    setDraftConfig,
    sessionId,
    currentQuestion,
    currentQuestionId,
    history,
    position,
    total,
    selectedAnswer,
    setSelectedAnswer,
    grade,
    submitted,
    setSubmitted,
    deadlineAt,
    remainingMs,
    remainingSeconds,
    timerLabel,
    score,
    scoreSummary,
    starred,
    quizSets,
    inProgressSet,
    quotaExhausted,
    needsUpgrade,
    maxQuestionCount,
    loading,
    busy,
    generating,
    generationProgress,
    advancing,
    crafting,
    error,
    setError,
    mode,
    timedOut,
    timeoutFinalizeFailed,
    isCurrentStarred,
    findStarredForQuestion,
    startSession,
    openQuizSet,
    leavePlaying,
    resetToCollection,
    recoverEmptySession,
    submitAndContinue,
    submitAnswerOnly,
    selectAnswer,
    continueAfterFeedback,
    continueAfterUpgrade,
    applyLiveSettings,
    resetLiveQuiz,
    jumpToQuestion,
    toggleStarCurrent,
    unstar,
    bootstrap,
    refreshStarred,
    loadQuizSets,
    completeDueToTimeout,
    displayQuestion: display.displayQuestion as QuizSessionQuestion | null,
    displayGrade: display.displayGrade as QuizGrade | null,
    displayAnswer: display.displayAnswer,
    displaySubmitted: display.displaySubmitted,
    displayPosition: display.displayPosition,
    viewingPast: display.viewingPast,
    canGoPrev: display.canGoPrev,
    canGoNext: display.canGoNext,
    goPrevSlide,
    goNextSlide,
  };
}
