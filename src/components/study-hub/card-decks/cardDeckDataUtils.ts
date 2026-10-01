import type { FlashcardV2 } from '@/api/schemas/cardDecksV2';
import type { Flashcard } from '@/api/schemas/studyHub';

export type DisplayFlashcard = {
  id?: number;
  front: string;
  back: string;
  hint?: string;
};

function isValidCard(card: unknown): card is DisplayFlashcard {
  if (!card || typeof card !== 'object') return false;
  const item = card as { front?: unknown; back?: unknown };
  return Boolean(String(item.front || '').trim() && String(item.back || '').trim());
}

export function parseLegacyFlashcardsResponse(raw: unknown): DisplayFlashcard[] | null {
  if (!raw) return null;
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null && Array.isArray((raw as { flashcards?: unknown[] }).flashcards)
      ? (raw as { flashcards: unknown[] }).flashcards
      : null;
  if (!list?.length) return null;
  const cards = list.filter(isValidCard).map((card) => ({
    id: card.id,
    front: String(card.front).trim(),
    back: String(card.back).trim(),
    hint: card.hint ? String(card.hint).trim() : undefined,
  }));
  return cards.length > 0 ? cards : null;
}

export function v2CardsToDisplay(cards: FlashcardV2[]): DisplayFlashcard[] {
  return cards
    .filter((card) => Boolean(card.front?.trim() && card.back?.trim()))
    .map((card) => ({
      id: card.id,
      front: card.front.trim(),
      back: card.back.trim(),
      hint: card.hint?.trim() || undefined,
    }));
}

export function resolveDisplayFlashcards(
  v2Cards: FlashcardV2[] | null | undefined,
  legacyRaw: unknown
): DisplayFlashcard[] | null {
  if (v2Cards?.length) return v2CardsToDisplay(v2Cards);
  return parseLegacyFlashcardsResponse(legacyRaw);
}

export function toLearningFlashcards(cards: DisplayFlashcard[]): Flashcard[] {
  return cards.map(({ front, back, hint }) => ({ front, back, hint }));
}
