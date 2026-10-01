

export const JOB_POLL_BASE_MS = 2000;
export const JOB_POLL_MAX_MS = 8000;

export function nextPollDelayMs(
  unchangedStreak: number,
  { baseMs = JOB_POLL_BASE_MS, maxMs = JOB_POLL_MAX_MS } = {}
): number {
  const streak = Math.max(0, Number(unchangedStreak) || 0);
  const exponent = Math.min(2, Math.floor(streak / 2));
  return Math.min(maxMs, baseMs * 2 ** exponent);
}

export type AdaptivePollResult = {
  done?: boolean;
  progressed?: boolean;
};

export function startAdaptivePoller(
  poll: (ctx: { unchangedStreak: number }) => Promise<AdaptivePollResult | void>,
  { baseMs = JOB_POLL_BASE_MS, maxMs = JOB_POLL_MAX_MS } = {}
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  let unchangedStreak = 0;
  let inFlight = false;

  const clear = () => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = (delayMs: number) => {
    clear();
    if (cancelled) return;
    timer = setTimeout(run, delayMs);
  };

  const run = async () => {
    if (cancelled || inFlight) return;
    inFlight = true;
    try {
      const result = await poll({ unchangedStreak });
      if (cancelled || result?.done) return;
      if (result?.progressed) unchangedStreak = 0;
      else unchangedStreak += 1;
      schedule(nextPollDelayMs(unchangedStreak, { baseMs, maxMs }));
    } catch {
      if (cancelled) return;
      unchangedStreak += 1;
      schedule(nextPollDelayMs(unchangedStreak, { baseMs, maxMs }));
    } finally {
      inFlight = false;
    }
  };

  schedule(0);

  return () => {
    cancelled = true;
    clear();
  };
}

export function jobStatusRefetchIntervalMs(
  query: { state: { data?: { data?: { status?: string; progress?: number } } }; __pollKey?: string; __pollStreak?: number },
  baseMs: number = JOB_POLL_BASE_MS
): number | false {
  const data = query.state.data?.data;
  const status = data?.status;
  if (
    status === 'completed' ||
    status === 'failed' ||
    status === 'blocked' ||
    status === 'upgrade_required'
  ) {
    return false;
  }
  const key = `${status ?? ''}:${data?.progress ?? 0}`;
  if (key === query.__pollKey) {
    query.__pollStreak = (query.__pollStreak ?? 0) + 1;
  } else {
    query.__pollKey = key;
    query.__pollStreak = 0;
  }
  return nextPollDelayMs(query.__pollStreak ?? 0, { baseMs });
}
