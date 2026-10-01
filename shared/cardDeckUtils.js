export const MAX_CARD_DECK_DECKS_PER_CONTENT = 5;

/** Shared chrome for deck set cards — differentiate decks with animal icons, not colors. Amber reserved for starred. */
export const DECK_SET_STYLE = {
  badge:
    'bg-zinc-100 text-zinc-700 ring-zinc-200/80 dark:bg-white/[0.06] dark:text-zinc-200 dark:ring-white/[0.1]',
  card: 'border-zinc-200/80 hover:border-zinc-300 dark:border-white/[0.08] dark:hover:border-white/[0.14]',
};

/** Default icon-slot count; keep in sync with DECK_SET_ANIMAL_ICONS in CardDeckAnimalIcons. */
export const DECK_SET_ICON_COUNT = 6;

/** Deterministic icon slot so each set is visually distinct without color accents. */
export function getDeckIconIndex(deckId, iconCount = DECK_SET_ICON_COUNT) {
  const count = Math.max(1, Number(iconCount) || DECK_SET_ICON_COUNT);
  const id = Math.abs(Number(deckId) || 0);
  return id % count;
}

export function normalizeDeckTitle(title) {
  return (title || '').trim().toLowerCase();
}

export function isDeckTitleTaken(existingSets, title, excludeDeckId = null) {
  const normalized = normalizeDeckTitle(title);
  if (!normalized) return false;
  return (existingSets || []).some(
    (set) =>
      set.deck_id !== excludeDeckId && normalizeDeckTitle(set.title) === normalized
  );
}

export function validateDeckTitle(title, existingSets, excludeDeckId = null) {
  const cleaned = (title || '').trim();
  if (!cleaned) {
    return 'Give your set a name before continuing.';
  }
  if (isDeckTitleTaken(existingSets, cleaned, excludeDeckId)) {
    return `A set named "${cleaned}" already exists. Choose a different name.`;
  }
  return null;
}

/** Unique fallback when Scratch/Import start without a typed name. */
export function suggestUntitledDeckTitle(existingSets, base = 'Untitled set') {
  const root = (base || 'Untitled set').trim() || 'Untitled set';
  if (!isDeckTitleTaken(existingSets, root)) return root;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${root} ${n}`;
    if (!isDeckTitleTaken(existingSets, candidate)) return candidate;
  }
  return `${root} ${Date.now()}`;
}

export function filterFlashcards(cards, { topicIds = [], starredOnly = false } = {}) {
  let list = cards || [];
  if (starredOnly) {
    list = list.filter((c) => c.is_starred);
  }
  if (topicIds.length > 0) {
    list = list.filter((c) => c.topic_id && topicIds.includes(c.topic_id));
  }
  return list;
}

export function flashcardKey(card, index) {
  return card?.id ?? `i:${index}`;
}

export function getTopicFilterableTopics(topics, flashcards) {
  if (!topics?.length || !flashcards?.length) return [];
  const taggedIds = new Set(
    flashcards.map((c) => c.topic_id).filter((id) => id != null)
  );
  if (taggedIds.size === 0) return [];
  return topics.filter((t) => taggedIds.has(t.id));
}

export function buildCardDeckFilterLabel({ starredOnly, topicIds, topics }) {
  if (starredOnly) return 'Starred cards only';
  if (topicIds?.length > 0) {
    const names = topics.filter((t) => topicIds.includes(t.id)).map((t) => t.title);
    if (names.length === 0) return 'Selected topics';
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
  }
  return null;
}
