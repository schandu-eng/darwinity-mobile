import { MAX_QUESTIONS, MIN_QUESTIONS } from './testPrepConstants';

export function parseQuestionCount(raw: string | number | null | undefined): number | null {
  const trimmed = String(raw ?? '').trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < MIN_QUESTIONS || n > MAX_QUESTIONS) return null;
  return n;
}

export function formatWhen(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function sessionStatusMeta(status?: string | null): {
  label: string;
  bg: string;
  fg: string;
  darkBg: string;
  darkFg: string;
} {
  if (status === 'completed') {
    return {
      label: 'Completed',
      bg: '#D1FAE5',
      fg: '#065F46',
      darkBg: 'rgba(6, 78, 59, 0.5)',
      darkFg: '#A7F3D0',
    };
  }
  return {
    label: 'In progress',
    bg: '#FEF3C7',
    fg: '#92400E',
    darkBg: 'rgba(120, 53, 15, 0.5)',
    darkFg: '#FDE68A',
  };
}

export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Calendar-day delta from today to an ISO exam date (YYYY-MM-DD). Null if missing/invalid. */
export function getExamDateDiffDays(
  examDate?: string | null,
  now: Date = new Date()
): number | null {
  if (!examDate) return null;
  const raw = String(examDate).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map(Number);
  const exam = new Date(y, m - 1, d);
  if (Number.isNaN(exam.getTime())) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((exam.getTime() - today.getTime()) / 86400000);
}

/** Days-left label from an ISO exam date (YYYY-MM-DD). Returns null if missing/invalid. */
export function formatExamCountdown(
  examDate?: string | null,
  now: Date = new Date()
): string | null {
  const diffDays = getExamDateDiffDays(examDate, now);
  if (diffDays == null) return null;
  if (diffDays === 0) return 'Exam today';
  if (diffDays === 1) return '1 day left';
  if (diffDays > 1) return `${diffDays} days left`;
  if (diffDays === -1) return 'Exam was 1 day ago';
  return `Exam was ${Math.abs(diffDays)} days ago`;
}

/** Human-readable exam date, e.g. "Oct 16, 2026". */
export function formatExamDateLabel(examDate?: string | null): string | null {
  if (!examDate) return null;
  const raw = String(examDate).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map(Number);
  const exam = new Date(y, m - 1, d);
  if (Number.isNaN(exam.getTime())) return null;
  return exam.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export type ExamCountdownTone = 'urgent' | 'soon' | 'ok' | 'past';

/** Visual tone for countdown badges. */
export function examCountdownTone(
  examDate?: string | null,
  now: Date = new Date()
): ExamCountdownTone | null {
  const diffDays = getExamDateDiffDays(examDate, now);
  if (diffDays == null) return null;
  if (diffDays < 0) return 'past';
  if (diffDays <= 3) return 'urgent';
  if (diffDays <= 14) return 'soon';
  return 'ok';
}

/** Local midnight at the start of an ISO exam date (YYYY-MM-DD). Null if missing/invalid. */
export function getExamDeadlineMs(examDate?: string | null): number | null {
  if (!examDate) return null;
  const raw = String(examDate).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split('-').map(Number);
  const exam = new Date(y, m - 1, d);
  if (Number.isNaN(exam.getTime())) return null;
  return exam.getTime();
}

export type ExamRemainingParts = {
  past: boolean;
  totalMs: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

/** Live remaining breakdown until exam local midnight. */
export function getExamRemainingParts(
  examDate?: string | null,
  now: Date = new Date()
): ExamRemainingParts | null {
  const deadlineMs = getExamDeadlineMs(examDate);
  if (deadlineMs == null) return null;
  const totalMs = deadlineMs - now.getTime();
  const past = totalMs < 0;
  const abs = Math.abs(totalMs);
  const totalSeconds = Math.floor(abs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { past, totalMs, days, hours, minutes, seconds };
}

/** Compact live remaining label, e.g. "11d 04h 12m 08s". Null when past or invalid. */
export function formatExamRemaining(
  examDate?: string | null,
  now: Date = new Date()
): string | null {
  const parts = getExamRemainingParts(examDate, now);
  if (!parts || parts.past) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (parts.days > 0) {
    return `${parts.days}d ${pad(parts.hours)}h ${pad(parts.minutes)}m ${pad(parts.seconds)}s`;
  }
  return `${pad(parts.hours)}h ${pad(parts.minutes)}m ${pad(parts.seconds)}s`;
}
