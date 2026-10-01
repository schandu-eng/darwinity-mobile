import { stripGlossaryMarkers } from '@shared/glossaryMarkers.js';
import { unwrapQuizChoice } from '@shared/quiz/quizGrade.js';

const MAX_MENTION_CHARS = 2500;
const MAX_CONTEXT_CHARS = 8000;

export type ChatMentionKind = 'note' | 'topic';

export type ChatMentionCandidate = {
  id: string;
  kind: ChatMentionKind;
  title: string;
  subtitle: string;
  body: string | null;
};

export type AtTriggerState = {
  query: string;
  from: number;
  to: number;
};

export function buildFlashcardChatContext(card: {
  front?: string | null;
  back?: string | null;
} | null | undefined): string | null {
  if (!card) return null;
  const front = String(card.front || '').trim();
  const back = String(card.back || '').trim();
  if (!front && !back) return null;
  const lines = ['Flashcard'];
  if (front) lines.push(`Front: ${front}`);
  if (back) lines.push(`Back: ${back}`);
  return lines.join('\n');
}

export function buildQuizChatContext(
  question: {
    question?: string | null;
    options?: unknown[] | null;
    correct_answer?: string | null;
  } | null | undefined,
  userAnswer = ''
): string | null {
  if (!question) return null;
  const prompt = String(question.question || '').trim();
  if (!prompt) return null;
  const lines = ['Quiz question', `Question: ${prompt}`];
  const options = Array.isArray(question.options)
    ? question.options.map(unwrapQuizChoice).filter(Boolean)
    : [];
  if (options.length) {
    lines.push(`Options: ${options.join(' | ')}`);
  }
  const answer = unwrapQuizChoice(userAnswer).trim();
  if (answer) lines.push(`My answer: ${answer}`);
  const correct = unwrapQuizChoice(question.correct_answer).trim();
  if (correct) lines.push(`Correct answer: ${correct}`);
  return lines.join('\n');
}

/** Strip markdown noise for mention previews / context bodies. */
export function plainNoteText(markdown: string, maxLen = MAX_MENTION_CHARS): string {
  if (!markdown || typeof markdown !== 'string') return '';
  const plain = stripGlossaryMarkers(markdown)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~`>#|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return '';
  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen).trim()}…`;
}

/**
 * @-mention candidates for the open note (phase 1: current content only).
 * Detection must run from the text value, not keypress — Android IMEs skip onKeyPress.
 */
export function buildTopicMentionCandidates({
  topics = [],
  contentTitle = '',
  contentId = null,
}: {
  topics?: Array<{ id?: number | string | null; title?: string | null; order?: number | null; note?: string | null }> | null;
  contentTitle?: string | null;
  contentId?: number | string | null;
} = {}): ChatMentionCandidate[] {
  const items: ChatMentionCandidate[] = [];
  const noteTitle = String(contentTitle || '').trim() || 'This note';
  items.push({
    id: `note:${contentId ?? 'current'}`,
    kind: 'note',
    title: noteTitle,
    subtitle: 'Entire note',
    body: null,
  });

  const ordered = Array.isArray(topics)
    ? [...topics].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
    : [];

  for (const topic of ordered) {
    if (!topic || topic.id == null) continue;
    const title = String(topic.title || '').trim() || 'Untitled section';
    const body = plainNoteText(topic.note || '', MAX_MENTION_CHARS);
    items.push({
      id: `topic:${topic.id}`,
      kind: 'topic',
      title,
      subtitle: 'Section',
      body: body || null,
    });
  }

  return items;
}

/** Flatten selection + @ mentions into the existing `/api/v1/assistant/ask` context string. */
export function serializeChatContext({
  selection = null,
  mentions = [],
}: {
  selection?: string | null;
  mentions?: Array<Pick<ChatMentionCandidate, 'kind' | 'title' | 'body'> | null | undefined>;
} = {}): string | null {
  const parts: string[] = [];
  const list = Array.isArray(mentions) ? mentions : [];

  for (const mention of list) {
    if (!mention) continue;
    const title = String(mention.title || '').trim();
    if (mention.kind === 'note') {
      parts.push(`Referenced note: ${title || 'This note'}`);
      continue;
    }
    const body = String(mention.body || '').trim();
    if (title && body) {
      parts.push(`Referenced section "${title}":\n${body}`);
    } else if (title) {
      parts.push(`Referenced section: ${title}`);
    }
  }

  const selected = typeof selection === 'string' ? selection.trim() : '';
  if (selected) {
    parts.push(`Selected text:\n${selected}`);
  }

  const joined = parts.join('\n\n').trim();
  if (!joined) return null;
  if (joined.length <= MAX_CONTEXT_CHARS) return joined;
  return `${joined.slice(0, MAX_CONTEXT_CHARS).trim()}…`;
}

export function filterMentionCandidates(
  candidates: ChatMentionCandidate[] | null | undefined,
  query = ''
): ChatMentionCandidate[] {
  const q = String(query || '').trim().toLowerCase();
  const list = Array.isArray(candidates) ? candidates : [];
  if (!q) return list;
  return list.filter((item) => {
    const title = String(item?.title || '').toLowerCase();
    const subtitle = String(item?.subtitle || '').toLowerCase();
    return title.includes(q) || subtitle.includes(q);
  });
}

/**
 * Match `@query` immediately before the cursor.
 * Call this from onChangeText + onSelectionChange — never from onKeyPress (Android).
 */
export function getAtTriggerState(text: string, cursor: number): AtTriggerState | null {
  const from = Math.max(0, Math.min(Number(cursor) || 0, text.length));
  const textBefore = text.slice(Math.max(0, from - 80), from);
  const match = textBefore.match(/(^|[\s([{])@([^\s@]*)$/);
  if (!match) return null;
  const query = match[2] || '';
  return { query, from: from - query.length - 1, to: from };
}

/** Estimate caret after a controlled onChangeText (Android selection lags the text). */
export function estimateCursorAfterChange(
  prevText: string,
  nextText: string,
  prevSelection: { start: number; end: number }
): number {
  const start = Math.max(0, prevSelection.start);
  const end = Math.max(start, prevSelection.end);
  const replaced = Math.max(0, end - start);
  const inserted = nextText.length - (prevText.length - replaced);
  return Math.max(0, Math.min(nextText.length, start + inserted));
}
