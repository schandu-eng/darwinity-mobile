/** Optimistic grade helpers — advance UI immediately; reconcile with review API. */

/** Match backend `LEARN_AHEAD_SECONDS` (20m) for local requeue guesses. */
const LEARN_AHEAD_SECONDS = 1200;

export function spliceOutAt<T>(queue: T[] | null | undefined, index: number): T[] {
  if (!Array.isArray(queue) || index < 0 || index >= queue.length) {
    return Array.isArray(queue) ? [...queue] : [];
  }
  return [...queue.slice(0, index), ...queue.slice(index + 1)];
}

type PreviewMap = Record<string | number, { label?: string } | undefined> | null | undefined;

/** Whether grade-previews suggest the card will return in this session. */
export function previewSuggestsRequeue(previews: PreviewMap, rating: number): boolean {
  const raw = previews?.[rating] ?? previews?.[String(rating)];
  const label = (raw?.label || '').trim();
  if (!label) return rating === 1;

  const match = /^(\d+)\s*([mhd])$/i.exec(label);
  if (!match) return rating === 1;

  const n = Number(match[1]);
  if (!Number.isFinite(n) || n < 0) return rating === 1;

  const unit = match[2].toLowerCase();
  const seconds = unit === 'm' ? n * 60 : unit === 'h' ? n * 3600 : n * 86400;
  return seconds <= LEARN_AHEAD_SECONDS;
}

export function upsertRequeueCard<T>(
  queue: T[] | null | undefined,
  requeued: T,
  sameCard: (a: T, b: T) => boolean
): T[] {
  const list = Array.isArray(queue) ? [...queue] : [];
  const idx = list.findIndex((c) => sameCard(c, requeued));
  if (idx < 0) return [...list, requeued];
  const next = [...list];
  next[idx] = { ...next[idx], ...requeued };
  return next;
}

export function applyOptimisticGrade<T>({
  queue,
  index,
  gradedCard,
  guessedRequeue,
  sameCard,
  buildOptimisticRequeue,
}: {
  queue: T[];
  index: number;
  gradedCard: T;
  guessedRequeue: boolean;
  sameCard: (a: T, b: T) => boolean;
  buildOptimisticRequeue: (card: T) => T;
}): T[] {
  let next = spliceOutAt(queue, index);
  if (guessedRequeue) {
    next = upsertRequeueCard(next, buildOptimisticRequeue(gradedCard), sameCard);
  }
  return next;
}

export function reconcileOptimisticGrade<T>({
  queue,
  gradedCard,
  result,
  guessedRequeue,
  sameCard,
  buildRequeued,
}: {
  queue: T[];
  gradedCard: T;
  result: { requeue_now?: boolean; card?: T | null } | null | undefined;
  guessedRequeue: boolean;
  sameCard: (a: T, b: T) => boolean;
  buildRequeued: (serverCard: T, gradedCard: T) => T;
}): { queue: T[]; doneDelta: number; serverRequeue: boolean } {
  let next = (queue || []).filter((c) => !sameCard(c, gradedCard));

  let doneDelta = 0;
  const serverRequeue = Boolean(result?.requeue_now && result?.card);

  if (serverRequeue && result?.card) {
    next = upsertRequeueCard(next, buildRequeued(result.card, gradedCard), sameCard);
    if (!guessedRequeue) doneDelta = -1;
  } else if (guessedRequeue) {
    doneDelta = 1;
  }

  return { queue: next, doneDelta, serverRequeue };
}
