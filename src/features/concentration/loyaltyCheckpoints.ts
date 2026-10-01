
export const LOYALTY_CHECKPOINTS = [
  {
    code: 'A',
    minL: 4,
    percent: 0.1,
    title: 'Spark',
    blurb: 'First reward unlock. A few focused sessions get you here.',
  },
  {
    code: 'B',
    minL: 8,
    percent: 0.05,
    title: 'Glow',
    blurb: 'Habit forming. Keep the streak of pomodoros going.',
  },
  {
    code: 'C',
    minL: 14,
    percent: 0.05,
    title: 'Blaze',
    blurb: 'Solid study month territory. Another reward unlock.',
  },
  {
    code: 'D',
    minL: 22,
    percent: 0.05,
    title: 'Orbit',
    blurb: 'Period max. You claimed the full checkpoint ladder.',
  },
] as const;

export const TOTAL_CHECKPOINT_PERCENT = LOYALTY_CHECKPOINTS.reduce(
  (sum, c) => sum + c.percent,
  0
);

export function formatScore(value: number | null | undefined): string {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(1) : '0.0';
}

export function formatMinutes(seconds: number | null | undefined): string {
  const m = Math.max(0, Math.round(Number(seconds) / 60) || 0);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

const BAR_CEILING_MINUTES = [
  15, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480, 600, 720, 960, 1200, 1440,
] as const;

export function formatShortDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '-';
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return String(isoDate).slice(0, 10);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Day of month for 14-day chart axis labels. */
export function formatDayNumber(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return String(d.getDate());
}

/** Round a peak duration up to a readable chart scale (15m, 30m, 1h, …). */
export function niceBarCeilingSeconds(seconds: number | null | undefined): number {
  const mins = Math.max((Number(seconds) || 0) / 60, 15);
  const step = BAR_CEILING_MINUTES.find((m) => m >= mins);
  return (step || Math.ceil(mins / 60) * 60) * 60;
}

/** 0–1 fill for a day bar. Empty days stay at 0; studied days keep a visible stub. */
export function dayBarRatio(
  seconds: number | null | undefined,
  ceilingSeconds: number | null | undefined
): number {
  const value = Math.max(0, Number(seconds) || 0);
  if (value <= 0) return 0;
  const ceiling = Math.max(Number(ceilingSeconds) || 0, 1);
  return Math.min(1, Math.max(0.08, value / ceiling));
}

export function formatPeriodRange(
  start: string | null | undefined,
  end: string | null | undefined
): string {
  return `${formatShortDate(start)} → ${formatShortDate(end)}`;
}

export type CheckpointStatus = 'claimed' | 'ready' | 'current' | 'locked';

export function getCheckpointStates(L: number | null | undefined, claimed: string[] = []) {
  const claimedSet = new Set((claimed || []).map(String));
  const score = Number(L) || 0;
  let foundNext = false;

  return LOYALTY_CHECKPOINTS.map((cp) => {
    const isClaimed = claimedSet.has(cp.code);
    const reached = score >= cp.minL;
    let status: CheckpointStatus = 'locked';
    if (isClaimed || reached) {
      status = isClaimed ? 'claimed' : 'ready';
    } else if (!foundNext) {
      status = 'current';
      foundNext = true;
    }
    return { ...cp, status, progress: Math.min(1, score / cp.minL) };
  });
}

export function getQuestProgress(me: {
  L?: number;
  checkpoints_claimed?: string[];
  next_checkpoint?: {
    code: string;
    min_L: number;
    remaining_L: number;
  } | null;
} | null) {
  const score = Number(me?.L) || 0;
  const claimed = new Set((me?.checkpoints_claimed || []).map(String));

  const next =
    LOYALTY_CHECKPOINTS.find((cp) => !claimed.has(cp.code) && score < cp.minL) || null;

  if (!next) {
    return {
      score,
      percent: 100,
      label: 'All checkpoints cleared',
      detail: "You finished this period's quest ladder.",
      nextCode: null as string | null,
      remaining: 0,
      target: score,
    };
  }

  const target = next.minL;
  const remaining = Math.max(0, target - score);
  const percent = target > 0 ? Math.min(100, Math.max(0, (score / target) * 100)) : 0;
  return {
    score,
    percent,
    label: `Checkpoint ${next.code}`,
    detail: `${formatScore(remaining)} pts to unlock`,
    nextCode: next.code,
    remaining,
    target,
  };
}

export function formatHoursFromSeconds(seconds: number | null | undefined): string {
  const s = Math.max(0, Number(seconds) || 0);
  return `${(s / 3600).toFixed(1)}h`;
}

export function dayBarSeconds(day: { dwell_seconds?: number; active_seconds?: number }): number {
  const dwell = Number(day?.dwell_seconds) || 0;
  const focus = Number(day?.active_seconds) || 0;
  return Math.max(dwell, focus);
}

export type DailyPoint = {
  date: string;
  active_seconds: number;
  dwell_seconds: number;
  fc_reviews: number;
  quiz_correct: number;
  L_delta: number;
  pages: Array<{
    content_id: string;
    page_type: string;
    content_title?: string | null;
    dwell_seconds: number;
  }>;
};

export function buildDailySeries(
  daily: Array<{
    date: string;
    active_seconds: number;
    dwell_seconds?: number;
    fc_reviews: number;
    quiz_correct: number;
    L_delta: number;
    pages?: DailyPoint['pages'];
  }> = [],
  days = 14
): DailyPoint[] {
  const byDate = new Map((daily || []).map((d) => [String(d.date).slice(0, 10), d]));
  const out: DailyPoint[] = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = byDate.get(key);
    out.push({
      date: key,
      active_seconds: row?.active_seconds ?? 0,
      dwell_seconds: row?.dwell_seconds ?? 0,
      fc_reviews: row?.fc_reviews ?? 0,
      quiz_correct: row?.quiz_correct ?? 0,
      L_delta: Number(row?.L_delta) || 0,
      pages: Array.isArray(row?.pages) ? row.pages : [],
    });
  }
  return out;
}

export function estimateRewardAmount(
  amountForCap: number | null | undefined,
  percent: number
): number | null {
  const base = Number(amountForCap);
  if (!Number.isFinite(base) || base <= 0) return null;
  return base * percent;
}
