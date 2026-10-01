/** Shared generation-meter math for web + mobile. Always non-decreasing on the client. */

export const QUIZ_PROGRESS_STALL_MS = 20_000;
export const DISPLAY_PROGRESS_TICK_MS = 180;

/** Map backend quiz job progress (25–83) into a smoother display range. */
export function mapQuizServerProgress(serverProgress) {
  const server = Number(serverProgress) || 0;
  if (server >= 85) return server;
  if (server >= 25) return 50 + ((server - 25) / 58) * 44;
  return server;
}

/** Display cap while a quiz generation job is in-flight. */
export function quizGenerationProgressCap(serverProgress) {
  const server = Number(serverProgress) || 0;
  if (server >= 85) return 99;
  if (server >= 25) return 94;
  return 68;
}

/**
 * Map coarse job milestones (podcast / flashcards / flowchart often jump
 * 0 → 10 → 30 → 80) into stage-safe floors. Thresholds are 22 / 48 / 78,
 * so 80 must not land in "Almost" the moment the worker reports it.
 */
export function mapJobServerProgress(serverProgress) {
  const server = Number(serverProgress) || 0;
  if (server >= 100) return 100;
  if (server >= 95) return 90;
  if (server >= 85) return 82;
  if (server >= 70) return 62;
  if (server >= 50) return 50;
  if (server >= 30) return 28;
  if (server >= 10) return 12;
  return server;
}

/**
 * Ease displayed % toward a target so UI never snaps (e.g. 0 → 80).
 * ~0.9% per 180ms tick ≈ 5%/s — always non-decreasing.
 */
export function easeDisplayProgress(prev, target, { maxStep = 0.9 } = {}) {
  const safePrev = Math.min(100, Math.max(0, Number(prev) || 0));
  const safeTarget = Math.min(100, Math.max(0, Number(target) || 0));
  if (safeTarget <= safePrev) return safePrev;
  const step = Math.max(0.15, Number(maxStep) || 0.9);
  return Math.min(safeTarget, safePrev + step);
}

/** Larger server jumps ease more slowly so 0→80 never looks like a snap. */
export function easeStepForGap(gap) {
  const size = Math.max(0, Number(gap) || 0);
  if (size > 15) return 0.45;
  if (size > 8) return 0.65;
  return 0.9;
}

/**
 * Generic job progress (flashcards / podcast / flowchart):
 * server is a stage-safe floor; the bar creeps through the current band
 * instead of racing to ~80% and sitting there.
 */
export function computeJobDisplayProgress(serverProgress, elapsedSinceServerUpdateMs) {
  const server = Number(serverProgress) || 0;
  const elapsed = Math.max(0, Number(elapsedSinceServerUpdateMs) || 0);
  if (server >= 100) return { progress: 100, indeterminate: false };

  const mapped = mapJobServerProgress(server);
  let cap;
  let timeConstant;
  if (server >= 90) {
    cap = 99;
    timeConstant = 10_000;
  } else if (server >= 70) {
    cap = 94;
    timeConstant = 22_000;
  } else if (server >= 30) {
    cap = 72;
    timeConstant = 36_000;
  } else {
    cap = 44;
    timeConstant = 16_000;
  }

  const floor = Math.max(4, mapped);
  const span = Math.max(0, cap - floor);
  const creep = (1 - Math.exp(-elapsed / timeConstant)) * span;
  return {
    progress: Math.min(cap, floor + creep),
    indeterminate: false,
  };
}

/**
 * Server-driven quiz progress with a small creep ahead of the last heartbeat.
 * Avoids racing to ~78% on a timer while the worker is still on its first LLM call.
 */
export function computeQuizDisplayProgress(serverProgress, elapsedSinceServerUpdateMs) {
  const server = Number(serverProgress) || 0;
  const mapped = mapQuizServerProgress(server);
  const cap = quizGenerationProgressCap(server);
  const elapsed = Math.max(0, Number(elapsedSinceServerUpdateMs) || 0);

  let maxAhead;
  let timeConstant;
  if (server >= 85) {
    maxAhead = 5;
    timeConstant = 8_000;
  } else if (server >= 25) {
    maxAhead = 4;
    timeConstant = 12_000;
  } else {
    maxAhead = 8;
    timeConstant = 10_000;
  }

  const creepAhead = Math.min(maxAhead, (1 - Math.exp(-elapsed / timeConstant)) * maxAhead);
  const stalled = server >= 25 && server < 85 && elapsed >= QUIZ_PROGRESS_STALL_MS;

  return {
    progress: Math.min(cap, Math.max(4, mapped + creepAhead)),
    indeterminate: stalled,
  };
}

