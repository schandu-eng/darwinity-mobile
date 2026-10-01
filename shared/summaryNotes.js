import { flattenBlocksText } from './flattenBlockText.js';

export const MIN_NOTES_CHARS_FOR_GENERATION = 50;

/**
 * True when summary has notes in either legacy detailed_notes or BlockNote editor_blocks.
 */
export function hasSummaryNotes(summary) {
  return (
    (Array.isArray(summary?.detailed_notes) && summary.detailed_notes.length > 0) ||
    (Array.isArray(summary?.editor_blocks) && summary.editor_blocks.length > 0)
  );
}

/**
 * True when notes contain enough text for flashcard/podcast/quiz generation.
 */
export function hasMeaningfulSummaryNotes(summary, { minChars = MIN_NOTES_CHARS_FOR_GENERATION } = {}) {
  if (!summary || typeof summary !== 'object') {
    return false;
  }

  if (Array.isArray(summary.detailed_notes) && summary.detailed_notes.length > 0) {
    const text = summary.detailed_notes
      .map((note) => (note?.content || '').trim())
      .filter(Boolean)
      .join('\n');
    if (text.length >= minChars) {
      return true;
    }
  }

  if (Array.isArray(summary.editor_blocks) && summary.editor_blocks.length > 0) {
    const text = flattenBlocksText(summary.editor_blocks).trim();
    return text.length >= minChars;
  }

  return false;
}

/**
 * Whether generation tabs should treat notes as ready.
 */
export function resolveGenerationNotesReady({
  summary,
  hasNotesProp,
  chapterCount = 0,
} = {}) {
  if (summary != null) {
    return hasMeaningfulSummaryNotes(summary);
  }
  if (hasNotesProp != null) {
    return Boolean(hasNotesProp);
  }
  return chapterCount > 0;
}

/**
 * Whether chapter/topic selection is valid for starting generation.
 * Null selection means "all chapters" and requires at least one chapter.
 */
export function hasValidSectionSelection({
  chapterCount = 0,
  selectedChapterIds = null,
} = {}) {
  if (selectedChapterIds !== null && selectedChapterIds.length === 0) {
    return false;
  }
  if (selectedChapterIds === null) {
    return chapterCount > 0;
  }
  return selectedChapterIds.length > 0;
}

/**
 * Merge API content fields into a single summary object for read/export/generation checks.
 * The API returns editor_blocks at the top level; summary.detailed_notes comes from topics.
 */
export function buildContentNotesSummary(content) {
  if (!content || typeof content !== 'object') {
    return null;
  }

  let summary = null;
  if (content.summary && typeof content.summary === 'object') {
    summary = { ...content.summary };
  } else if (typeof content.summary === 'string') {
    try {
      const parsed = JSON.parse(content.summary);
      summary = parsed && typeof parsed === 'object' ? { ...parsed } : {};
    } catch {
      summary = {};
    }
  } else {
    summary = {};
  }

  if (Array.isArray(content.editor_blocks) && content.editor_blocks.length > 0) {
    summary.editor_blocks = content.editor_blocks;
  }

  const hasDetailedNotes =
    Array.isArray(summary.detailed_notes) && summary.detailed_notes.length > 0;
  if (!hasDetailedNotes && Array.isArray(content.topics) && content.topics.length > 0) {
    summary.detailed_notes = content.topics.map((topic) => ({
      topic: topic.title,
      content: topic.note || '',
    }));
  }

  return summary;
}

export function contentHasMeaningfulNotes(content, options) {
  return hasMeaningfulSummaryNotes(buildContentNotesSummary(content), options);
}
