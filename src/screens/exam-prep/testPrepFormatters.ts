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
