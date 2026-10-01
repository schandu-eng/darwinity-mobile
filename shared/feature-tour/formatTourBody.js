/** Split tour body copy so platforms can emphasize "spaced repetition". */

const EMPHASIS_PHRASE = 'spaced repetition';

/**
 * @param {unknown} body
 * @returns {null | Array<{ text: string, emphasize: boolean }>}
 *   `null` means render `body` as-is (non-string or no matches).
 */
export function splitTourBodyForEmphasis(body) {
  if (typeof body !== 'string') return null;

  const parts = body.split(/(spaced repetition)/gi);
  if (parts.length === 1) return null;

  return parts.map((text) => ({
    text,
    emphasize: text.toLowerCase() === EMPHASIS_PHRASE,
  }));
}
