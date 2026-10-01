import type { FlashcardV2 } from '@/api/schemas/cardDecksV2';

function formatCardDeckReviewEta(dueAtIso: string, now = new Date()) {
  const due = new Date(dueAtIso);
  if (Number.isNaN(due.getTime())) {
    return { label: '-', title: '' };
  }

  const full = due.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  const ms = due.getTime() - now.getTime();
  if (ms <= 0) {
    return { label: 'Due now', title: `Review due ${full}` };
  }

  const minutes = Math.ceil(ms / 60000);
  if (minutes < 60) {
    return { label: `${minutes}m`, title: `Review in ${minutes} min · ${full}` };
  }

  const hours = Math.ceil(ms / 3600000);
  if (hours < 24) {
    return { label: `${hours}h`, title: `Review in ${hours} hr · ${full}` };
  }

  const days = Math.ceil(ms / 86400000);
  return { label: `${days}d`, title: `Review in ${days} day${days === 1 ? '' : 's'} · ${full}` };
}

export type ListStatus = {
  label: string;
  title: string;
  tone: 'due' | 'short' | 'long';
};

export function isNewStudyCard(card: FlashcardV2 | null | undefined): boolean {
  if (!card || card._inSessionRequeue) return false;
  if (card.queue_status) return card.queue_status === 'new';
  return (card.repetitions ?? 0) === 0 && !card.due_at;
}

export function isDueRevisionCard(card: FlashcardV2 | null | undefined, now = new Date()): boolean {
  if (!card || isNewStudyCard(card)) return false;
  if (card._inSessionRequeue) return true;
  if (!card.due_at) return false;
  return new Date(card.due_at) <= now;
}

export function isStudiedQueueCard(card: FlashcardV2 | null | undefined): boolean {
  if (!card) return false;
  if (card._inSessionRequeue) return true;
  return !isNewStudyCard(card);
}

export function partitionDeckHomeCards(flashcards: FlashcardV2[], now = new Date()) {
  const due: Array<{ card: FlashcardV2; index: number }> = [];
  const fresh: Array<{ card: FlashcardV2; index: number }> = [];
  for (let index = 0; index < (flashcards || []).length; index += 1) {
    const card = flashcards[index];
    if (isNewStudyCard(card)) {
      fresh.push({ card, index });
    } else if (isStudiedQueueCard(card)) {
      due.push({ card, index });
    }
  }
  due.sort((a, b) => {
    const aMs = a.card.due_at ? new Date(a.card.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bMs = b.card.due_at ? new Date(b.card.due_at).getTime() : Number.MAX_SAFE_INTEGER;
    if (aMs !== bMs) return aMs - bMs;
    return a.index - b.index;
  });
  return { dueCards: due, newCards: fresh };
}

export function ratingHintsFromPreviews(
  previews: Record<number | string, { label?: string }> | null | undefined
): Record<number, string> {
  if (!previews) {
    return { 1: '', 2: '', 3: '', 4: '' };
  }
  return {
    1: previews[1]?.label || previews['1']?.label || '',
    2: previews[2]?.label || previews['2']?.label || '',
    3: previews[3]?.label || previews['3']?.label || '',
    4: previews[4]?.label || previews['4']?.label || '',
  };
}

export function getAnkiRatingHints(_card: FlashcardV2 | null | undefined): Record<number, string> {
  return ratingHintsFromPreviews(null);
}

export function getFlashcardListStatus(
  card: FlashcardV2 | null | undefined,
  now = new Date()
): ListStatus | null {
  if (isNewStudyCard(card)) {
    return null;
  }

  if (!card?.due_at) {
    return null;
  }

  const eta = formatCardDeckReviewEta(card.due_at, now);
  if (!eta.label) {
    return null;
  }

  const isDue = new Date(card.due_at) <= now;
  const isShort = eta.label.endsWith('m') || eta.label.endsWith('h');

  return {
    label: eta.label,
    title: eta.title,
    tone: isDue ? 'due' : isShort ? 'short' : 'long',
  };
}

export function countSessionQueueTypes(cards: FlashcardV2[], now = new Date()) {
  const list = cards || [];
  let revise = 0;
  let newCount = 0;
  for (const c of list) {
    if (isDueRevisionCard(c, now)) revise += 1;
    else if (isNewStudyCard(c)) newCount += 1;
  }
  return { new: newCount, revise };
}