/**
 * Honor real server percent (notes / upload) with a tiny creep so the bar
 * never freezes between heartbeats. Does not remap coarse 80 → Building.
 */
export function computeStrictDisplayProgress(serverProgress, elapsedSinceServerUpdateMs) {
  const server = Number(serverProgress) || 0;
  const elapsed = Math.max(0, Number(elapsedSinceServerUpdateMs) || 0);
  if (server >= 100) return { progress: 100, indeterminate: false };

  const floor = Math.max(server > 0 ? server : 4, server);
  const cap = server >= 95 ? 99 : Math.min(94, Math.max(floor + 6, 8));
  const span = Math.max(0, cap - Math.max(4, floor));
  const creep = (1 - Math.exp(-elapsed / 12_000)) * span;
  return {
    progress: Math.min(cap, Math.max(4, floor + creep)),
    indeterminate: false,
  };
}

/** Time-only curve when the worker reports no usable percent (exam prep). */
export function computeEstimatedDisplayProgress(elapsedMs, expectedMs = 90_000) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const expected = Math.max(20_000, Number(expectedMs) || 90_000);
  const timed = 4 + (1 - Math.exp(-elapsed / (expected * 0.55))) * 90;
  return {
    progress: Math.min(94, timed),
    indeterminate: false,
  };
}

export function computeKindDisplayProgress(
  kind,
  serverProgress,
  elapsedSinceServerUpdateMs,
  { expectedMs, elapsedSinceStartMs } = {}
) {
  if (kind === 'quiz') {
    return computeQuizDisplayProgress(serverProgress, elapsedSinceServerUpdateMs);
  }
  if (kind === 'strict') {
    return computeStrictDisplayProgress(serverProgress, elapsedSinceServerUpdateMs);
  }
  if (kind === 'estimated') {
    return computeEstimatedDisplayProgress(elapsedSinceStartMs ?? elapsedSinceServerUpdateMs, expectedMs);
  }
  return computeJobDisplayProgress(serverProgress, elapsedSinceServerUpdateMs);
}

export function initialDisplayProgress(serverProgress, kind = 'job') {
  const live = Number(serverProgress) || 0;
  if (live >= 100) return 100;
  if (kind === 'quiz') return Math.max(4, mapQuizServerProgress(live) || 4);
  if (kind === 'strict') return Math.max(4, live);
  if (kind === 'estimated') return 4;
  return Math.max(4, mapJobServerProgress(live));
}

/** Shared thresholds for 4-step generation meters (notes/quiz/podcast/etc). */
export function stageIndexForProgress(progress, thresholds = [22, 48, 78]) {
  const p = Math.min(100, Math.max(0, Number(progress) || 0));
  for (let i = 0; i < thresholds.length; i += 1) {
    if (p < thresholds[i]) return i;
  }
  return thresholds.length;
}

export function stagesFromProgress(stageDefs, progress, thresholds) {
  const activeStage = stageIndexForProgress(progress, thresholds);
  return (stageDefs || []).map((stage, i) => ({
    label:
      typeof stage === 'string'
        ? stage
        : stage.shortLabel || stage.label?.split?.(' ')?.[0] || stage.label,
    status: i < activeStage ? 'done' : i === activeStage ? 'active' : 'pending',
  }));
}

/**
 * Continuous trail parameter in [0, stageCount-1] so Darwin walks with %
 * instead of sitting on the first node until a coarse stage flips.
 */
export function trailParamForProgress(progress, stageCount, thresholds = [22, 48, 78]) {
  const n = Math.max(1, Number(stageCount) || 1);
  if (n <= 1) return 0;
  const p = Math.min(100, Math.max(0, Number(progress) || 0));
  const bounds = [0];
  const cuts = Array.isArray(thresholds) ? thresholds : [];
  for (let i = 0; i < n - 1; i += 1) {
    const cut = Number(cuts[i]);
    bounds.push(Number.isFinite(cut) ? cut : 100);
  }
  bounds.push(100);
  for (let i = 1; i < bounds.length; i += 1) {
    if (bounds[i] < bounds[i - 1]) bounds[i] = bounds[i - 1];
  }
  for (let i = 0; i < n - 1; i += 1) {
    if (p <= bounds[i + 1] || i === n - 2) {
      const lo = bounds[i];
      const hi = bounds[i + 1];
      const frac = hi <= lo ? (p >= hi ? 1 : 0) : (p - lo) / (hi - lo);
      return Math.min(n - 1, i + Math.min(1, Math.max(0, frac)));
    }
  }
  return n - 1;
}
