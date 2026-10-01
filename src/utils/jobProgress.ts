import type { JobStatus } from '@/api/schemas/content';

export type ProgressStage = 1 | 2 | 3;

export interface JobProgressState {
  stage: ProgressStage;
  progress: number;
  statusText: string;
  contextualMessage?: string;
}

const NOTES_BAND_START = 40;

const num = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const job2Stage = (job2Status: JobStatus | null): string | null => {
  const result = job2Status?.result && typeof job2Status.result === 'object' ? job2Status.result : null;
  return result && typeof (result as { stage?: unknown }).stage === 'string'
    ? (result as { stage: string }).stage
    : null;
};

const notesStatusText = (stage: string | null, notesPct: number): string => {
  if (stage === 'reading' || notesPct < 6) return 'Reading your document';
  if (stage === 'reading_figures' || (notesPct < 28 && stage !== 'writing_notes' && stage !== 'finding_topics' && stage !== 'organizing' && stage !== 'done')) {
    return 'Reading figures';
  }
  if (stage === 'organizing' || stage === 'done' || notesPct >= 95) return 'Organizing into chapters';
  return 'Preparing your notes';
};

const mapNotesJobToDisplay = (notesPct: number): number =>
  NOTES_BAND_START + (Math.min(100, Math.max(0, notesPct)) / 100) * (100 - NOTES_BAND_START);

export function getJobProgressState(
  job1Status: JobStatus | null,
  job2Status: JobStatus | null,
  isUploading: boolean
): JobProgressState {
  if (!isUploading && (job2Status?.status === 'processing' || job2Status?.status === 'completed')) {
    const p = num(job2Status.progress);
    const stage = job2Stage(job2Status);

    if (job2Status.status === 'completed') {
      return { stage: 3, progress: 100, statusText: 'Preparing your notes' };
    }

    return {
      stage: 3,
      progress: mapNotesJobToDisplay(p),
      statusText: notesStatusText(stage, p),
    };
  }

  if (!isUploading && job1Status?.status === 'completed') {
    return { stage: 3, progress: NOTES_BAND_START, statusText: 'Preparing your notes' };
  }

  if (!isUploading && job1Status?.status === 'processing') {
    const p = num(job1Status.progress);
    const mapped = 5 + (p / 100) * (NOTES_BAND_START - 5);
    if (p <= 50) {
      return { stage: 1, progress: Math.max(5, Math.min(NOTES_BAND_START, mapped)), statusText: 'Uploading your content' };
    }
    const userMessage =
      job1Status.user_message ||
      (job1Status.result && typeof job1Status.result === 'object' && 'status_message' in job1Status.result
        ? (job1Status.result as { status_message?: string }).status_message
        : undefined);
    const contextualMessage =
      userMessage && (userMessage.includes('pages') || userMessage.includes('large'))
        ? "That's a lot of pages! Taking time to capture everything"
        : undefined;
    return {
      stage: 2,
      progress: Math.min(NOTES_BAND_START, Math.max(18, mapped)),
      statusText: 'Processing your content',
      contextualMessage,
    };
  }

  return { stage: 1, progress: 5, statusText: 'Uploading your content' };
}
