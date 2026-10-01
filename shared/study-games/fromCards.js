import {
  buildGameItemsFromGroups,
  normalizeSpace,
  trimClozePrompt,
} from './groups.js';

/**
 * Flashcard → game group from already-plain front/back (and optional cloze answers).
 * Platforms convert rich card HTML before calling this.
 */
export function toFlashcardGameItemFromPlain(card) {
  if (!card || typeof card !== 'object') return null;
  const id = card.id != null ? String(card.id) : null;
  if (!id) return null;

  const front = normalizeSpace(card.front);
  const back = normalizeSpace(card.back);
  const answers = (Array.isArray(card.clozeAnswers) ? card.clozeAnswers : [])
    .map((ans) => normalizeSpace(ans))
    .filter(Boolean);

  if (answers.length) {
    const answer = normalizeSpace(answers.join(' · ') || back);
    if (!answer) return null;
    let prompt = front;
    if (answers.length === 1) {
      const escaped = answers[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const blanked = prompt.replace(new RegExp(escaped, 'i'), '_____');
      if (blanked.includes('_____')) prompt = blanked;
    } else {
      answers.forEach((ans) => {
        const escaped = ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        prompt = prompt.replace(new RegExp(escaped, 'i'), '_____');
      });
    }
    if (!prompt.includes('_____')) {
      prompt = prompt || 'Fill in the blank';
    }
    return { id, answer, prompt: trimClozePrompt(normalizeSpace(prompt)) };
  }

  if (!back) return null;
  return {
    id,
    answer: back,
    prompt: front || 'What is on the back of this card?',
  };
}

export function buildGameItemsFromPlainFlashcards(cards, { choiceCount = 3 } = {}) {
  const groups = (Array.isArray(cards) ? cards : [])
    .map(toFlashcardGameItemFromPlain)
    .filter(Boolean);
  return buildGameItemsFromGroups(groups, { choiceCount });
}
