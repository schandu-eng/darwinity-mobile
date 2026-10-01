/** [[term]] is the notes markdown marker for glossary / key terms.
 *  Web BlockNote turns it into bold brand-green text; other surfaces must too.
 */

export function withGlossaryTermStyles(styles = {}) {
  return { ...styles, textColor: 'green', bold: true };
}

export function stripGlossaryMarkers(text) {
  if (!text || typeof text !== 'string') return text || '';
  return text.replace(/\[\[([^\]\n]+?)\]\]/g, '$1');
}

/** Keep emphasis when the consumer is markdown, not BlockNote inlines. */
export function glossaryMarkersToMarkdown(text) {
  if (!text || typeof text !== 'string') return text || '';
  return text.replace(/\[\[([^\]\n]+?)\]\]/g, '**$1**');
}

export function splitTextByGlossaryMarkers(text, styles = {}) {
  if (typeof text !== 'string' || !text) {
    return [{ type: 'text', text: text || '', styles }];
  }
  if (styles.code || !text.includes('[[')) {
    return [{ type: 'text', text, styles }];
  }

  const result = [];
  const re = /\[\[([^\]\n]+?)\]\]/g;
  let lastIndex = 0;
  let match = re.exec(text);
  while (match) {
    if (match.index > lastIndex) {
      result.push({
        type: 'text',
        text: text.slice(lastIndex, match.index),
        styles,
      });
    }
    result.push({
      type: 'text',
      text: match[1],
      styles: withGlossaryTermStyles(styles),
    });
    lastIndex = match.index + match[0].length;
    match = re.exec(text);
  }
  if (lastIndex < text.length) {
    result.push({ type: 'text', text: text.slice(lastIndex), styles });
  }
  return result.length > 0 ? result : [{ type: 'text', text, styles }];
}

function inlineTextFromContent(content) {
  if (!Array.isArray(content)) return '';
  return content
    .map((item) => {
      if (item?.type === 'text' && typeof item.text === 'string') return item.text;
      if (Array.isArray(item?.content)) return inlineTextFromContent(item.content);
      return '';
    })
    .join('');
}

const LEGACY_DEF_CALLOUT_TEXT_RE =
  /^\*{0,2}Definition:\*{0,2}\s*(.+?)\s*[—–-]\s*(.+)$/i;

/** Rewrite legacy `Definition: term — meaning` callouts to `**term** — meaning`. */
export function normalizeLegacyDefinitionCalloutText(text) {
  if (!text || typeof text !== 'string') return text || '';
  const trimmed = text.trim();
  const match = LEGACY_DEF_CALLOUT_TEXT_RE.exec(trimmed);
  if (!match) return text;
  const term = match[1].trim();
  const meaning = match[2].trim();
  if (!term || !meaning) return text;
  return `**${term}** — ${meaning}`;
}

/** Normalize legacy definition labels inside quote / blockquote blocks. */
export function normalizeLegacyDefinitionCalloutsInBlocks(blocks) {
  if (!Array.isArray(blocks)) return blocks;

  return blocks.map((block) => {
    if (!block || typeof block !== 'object') return block;
    let next = block;

    if (next.type === 'quote' || next.type === 'blockquote') {
      const fullText = inlineTextFromContent(next.content);
      const normalized = normalizeLegacyDefinitionCalloutText(fullText);
      if (normalized !== fullText) {
        const termMatch = /^\*\*(.+?)\*\*\s*[—–-]\s*(.+)$/s.exec(normalized);
        if (termMatch) {
          next = {
            ...next,
            content: [
              { type: 'text', text: termMatch[1], styles: { bold: true } },
              { type: 'text', text: ` — ${termMatch[2]}` },
            ],
          };
        }
      }
    }

    if (Array.isArray(next.children)) {
      const children = normalizeLegacyDefinitionCalloutsInBlocks(next.children);
      if (children !== next.children) next = { ...next, children };
    }

    return next;
  });
}

function expandGlossaryInInlineArray(content) {
  if (!Array.isArray(content)) return content;
  const out = [];
  content.forEach((item) => {
    if (item?.type === 'text' && typeof item.text === 'string' && item.text.includes('[[')) {
      out.push(...splitTextByGlossaryMarkers(item.text, item.styles || {}));
      return;
    }
    if (item && Array.isArray(item.content)) {
      out.push({ ...item, content: expandGlossaryInInlineArray(item.content) });
      return;
    }
    out.push(item);
  });
  return out;
}

function processCellWith(cell, fn) {
  if (Array.isArray(cell)) return fn(cell);
  if (typeof cell === 'string') return fn([{ type: 'text', text: cell, styles: {} }]);
  if (cell && Array.isArray(cell.content)) {
    return { ...cell, content: fn(cell.content) };
  }
  return cell;
}

function mapTableRows(tableContent, fn) {
  if (!tableContent || !Array.isArray(tableContent.rows)) return tableContent;
  return {
    ...tableContent,
    rows: tableContent.rows.map((row) => ({
      ...row,
      cells: Array.isArray(row.cells)
        ? row.cells.map((cell) => processCellWith(cell, fn))
        : row.cells,
    })),
  };
}

/** Rewrite legacy markdown definition callouts to bold-term format. */
export function normalizeLegacyDefinitionCalloutMarkdown(md) {
  if (!md || typeof md !== 'string') return md || '';
  return md.replace(
    /^>\s*\*{0,2}Definition:\*{0,2}\s*(.+?)\s*[—–-]\s*(.+?)\s*$/gim,
    (_match, term, meaning) => `> **${term.trim()}** — ${meaning.trim()}`,
  );
}

/** Heal editor_blocks that still contain literal [[term]] markers. */
export function expandGlossaryMarkersInBlocks(blocks) {
  if (!Array.isArray(blocks)) return blocks;

  const normalized = normalizeLegacyDefinitionCalloutsInBlocks(blocks);

  return normalized.map((block) => {
    const next = { ...block };

    if (Array.isArray(next.content)) {
      next.content = expandGlossaryInInlineArray(next.content);
    } else if (next.content && Array.isArray(next.content.rows)) {
      next.content = mapTableRows(next.content, expandGlossaryInInlineArray);
    } else if (typeof next.content === 'string' && next.content.includes('[[')) {
      next.content = glossaryMarkersToMarkdown(next.content);
    }

    if (Array.isArray(next.children)) {
      next.children = expandGlossaryMarkersInBlocks(next.children);
    }

    return next;
  });
}
