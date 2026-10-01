import { contentEndpoints } from '@/api/endpoints/content';
import { learningEndpoints } from '@/api/endpoints/studyHub';
import type { QuizSessionResponse } from '@/api/schemas/studyHub';
import { asQuizUpgradeGatePayload, isQuizQuotaExhausted } from '@/study-hub/quizConfig';

export const QUIZ_SESSION_GENERATION_JOB_TYPE = 'quiz_session_generation';

const POLL_INTERVAL_MS = 700;
/** Faster cadence while waiting for the first playable question. */
const FIRST_READY_POLL_INTERVAL_MS = 350;
const MAX_POLL_MS = 25 * 60 * 1000;
const POLL_ERROR_RETRIES = 3;
const POLL_STALL_MS = 45_000;

export class QuizPollCancelledError extends Error {
  cancelled = true;

  constructor() {
    super('Quiz generation cancelled');
    this.name = 'QuizPollCancelledError';
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isQuizPollCancelled(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      ('cancelled' in error || (error as { name?: string }).name === 'QuizPollCancelledError')
  );
}

export function isQuizGeneratingPayload(data: QuizSessionResponse | null | undefined): boolean {
  const payload = data as QuizSessionResponse & { generating?: boolean; job_id?: string };
  return Boolean(payload?.generating && payload?.job_id);
}

function isPlayableSession(data: QuizSessionResponse | null | undefined): boolean {
  return Boolean(
    data?.question ||
      data?.current_question ||
      (Array.isArray(data?.history) && data.history.length > 0)
  );
}

async function fetchJobStatus(jobId: string, signal?: AbortSignal) {
  let lastError: unknown;
  for (let attempt = 0; attempt < POLL_ERROR_RETRIES; attempt += 1) {
    if (signal?.aborted) {
      throw new QuizPollCancelledError();
    }
    try {
      return await contentEndpoints.getJobStatus(jobId);
    } catch (error) {
      lastError = error;
      if (isQuizPollCancelled(error) || attempt >= POLL_ERROR_RETRIES - 1) {
        throw error;
      }
      await sleep(POLL_INTERVAL_MS * (attempt + 1));
    }
  }
  throw lastError || new Error('Failed to check quiz generation status');
}

export async function pollQuizGenerationJob({
  jobId,
  contentId,
  userId,
  onProgress,
  signal,
  waitForComplete = false,
}: {
  jobId: string;
  contentId: number;
  userId: number;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
  waitForComplete?: boolean;
}): Promise<QuizSessionResponse> {
  const started = Date.now();
  let lastProgress = -1;
  let lastProgressAt = started;
  let sawPlayableHint = false;
  while (Date.now() - started < MAX_POLL_MS) {
    if (signal?.aborted) {
      throw new QuizPollCancelledError();
    }
    const job = await fetchJobStatus(jobId, signal);
    const progress = Number(job.progress) || 0;
    if (progress !== lastProgress) {
      lastProgress = progress;
      lastProgressAt = Date.now();
    } else if (
      (job.status === 'pending' || job.status === 'processing') &&
      Date.now() - lastProgressAt >= POLL_STALL_MS
    ) {
      throw new Error('Quiz generation stopped updating. Please close this and try again.');
    }
    onProgress?.(progress);

    const result = job.result as
      | { session?: QuizSessionResponse; playable?: boolean }
      | undefined;
    const embedded = result?.session;
    const playable = Boolean(result?.playable) && isPlayableSession(embedded);
    if (result?.playable || playable) sawPlayableHint = true;

    // Unlock when the first batch is ready — bank keeps filling.
    if (!waitForComplete && playable && embedded) {
      return embedded;
    }

    if (job.status === 'completed') {
      if (isPlayableSession(embedded) && embedded) {
        return embedded;
      }
      const session = await learningEndpoints.getQuizSession(contentId, userId);
      if (!session?.question && !session?.current_question && !session?.session_id) {
        throw new Error('Quiz finished generating but could not load questions');
      }
      return session;
    }

    if (job.status === 'blocked' || job.status === 'upgrade_required') {
      throw new Error(job.user_message || 'Quiz generation blocked');
    }
    if (job.status === 'failed') {
      throw new Error(job.user_message || 'Quiz generation failed');
    }

    const interval =
      !sawPlayableHint && progress < 50
        ? FIRST_READY_POLL_INTERVAL_MS
        : POLL_INTERVAL_MS;
    await sleep(interval);
  }
  throw new Error('Quiz generation is taking longer than expected. Please try again.');
}

export async function findPendingQuizGenerationJob(userId: number, contentId: number) {
  try {
    const data = await contentEndpoints.getUserJobs(userId, QUIZ_SESSION_GENERATION_JOB_TYPE, contentId);
    return (
      (data.jobs || []).find((job) => job.status === 'pending' || job.status === 'processing') || null
    );
  } catch {
    return null;
  }
}

/** Poll GET session until a question is ready (crafting next). */
export async function pollUntilQuestionReady({
  contentId,
  userId,
  sessionId,
  signal,
  maxMs = 90_000,
}: {
  contentId: number;
  userId: number;
  sessionId: number | null | undefined;
  signal?: AbortSignal;
  maxMs?: number;
}): Promise<QuizSessionResponse> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    if (signal?.aborted) {
      throw new QuizPollCancelledError();
    }
    let data: QuizSessionResponse;
    try {
      data = await learningEndpoints.getQuizSession(contentId, userId);
    } catch {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    if (data?.session_id && sessionId && data.session_id !== sessionId) {
      return data;
    }
    if ((data as QuizSessionResponse & { needs_upgrade?: boolean })?.needs_upgrade) {
      return data;
    }
    if (isQuizQuotaExhausted((data as QuizSessionResponse & { free_quota?: { unlimited?: boolean; remaining?: number | null } }).free_quota)) {
      const unanswered = (data.history || []).some(
        (h) => h.user_answer == null || String(h.user_answer).length === 0
      );
      if (!unanswered) {
        return asQuizUpgradeGatePayload(data as Record<string, unknown>) as QuizSessionResponse;
      }
    }
    const crafting = Boolean((data as QuizSessionResponse & { crafting?: boolean })?.crafting);
    if ((data?.question || data?.current_question) && !crafting) {
      return data;
    }
    if (sessionId) {
      learningEndpoints.preGenerateQuizQuestion(sessionId, userId).catch(() => {});
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Still crafting your next question. Please try again.');
}
