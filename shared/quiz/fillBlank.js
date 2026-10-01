/**
 * Parse fill-in-the-blank stems and serialize multi-blank answers.
 * Blank markers: three or more underscores (____), matching generation prompts.
 */

const BLANK_RE = /_{3,}/g
const MULTI_JOIN = ' | '

export function countFillBlanks(questionText) {
  const text = String(questionText || '')
  const matches = text.match(BLANK_RE)
  return matches ? matches.length : 0
}

/**
 * @returns {{ parts: Array<{ type: 'text', text: string } | { type: 'blank', index: number }>, blankCount: number }}
 */
export function parseFillBlankParts(questionText) {
  const text = String(questionText || '')
  const parts = []
  let last = 0
  let blankIndex = 0
  BLANK_RE.lastIndex = 0
  let match
  while ((match = BLANK_RE.exec(text))) {
    if (match.index > last) {
      parts.push({ type: 'text', text: text.slice(last, match.index) })
    }
    parts.push({ type: 'blank', index: blankIndex })
    blankIndex += 1
    last = match.index + match[0].length
  }
  if (last < text.length) {
    parts.push({ type: 'text', text: text.slice(last) })
  }
  if (blankIndex === 0) {
    return {
      parts: [
        ...(text.trim() ? [{ type: 'text', text }] : []),
        { type: 'blank', index: 0 },
      ],
      blankCount: 1,
      implicitBlank: true,
    }
  }
  return { parts, blankCount: blankIndex, implicitBlank: false }
}

export function splitBlankAnswers(serialized, blankCount) {
  const n = Math.max(1, blankCount || 1)
  const raw = String(serialized ?? '')
  if (n === 1) return [raw]
  if (!raw) return Array.from({ length: n }, () => '')
  if (raw.includes(MULTI_JOIN)) {
    const bits = raw.split(MULTI_JOIN)
    return Array.from({ length: n }, (_, i) => bits[i] ?? '')
  }
  if (raw.includes('|') && !raw.includes(MULTI_JOIN)) {
    const bits = raw.split('|').map((s) => s.trim())
    if (bits.length === n) return bits
  }
  // Past answers submitted as a single string: put whole value in first blank.
  return Array.from({ length: n }, (_, i) => (i === 0 ? raw : ''))
}

export function joinBlankAnswers(values) {
  const list = Array.isArray(values) ? values.map((v) => String(v ?? '')) : []
  if (list.length <= 1) return list[0] || ''
  return list.join(MULTI_JOIN)
}

export function blanksAllFilled(serialized, blankCount) {
  return splitBlankAnswers(serialized, blankCount).every((v) => v.trim().length > 0)
}

/**
 * Per-blank expected answers. Pipe-separated correct_answer maps 1:1;
 * otherwise the full phrase is shown beside the first blank only.
 */
export function splitCorrectAnswers(correctAnswer, blankCount) {
  const n = Math.max(1, blankCount || 1)
  const raw = String(correctAnswer ?? '').trim()
  if (!raw) return Array.from({ length: n }, () => '')
  if (n === 1) return [raw]
  if (raw.includes('|')) {
    const bits = raw.split('|').map((s) => s.trim())
    return Array.from({ length: n }, (_, i) => bits[i] || '')
  }
  return Array.from({ length: n }, (_, i) => (i === 0 ? raw : ''))
}
