import {
  buildGameItemsFromGroups,
  normalizeSpace,
  trimClozePrompt,
} from './groups.js';

const EMPTY_GAP_RE = /[\s\u200B\u200C\u200D\uFEFF]/g;

function inlineText(nodes) {
  if (!Array.isArray(nodes)) return '';
  let text = '';
  nodes.forEach((node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'text') text += String(node.text || '');
    else if (Array.isArray(node.content)) text += inlineText(node.content);
  });
  return text.replace(/\s+/g, ' ').trim();
}

function markValue(raw) {
  if (raw == null || raw === false || raw === '') return null;
  return String(raw);
}

/** Walk a BlockNote/TipTap document; group revision marks by blank id. */
export function collectHighlightGroupsFromDocument(doc) {
  if (!Array.isArray(doc)) return [];

  const byId = new Map();
  let legacyRun = null;
  let legacyIdx = 0;
  const legacyItems = [];

  const flushLegacy = () => {
    if (!legacyRun) return;
    const answer = normalizeSpace(legacyRun.parts.join(''));
    const plain = normalizeSpace(legacyRun.plains.join(' '));
    if (answer) {
      legacyItems.push({
        id: `legacy_${legacyIdx}`,
        answer,
        plain,
      });
      legacyIdx += 1;
    }
    legacyRun = null;
  };

  const addMarked = (id, text, plain) => {
    const chunk = String(text || '');
    if (!chunk.replace(EMPTY_GAP_RE, '')) return;
    if (!byId.has(id)) {
      byId.set(id, { id, parts: [], plains: [] });
    }
    const row = byId.get(id);
    row.parts.push(chunk);
    if (plain && !row.plains.includes(plain)) row.plains.push(plain);
  };

  const visitInline = (nodes, blockPlain) => {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      if (node.type === 'text') {
        const raw = markValue(node.styles?.revisionMark);
        const text = String(node.text || '');
        const visible = text.replace(EMPTY_GAP_RE, '');
        if (raw && visible) {
          if (raw.startsWith('b_')) {
            flushLegacy();
            addMarked(raw, text, blockPlain);
          } else if (!legacyRun) {
            legacyRun = { parts: [text], plains: blockPlain ? [blockPlain] : [] };
          } else {
            legacyRun.parts.push(text);
            if (blockPlain && !legacyRun.plains.includes(blockPlain)) {
              legacyRun.plains.push(blockPlain);
            }
          }
        } else if (visible) {
          flushLegacy();
        }
      } else {
        if (node.type !== 'link') flushLegacy();
        if (Array.isArray(node.content)) visitInline(node.content, blockPlain);
      }
    }
  };

  const visitBlocks = (blocks) => {
    if (!Array.isArray(blocks)) return;
    for (const block of blocks) {
      flushLegacy();
      if (!block || typeof block !== 'object') continue;
      if (Array.isArray(block.content)) {
        const plain = inlineText(block.content);
        if (plain) visitInline(block.content, plain);
      } else if (
        block.content
        && typeof block.content === 'object'
        && Array.isArray(block.content.rows)
      ) {
        block.content.rows.forEach((row) => {
          (row?.cells || []).forEach((cell) => {
            flushLegacy();
            const plain = inlineText(cell);
            if (plain) visitInline(cell, plain);
          });
        });
      }
      if (Array.isArray(block.children)) visitBlocks(block.children);
    }
  };

  visitBlocks(doc);
  flushLegacy();

  return [
    ...[...byId.values()].map((row) => ({
      id: row.id,
      answer: normalizeSpace(row.parts.join('')),
      plain: normalizeSpace(row.plains.join(' ')),
    })),
    ...legacyItems,
  ].filter((row) => row.answer);
}

export function toGameItem({ id, answer, plain }) {
  const ans = normalizeSpace(answer);
  if (!ans) return null;
  const context = normalizeSpace(plain);

  if (context && ans.toLowerCase() !== context.toLowerCase()) {
    const escaped = ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let next = context.replace(new RegExp(escaped, 'i'), '_____');
    if (!next.includes('_____')) {
      next = context;
      ans.split(' ').slice(0, 8).forEach((word) => {
        if (word.length < 3) return;
        const re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        next = next.replace(re, '_____');
      });
    }
    const prompt = normalizeSpace(next);
    const contextLeft = prompt.replace(/_+/g, '').trim();
    if (prompt.includes('_____') && contextLeft.length >= 2) {
      return { id, answer: ans, prompt: trimClozePrompt(prompt) };
    }
  }

  return {
    id,
    answer: ans,
    prompt: 'Which of these did you mark?',
  };
}

export const toClozeGameItem = toGameItem;

export function collectHighlightGroupsFromEditor(editor) {
  return collectHighlightGroupsFromDocument(editor?.document);
}

export function buildGameItemsFromDocument(doc, { choiceCount = 3 } = {}) {
  const raw = collectHighlightGroupsFromDocument(doc);
  const groups = raw.map(toGameItem).filter(Boolean);
  return buildGameItemsFromGroups(groups, { choiceCount });
}

export function buildGameItemsFromHighlights(editor, { choiceCount = 3 } = {}) {
  return buildGameItemsFromDocument(editor?.document, { choiceCount });
}
