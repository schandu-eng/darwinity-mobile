import type { JobStatus } from '@/api/schemas/content';

const STAGE_LABELS: Record<string, string> = {
  reading: 'Reading your document',
  reading_figures: 'Reading figures',
  writing_notes: 'Preparing your notes',
  organizing: 'Organizing into chapters',
  done: 'Finishing up',

  finding_topics: 'Preparing your notes',
};

export const notesStageLabel = (stage?: string | null): string | null =>
  stage ? STAGE_LABELS[stage] ?? null : null;

export const formatNotesEta = (
  etaSeconds?: number | null,
  completed?: number | null,
  total?: number | null
): string | null => {
  if (total && completed != null && completed / total >= 0.95) return 'finishing up…';
  if (typeof etaSeconds !== 'number') return null;
  if (etaSeconds <= 60) return 'less than a minute left';
  return `about ${Math.round(etaSeconds / 60)} min left`;
};

export type JobProgress = {
  stage: string | null;
  progress: number | null;
  completed: number | null;
  total: number | null;
  etaSeconds: number | null;
};

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export const getJobProgress = (jobStatus?: JobStatus | null): JobProgress => {
  const result =
    jobStatus?.result && typeof jobStatus.result === 'object' ? jobStatus.result : {};
  return {
    stage: typeof result.stage === 'string' ? result.stage : null,
    progress: num(jobStatus?.progress) ?? num(result.progress),
    completed: num(result.completed),
    total: num(result.total),
    etaSeconds: num(result.eta_seconds),
  };
};

export const isJobGenerating = (jobStatus?: JobStatus | null): boolean =>
  jobStatus?.status === 'processing' || jobStatus?.status === 'pending';
