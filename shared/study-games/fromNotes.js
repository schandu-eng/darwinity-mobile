import { flattenBlockText } from '../flattenBlockText.js';
import { expandGlossaryMarkersInBlocks } from '../glossaryMarkers.js';
import {
  buildGameItemsFromGroups,
  MAX_CHOICE_CHARS,
  MIN_GAME_ITEMS,
  normalizeSpace,
  shortenChoice,
  stripStudyMarkdown,
  trimClozePrompt,
} from './groups.js';

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'that', 'this',
  'these', 'those', 'with', 'from', 'into', 'onto', 'over', 'under', 'about',
  'above', 'below', 'between', 'through', 'during', 'before', 'after', 'for',
  'of', 'to', 'in', 'on', 'at', 'by', 'as', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'can', 'not', 'no', 'nor', 'so',
  'yet', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only',
  'own', 'same', 'too', 'very', 'just', 'also', 'it', 'its', 'they', 'them',
  'their', 'we', 'our', 'you', 'your', 'he', 'she', 'his', 'her', 'i', 'me',
  'my', 'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how', 'all',
]);

function collectBlocks(doc, out = []) {
  if (!Array.isArray(doc)) return out;
  for (const block of doc) {
    if (!block || typeof block !== 'object') continue;
    out.push(block);
    if (Array.isArray(block.children)) collectBlocks(block.children, out);
  }
  return out;
}

function boldSpansInBlock(block) {
  const found = [];
  const visit = (nodes) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      if (node.type === 'text') {
        const styles = node.styles || {};
        const bold = styles.bold || styles.strong;
        const text = normalizeSpace(node.text);
        if (bold && text && text.length >= 2 && text.length <= MAX_CHOICE_CHARS) {
          found.push(text);
        }
      } else if (Array.isArray(node.content)) {
        visit(node.content);
      }
    }
  };
  if (Array.isArray(block?.content)) visit(block.content);
  return found;
}

function isHeading(block) {
  return block?.type === 'heading';
}

function isListItem(block) {
  return block?.type === 'bulletListItem' || block?.type === 'numberedListItem';
}

function candidateFromPhrase(phrase) {
  const text = normalizeSpace(phrase);
  if (!text) return null;
  if (text.length < 2 || text.length > MAX_CHOICE_CHARS) return null;
  const words = text.split(/\s+/);
  if (words.length > 10) return null;
  const lower = text.toLowerCase();
  if (words.length === 1 && (STOP.has(lower) || /^\d+$/.test(text))) return null;
  return text;
}

function extractKeyPhrases(sentence) {
  const s = normalizeSpace(sentence);
  if (!s || s.length < 12) return [];
  const out = [];
  const capRe = /\b([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,4})\b/g;
  let m;
  while ((m = capRe.exec(s)) !== null) {
    const c = candidateFromPhrase(m[1]);
    if (c && c !== s) out.push(c);
  }
  const quoteRe = /["'“”‘’]([^"'“”‘’]{2,48})["'“”‘’]/g;
  while ((m = quoteRe.exec(s)) !== null) {
    const c = candidateFromPhrase(m[1]);
    if (c) out.push(c);
  }
  const parenRe = /\(([^)]{2,40})\)/g;
  while ((m = parenRe.exec(s)) !== null) {
    const c = candidateFromPhrase(m[1]);
    if (c && !c.includes('.')) out.push(c);
  }
  return out;
}

function splitSentences(text) {
  return normalizeSpace(text)
    .split(/(?<=[.!?])\s+/)
    .map(normalizeSpace)
    .filter((s) => s.length >= 12);
}

/** Turn mobile topic rows (markdown + optional note_blocks) into a study document. */
export function topicsToStudyDocument(topics) {
  const doc = [];
  (Array.isArray(topics) ? topics : []).forEach((topic) => {
    if (Array.isArray(topic?.note_blocks) && topic.note_blocks.length) {
      doc.push(...topic.note_blocks);
      return;
    }
    const title = stripStudyMarkdown(topic?.title);
    if (title) {
      doc.push({
        type: 'heading',
        content: [{ type: 'text', text: title }],
      });
    }
    const note = stripStudyMarkdown(topic?.note);
    note.split(/\n+/).forEach((para) => {
      const text = para.trim();
      if (!text) return;
      doc.push({
        type: 'paragraph',
        content: [{ type: 'text', text }],
      });
    });
  });
  return doc;
}

export function collectNoteGameGroupsFromDocument(doc) {
  if (!Array.isArray(doc) || doc.length === 0) return [];

  const blocks = collectBlocks(expandGlossaryMarkersInBlocks(doc));
  const raw = [];
  const seen = new Set();

  const push = (answer, plain) => {
    const ans = candidateFromPhrase(answer);
    if (!ans) return;
    const key = ans.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    raw.push({ answer: ans, plain: normalizeSpace(plain) || ans });
  };

  for (const block of blocks) {
    const plain = normalizeSpace(flattenBlockText(block));
    if (!plain) continue;

    for (const bold of boldSpansInBlock(block)) {
      push(bold, plain);
    }

    if (isHeading(block)) {
      continue;
    }

    if (isListItem(block) && plain.split(/\s+/).length <= 10) {
      push(plain, plain);
    }

    for (const sentence of splitSentences(plain)) {
      for (const phrase of extractKeyPhrases(sentence)) {
        push(phrase, sentence);
      }
    }
  }

  return raw.slice(0, 40).map((row, index) => {
    const ans = row.answer;
    const context = row.plain;
    if (context && ans.toLowerCase() !== context.toLowerCase()) {
      const escaped = ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      let next = context.replace(new RegExp(escaped, 'i'), '_____');
      if (next.includes('_____')) {
        const contextLeft = next.replace(/_+/g, '').trim();
        if (contextLeft.length >= 2) {
          return {
            id: `notes_${index}`,
            answer: ans,
            prompt: trimClozePrompt(normalizeSpace(next)),
          };
        }
      }
    }
    const recall = context && context !== ans
      ? `What term completes this idea: ${shortenChoice(context, 90)}`
      : `What is ${shortenChoice(ans, 40)}?`;
    return {
      id: `notes_${index}`,
      answer: ans,
      prompt: trimClozePrompt(recall),
    };
  });
}

export function collectNoteGameGroups(editorOrDoc) {
  const doc = Array.isArray(editorOrDoc)
    ? editorOrDoc
    : editorOrDoc?.document;
  return collectNoteGameGroupsFromDocument(doc);
}

export function buildGameItemsFromStudyNotes(editorOrDoc, { choiceCount = 3 } = {}) {
  const groups = collectNoteGameGroups(editorOrDoc);
  return buildGameItemsFromGroups(groups, { choiceCount });
}

export function notesGameReady(editorOrDoc) {
  return collectNoteGameGroups(editorOrDoc).length >= MIN_GAME_ITEMS;
}
