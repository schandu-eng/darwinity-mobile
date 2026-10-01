import {
  suggestUntitledDeckTitle as suggestUntitledDeckTitleJs,
  validateDeckTitle as validateDeckTitleJs,
} from '@shared/cardDeckUtils.js';

export type TopicItem = { id: number; title: string; order?: number };

export {
  MAX_CARD_DECK_DECKS_PER_CONTENT,
  DECK_SET_STYLE,
  DECK_SET_ICON_COUNT,
  getDeckIconIndex,
  normalizeDeckTitle,
  isDeckTitleTaken,
  filterFlashcards,
  flashcardKey,
  getTopicFilterableTopics,
  buildCardDeckFilterLabel,
} from '@shared/cardDeckUtils.js';

type DeckTitleSet = { deck_id?: number; title?: string | null };

export function validateDeckTitle(
  title: string,
  existingSets: DeckTitleSet[],
  excludeDeckId: number | null = null
): string | null {
  return (
    validateDeckTitleJs as (
      nextTitle: string,
      sets: DeckTitleSet[],
      excludeId?: number | null
    ) => string | null
  )(title, existingSets, excludeDeckId);
}

export function suggestUntitledDeckTitle(
  existingSets: DeckTitleSet[],
  base = 'Untitled set'
): string {
  return suggestUntitledDeckTitleJs(existingSets, base);
}
