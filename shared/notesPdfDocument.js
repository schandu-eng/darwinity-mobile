import MarkdownIt from 'markdown-it';
import pdfPageLayout from './pdfPageLayout.json';
import {
  NOTES_PDF_BODY_FONT_STACK,
  NOTES_PDF_MONO_FONT_STACK,
} from './notesPdfFonts.js';
import { generateNotesPdfStyles } from './notesPdfStyles.js';
import { stripBareNumberMath } from './mathText.js';
import { flattenBlocksText } from './flattenBlockText.js';
import { expandGlossaryMarkersInBlocks, glossaryMarkersToMarkdown } from './glossaryMarkers.js';

const markdownParser = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

/* Match light-mode StudyMaterialPage.css / BlockNote preview (not print-chrome). */
const BRAND = {
  primary: '#3F6B4F',
  primaryDark: '#5A8A6A',
  primarySoft: 'rgba(90, 138, 106, 0.12)',
  text: '#27272a',
  heading: '#09090b',
  headingSub: '#18181b',
  muted: '#71717a',
  border: 'rgba(63, 107, 79, 0.22)',
  surface: '#ffffff',
  surfaceAlt: 'rgba(24, 24, 27, 0.06)',
  headerBg: 'rgba(63, 107, 79, 0.08)',
  quoteBg: 'rgba(90, 138, 106, 0.06)',
  codeBg: '#f8fafc',
  codeText: '#0f172a',
  divider: 'rgba(208, 215, 222, 0.6)',
  highlightSoft: 'rgba(24, 24, 27, 0.07)',
  highlightGreen: 'rgba(63, 107, 79, 0.1)',
  highlightGray: 'rgba(113, 113, 122, 0.18)',
};

const EMPHASIS_TEXT_COLORS = new Set(['green', 'blue', 'purple']);

/* Preview remaps chromatic text → neutral / growth green. */
const BLOCKNOTE_THEME_TEXT = {
  gray: '#71717a',
  brown: '#52525b',
  red: '#52525b',
  orange: '#52525b',
  yellow: '#52525b',
  green: '#5A8A6A',
  blue: '#5A8A6A',
  purple: '#5A8A6A',
  pink: '#52525b',
};

const BLOCKNOTE_THEME_BG = {
  gray: BRAND.highlightGray,
  brown: BRAND.highlightSoft,
  red: BRAND.highlightSoft,
  orange: BRAND.highlightSoft,
  yellow: BRAND.highlightSoft,
  green: BRAND.highlightGreen,
  blue: BRAND.highlightSoft,
  purple: BRAND.highlightSoft,
  pink: BRAND.highlightSoft,
};

const TEXT_COLOR_MAP_LEGACY = { ...BLOCKNOTE_THEME_TEXT };

const BACKGROUND_COLOR_MAP_LEGACY = {
  ...BLOCKNOTE_THEME_BG,
  primary: BRAND.highlightSoft,
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}

function escapeStyleValue(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const MARKDOWN_ALLOWED_TAGS = new Set([
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
]);

const MARKDOWN_SELF_CLOSING_TAGS = new Set(['br', 'hr', 'img']);

function isRelativeUrl(value) {
  return !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
}

function isSafeLinkUrl(value) {
  const url = String(value || '').trim();
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:')) {
    return false;
  }
  if (url.startsWith('#') || url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
    return true;
  }
  if (isRelativeUrl(url)) return true;
  return lower.startsWith('http:') || lower.startsWith('https:') || lower.startsWith('mailto:') || lower.startsWith('tel:');
}

function isSafeImageUrl(value) {
  const url = String(value || '').trim();
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) {
    return false;
  }
  if (lower.startsWith('data:')) {
    return lower.startsWith('data:image/');
  }
  if (url.startsWith('#') || url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
    return true;
  }
  if (isRelativeUrl(url)) return true;
  return lower.startsWith('http:') || lower.startsWith('https:');
}

function sanitizeMarkdownHtml(html) {
  if (!html) return '';
  let cleaned = html
    .replace(
      /<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      ''
    )
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, '');

  cleaned = cleaned.replace(/<\s*\/?\s*([a-z0-9-]+)([^>]*)>/gi, (match, tagName, rawAttrs) => {
    const tag = String(tagName || '').toLowerCase();
    if (!MARKDOWN_ALLOWED_TAGS.has(tag)) {
      return '';
    }

    const isClosing = /^\s*<\s*\//.test(match);
    if (isClosing) {
      return `</${tag}>`;
    }

    const attrs = [];
    const attrPattern = /([a-zA-Z0-9:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^"'\s>]+)))?/g;
    let attrMatch;
    while ((attrMatch = attrPattern.exec(rawAttrs))) {
      const name = attrMatch[1].toLowerCase();
      const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
      if (name.startsWith('on') || name === 'style') continue;

      if (tag === 'a' && name === 'href') {
        if (!isSafeLinkUrl(value)) continue;
        attrs.push(`href="${escapeAttribute(value)}"`);
        continue;
      }

      if (tag === 'img' && name === 'src') {
        if (!isSafeImageUrl(value)) continue;
        attrs.push(`src="${escapeAttribute(value)}"`);
        continue;
      }

      if (tag === 'img' && (name === 'alt' || name === 'title')) {
        attrs.push(`${name}="${escapeAttribute(value)}"`);
        continue;
      }

      if (tag === 'a' && (name === 'title' || name === 'target' || name === 'rel')) {
        attrs.push(`${name}="${escapeAttribute(value)}"`);
      }
    }

    const attrString = attrs.length ? ` ${attrs.join(' ')}` : '';
    if (MARKDOWN_SELF_CLOSING_TAGS.has(tag)) {
      return `<${tag}${attrString} />`;
    }
    return `<${tag}${attrString}>`;
  });

  return cleaned;
}

function renderMarkdownContent(markdown) {
  if (!markdown) return '';
  try {
    const rendered = markdownParser.render(glossaryMarkersToMarkdown(String(markdown)));
    return sanitizeMarkdownHtml(rendered);
  } catch {
    return escapeHtml(glossaryMarkersToMarkdown(String(markdown)));
  }
}

function sanitizePdfFilename(filename) {
  return String(filename ?? 'Notes')
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'Notes';
}

function parseEditorBlocks(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function stripReferenceMarkers(text) {
  return String(text ?? '')
    .replace(/\[Watch:\s*\d{1,3}:\d{1,2}(?::\d{1,2})?s?\]/gi, '')
    .replace(/\[Page:?\s*\d+,\s*Lines?:?\s*\d+(?:-\d+)?\]/gi, '')
    .replace(/\[\d+\.?\d*s\]\s*/g, '')
    .replace(/\(\d+\.?\d*s(?:,\s*\d+\.?\d*s)*\)/g, '')
    .replace(/\s*\(\s*[Pp]age\s+\d+\s*\)/g, '')
    .trim();
}

function noteItemsToBlocks(items) {
  const blocks = [];

  items.forEach((note, index) => {
    const topic = String(note?.topic || `Section ${index + 1}`).trim();
    if (topic) {
      blocks.push({
        type: 'heading',
        props: { level: 2 },
        content: [{ type: 'text', text: topic }],
      });
    }

    // Prefer structured blocks (rendered by type); fall back to the markdown string.
    if (Array.isArray(note?.blocks) && note.blocks.length > 0) {
      blocks.push(...note.blocks);
      return;
    }

    const content = stripReferenceMarkers(note?.content || '');
    if (!content) return;

    blocks.push({
      type: 'markdown',
      content,
    });
  });

  return blocks;
}

function notesToBlocks({ topics, editorBlocks }) {
  const parsed = parseEditorBlocks(editorBlocks);
  // Prefer saved editor_blocks only when they contain text; empty stubs fall through to topics.
  if (parsed?.length && flattenBlocksText(parsed).trim()) {
    return expandGlossaryMarkersInBlocks(parsed);
  }
  return expandGlossaryMarkersInBlocks(
    noteItemsToBlocks(
      (topics || []).map((topic) => ({ topic: topic.title, content: topic.note || '', blocks: topic.note_blocks }))
    )
  );
}

function resolveColor(value) {
  if (!value || value === 'default') return '';
  if (typeof value !== 'string') return '';
  if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')) return value;
  if (value === 'primary') return BRAND.primary;
  return (
    BLOCKNOTE_THEME_TEXT[value] ||
    TEXT_COLOR_MAP_LEGACY[value] ||
    ''
  );
}

function isEmphasisTextToken(value) {
  return typeof value === 'string' && EMPHASIS_TEXT_COLORS.has(value);
}

function resolveBackgroundColor(value) {
  if (!value || value === 'default') return '';
  if (value === true) return BRAND.highlightSoft;
  if (typeof value !== 'string') return '';
  if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')) {
    // Named token washes are remapped; raw hex keeps author intent.
    return value;
  }
  return (
    BLOCKNOTE_THEME_BG[value] ||
    BACKGROUND_COLOR_MAP_LEGACY[value] ||
    ''
  );
}

function getBlockStyleAttribute(block) {
  const styles = [];
  const textToken = block?.props?.textColor;
  const textColor = resolveColor(textToken);
  const backgroundColor = resolveBackgroundColor(block?.props?.backgroundColor);
  if (textColor) {
    styles.push(`color:${textColor}`);
    if (isEmphasisTextToken(textToken)) styles.push('font-weight:600');
    styles.push('-webkit-print-color-adjust:exact');
    styles.push('print-color-adjust:exact');
  }
  if (backgroundColor) {
    styles.push(`background-color:${backgroundColor}`);
    styles.push('-webkit-print-color-adjust:exact');
    styles.push('print-color-adjust:exact');
    styles.push('border-radius:4px');
    styles.push('padding:0.1em 0.2em');
  }
  return styles.length ? ` style="${escapeStyleValue(styles.join(';'))}"` : '';
}

const BULLET_LIST_TYPES = new Set([
  'bulletListItem',
  'bullet_list_item',
  'unorderedListItem',
  'listItem',
]);

const NUMBERED_LIST_TYPES = new Set([
  'numberedListItem',
  'numbered_list_item',
  'orderedListItem',
]);

const CHECK_LIST_TYPES = new Set([
  'checkListItem',
  'check_list_item',
  'taskListItem',
  'checklist',
]);

function getListGroup(type) {
  if (BULLET_LIST_TYPES.has(type)) return 'bullet';
  if (NUMBERED_LIST_TYPES.has(type)) return 'numbered';
  if (CHECK_LIST_TYPES.has(type)) return 'check';
  return null;
}

function isListBlock(block) {
  return Boolean(block && getListGroup(block.type) !== null);
}

function renderInlineNodes(content) {
  if (!Array.isArray(content) || content.length === 0) return '';
  return content.map((node) => renderInlineNode(node)).join('');
}

function renderInlineNode(node) {
  if (!node) return '';
  if (typeof node === 'string') return escapeHtml(node);

  if (node.type === 'hardBreak' || node.type === 'lineBreak') {
    return '<br />';
  }

  if (node.type === 'timestamp') {
    const time = node.props?.time ? escapeHtml(node.props.time) : '';
    return time ? `<span class="sn-inline-tag">${time}</span>` : '';
  }

  if (node.type === 'pdfReference') {
    const page = node.props?.page;
    const startLine = node.props?.startLine;
    const endLine = node.props?.endLine;
    if (!page || !startLine || !endLine) return '';
    const label =
      startLine === endLine
        ? `Page ${page}, Line ${startLine}`
        : `Page ${page}, Lines ${startLine}-${endLine}`;
    return `<span class="sn-inline-tag">${escapeHtml(label)}</span>`;
  }

  if (node.type === 'math') {
    const latex = node.props?.latex || '';
    if (!latex) return '';
    const display = node.props?.display ? '1' : '0';
    return `<span class="dw-pdf-math" data-latex="${escapeAttribute(latex)}" data-display="${display}"></span>`;
  }

  if (node.type === 'link') {
    const href = node.props?.href || node.props?.url || '';
    const body = node.content?.length
      ? renderInlineNodes(node.content)
      : escapeHtml(node.text || href);
    if (!href) return body;
    return `<a class="sn-link" href="${escapeAttribute(href)}" target="_blank" rel="noreferrer">${body}</a>`;
  }

  const children = Array.isArray(node.content) ? renderInlineNodes(node.content) : '';

  if (node.type === 'text' || typeof node.text === 'string') {
    const inlineStyles = { ...(node.props || {}), ...(node.styles || {}) };
    const styleParts = [];
    const textDecorations = [];

    const isBold = !!inlineStyles.bold;
    if (inlineStyles.italic) styleParts.push('font-style:italic');
    if (inlineStyles.underline || inlineStyles.underlined) textDecorations.push('underline');
    if (inlineStyles.strike || inlineStyles.strikethrough) textDecorations.push('line-through');
    if (textDecorations.length) styleParts.push(`text-decoration:${textDecorations.join(' ')}`);

    const textColorToken =
      inlineStyles.textColor || inlineStyles.color || inlineStyles.foregroundColor;
    const textColor = resolveColor(textColorToken);
    if (textColor) {
      styleParts.push(`color:${textColor}`);
      if (isEmphasisTextToken(textColorToken)) styleParts.push('font-weight:600');
      styleParts.push('-webkit-print-color-adjust:exact');
      styleParts.push('print-color-adjust:exact');
    }

    const bgToken =
      inlineStyles.backgroundColor ??
      inlineStyles.background ??
      inlineStyles.highlight ??
      inlineStyles.bgColor;
    let highlightColor = resolveBackgroundColor(bgToken);
    if (!highlightColor && inlineStyles.revisionMark) {
      // Preview softens revision / mark washes to quiet gray.
      highlightColor = BRAND.highlightSoft;
    }

    const wrapBold = (inner) => (isBold ? `<strong>${inner}</strong>` : inner);

    if (inlineStyles.code) {
      styleParts.push(`background-color:${BRAND.surfaceAlt}`);
      styleParts.push(`border:1px solid ${BRAND.border}`);
      styleParts.push('border-radius:4px');
      styleParts.push('padding:0.1em 0.3em');
      styleParts.push('font-family:Outfit, sans-serif');
      styleParts.push('font-size:0.9em');
      styleParts.push('-webkit-print-color-adjust:exact');
      styleParts.push('print-color-adjust:exact');
      const text = escapeHtml(node.text || '').replace(/\n/g, '<br />');
      const styleAttribute = styleParts.length ? ` style="${escapeStyleValue(styleParts.join(';'))}"` : '';
      return wrapBold(`<span${styleAttribute}>${text}</span>`);
    }

    if (highlightColor) {
      // Keep highlights true inline. PyMuPDF Story treats inline-block marks as
      // forced line boxes (semicolon-alone lines, huge vertical gaps).
      styleParts.push(`background-color:${highlightColor}`);
      styleParts.push(`background:${highlightColor}`);
      styleParts.push('display:inline');
      styleParts.push('vertical-align:baseline');
      styleParts.push('padding:0.05em 0.22em');
      styleParts.push('-webkit-print-color-adjust:exact');
      styleParts.push('print-color-adjust:exact');
    }

    const text = escapeHtml(stripBareNumberMath(node.text || '')).replace(/\n/g, '<br />');
    const styleAttribute = styleParts.length ? ` style="${escapeStyleValue(styleParts.join(';'))}"` : '';
    if (highlightColor) {
      return wrapBold(`<mark class="dw-pdf-highlight"${styleAttribute}>${text}</mark>`);
    }
    return wrapBold(`<span${styleAttribute}>${text}</span>`);
  }

  if (children) return children;
  return escapeHtml(stripBareNumberMath(node.text || ''));
}

function extractInlineText(content) {
  if (!Array.isArray(content)) return '';
  return content
    .map((node) => {
      if (!node) return '';
      if (typeof node === 'string') return node;
      if (node.type === 'hardBreak' || node.type === 'lineBreak') return '\n';
      if (typeof node.text === 'string') return node.text;
      if (Array.isArray(node.content)) return extractInlineText(node.content);
      return '';
    })
    .join('');
}

function cellToInlineArray(cell) {
  if (!cell) return [];
  if (typeof cell === 'string') return [{ type: 'text', text: cell }];
  if (cell.type === 'tableCell' && Array.isArray(cell.content)) return cell.content;
  if (Array.isArray(cell)) return cell.flatMap((item) => cellToInlineArray(item));
  if (Array.isArray(cell.content)) return cell.content;
  if (typeof cell.text === 'string') {
    return [{ type: cell.type || 'text', text: cell.text, styles: cell.styles, props: cell.props }];
  }
  return [];
}

function getTableRows(tableBlock) {
  const tableContent = tableBlock?.content;
  if (tableContent && !Array.isArray(tableContent) && Array.isArray(tableContent.rows)) {
    return tableContent.rows
      .map((row) => {
        const cells = Array.isArray(row?.cells) ? row.cells : [];
        return cells.map((cell) => cellToInlineArray(cell));
      })
      .filter((row) => row.length > 0);
  }

  const rows = Array.isArray(tableBlock?.children)
    ? tableBlock.children
    : Array.isArray(tableBlock?.content)
      ? tableBlock.content
      : [];

  return rows
    .map((row) => {
      const cells = Array.isArray(row?.children)
        ? row.children
        : Array.isArray(row?.content)
          ? row.content
          : [];
      return cells.map((cell) => cellToInlineArray(cell));
    })
    .filter((row) => row.length > 0);
}

function renderList(representativeType, items) {
  const group = getListGroup(representativeType);
  const isCheck = group === 'check';
  const isNumbered = group === 'numbered';

  const tag = isNumbered ? 'ol' : 'ul';
  const className = isCheck ? 'sn-list sn-check-list' : 'sn-list';

  const listItems = items
    .map((item) => {
      const marker = isCheck
        ? `<span class="sn-check-marker" aria-hidden="true">${item.props?.checked ? '☑' : '☐'}</span>`
        : '';
      const contentHtml = renderInlineNodes(item.content);
      const childrenHtml = Array.isArray(item.children) && item.children.length
        ? renderBlocks(item.children)
        : '';
      return `<li class="sn-list-item"${getBlockStyleAttribute(item)}>${marker}<div class="sn-list-item-body">${contentHtml || '<span></span>'}${childrenHtml}</div></li>`;
    })
    .join('');

  return `<${tag} class="${className}">${listItems}</${tag}>`;
}

function renderToggleShell(titleHtml, bodyHtml, extraClass = '') {
  return `
    <section class="sn-toggle-shell ${extraClass}">
      <div class="sn-toggle-summary">
        <span class="sn-toggle-glyph" aria-hidden="true">▾</span>
        <div class="sn-toggle-title">${titleHtml}</div>
      </div>
      <div class="sn-toggle-body">${bodyHtml}</div>
    </section>
  `;
}

function renderMediaCard(kind, label, url) {
  return `
    <a class="sn-media-card" href="${escapeAttribute(url)}" target="_blank" rel="noreferrer">
      <div class="sn-media-icon">${escapeHtml(kind)}</div>
      <div class="sn-media-copy">
        <div class="sn-media-title">${escapeHtml(label)}</div>
        <div class="sn-media-url">${escapeHtml(url)}</div>
      </div>
    </a>
  `;
}

function renderTableBlock(block) {
  const rows = getTableRows(block);
  if (!rows.length) return '';

  const body = rows
    .map((row, rowIndex) => {
      const tag = rowIndex === 0 ? 'th' : 'td';
      const cells = row
        .map((cell) => `<${tag}>${renderInlineNodes(cell) || '&nbsp;'}</${tag}>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return `
    <div class="sn-table-wrap">
      <table class="sn-table">
        ${body}
      </table>
    </div>
  `;
}

function safeParseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function renderVisualShell(title, body) {
  return `
    <section class="sn-visual-shell">
      <div class="sn-visual-header">
        <div class="sn-visual-badge">Visual</div>
        <h4>${escapeHtml(title || 'Visual')}</h4>
      </div>
      <div class="sn-visual-body">${body}</div>
    </section>
  `;
}

function renderComparisonTable(data, title) {
  const columns = Array.isArray(data?.columns) ? data.columns : [];
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  if (!columns.length || !rows.length) {
    return renderVisualShell(title, '<p class="sn-visual-empty">Comparison data unavailable.</p>');
  }

  const tableRows = rows
    .map((row) => {
      const cells = columns
        .map((column) => `<td>${escapeHtml(row?.attributes?.[column] ?? '') || '&nbsp;'}</td>`)
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  return renderVisualShell(
    title,
    `
      <div class="sn-table-wrap">
        <table class="sn-table sn-visual-table">
          <tr>${columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr>
          ${tableRows}
        </table>
      </div>
    `,
  );
}

function renderCustomVisual(block) {
  const rawData = safeParseJson(block?.props?.dataJson);
  const visualType = block?.props?.visualType || block?.type;
  const title = block?.props?.title || 'Visual';

  if (visualType === 'comparison_table' || block?.type === 'comparisonTable') {
    return renderComparisonTable(rawData, title);
  }

  return renderVisualShell(title, '<p class="sn-visual-empty">Visual data unavailable.</p>');
}

function renderBlock(block) {
  if (!block) return '';

  const styleAttribute = getBlockStyleAttribute(block);
  const childrenHtml = Array.isArray(block.children) && block.children.length
    ? renderBlocks(block.children)
    : '';
  const inlineHtml = renderInlineNodes(block.content);

  switch (block.type) {

    case 'heading': {
      const level = Math.max(1, Math.min(Number(block?.props?.level) || 2, 6));
      const headingHtml = `<h${level} class="sn-heading sn-heading-${level}"${styleAttribute}>${inlineHtml || '&nbsp;'}</h${level}>`;
      if (block?.props?.isToggleable) {
        return renderToggleShell(headingHtml, childrenHtml, `sn-heading-toggle sn-heading-toggle-${level}`);
      }
      return `${headingHtml}${childrenHtml}`;
    }

    case 'toggleHeading':
    case 'toggleHeading1':
    case 'toggle_heading_1': {
      const h = `<h1 class="sn-heading sn-heading-1"${styleAttribute}>${inlineHtml || '&nbsp;'}</h1>`;
      return renderToggleShell(h, childrenHtml, 'sn-heading-toggle sn-heading-toggle-1');
    }
    case 'toggleHeading2':
    case 'toggle_heading_2': {
      const h = `<h2 class="sn-heading sn-heading-2"${styleAttribute}>${inlineHtml || '&nbsp;'}</h2>`;
      return renderToggleShell(h, childrenHtml, 'sn-heading-toggle sn-heading-toggle-2');
    }
    case 'toggleHeading3':
    case 'toggle_heading_3': {
      const h = `<h3 class="sn-heading sn-heading-3"${styleAttribute}>${inlineHtml || '&nbsp;'}</h3>`;
      return renderToggleShell(h, childrenHtml, 'sn-heading-toggle sn-heading-toggle-3');
    }

    case 'paragraph':
      return `<p class="sn-paragraph"${styleAttribute}>${inlineHtml || '&nbsp;'}</p>${childrenHtml}`;

    case 'quote':
    case 'blockquote':
    case 'callout':
      return `<blockquote class="sn-quote"${styleAttribute}>${inlineHtml || '&nbsp;'}${childrenHtml}</blockquote>`;

    case 'toggleListItem':
    case 'toggle_list_item':
    case 'toggle':
      return renderToggleShell(
        `<p class="sn-paragraph"${styleAttribute}>${inlineHtml || '&nbsp;'}</p>`,
        childrenHtml,
      );

    case 'codeBlock':
    case 'code_block':
    case 'code': {
      const language = block?.props?.language ? escapeHtml(block.props.language) : '';
      const codeText = extractInlineText(block.content);
      const soloClass = language ? '' : ' sn-code-block--solo';
      return `
        <section class="sn-code-block${soloClass}">
          ${language ? `<div class="sn-code-language">${language}</div>` : ''}
          <pre><code>${escapeHtml(codeText)}</code></pre>
        </section>
      `;
    }

    case 'divider':
    case 'horizontalRule':
    case 'separator':
    case 'hr':
      return '<hr class="sn-divider" />';

    case 'image': {
      const url = block.props?.url || block.props?.src;
      if (!url) return '';
      const caption = block.props?.caption ? escapeHtml(String(block.props.caption)) : '';
      // Empty alt when caption is shown as figcaption — avoids duplicate text in
      // Chromium print if the image src fails to load before inlining.
      const img = `<img class="sn-note-image" src="${escapeAttribute(url)}" alt="" />`;
      return caption
        ? `<figure class="sn-note-figure">${img}<figcaption class="sn-note-figcaption">${caption}</figcaption></figure>`
        : `<figure class="sn-note-figure">${img}</figure>`;
    }

    case 'video':
    case 'videoEmbed': {
      const url = block?.props?.url || block?.props?.src;
      if (!url) return '';
      return renderMediaCard('VIDEO', block?.props?.name || block?.props?.caption || 'Video', url);
    }

    case 'audio':
    case 'audioEmbed': {
      const url = block?.props?.url || block?.props?.src;
      if (!url) return '';
      return renderMediaCard('AUDIO', block?.props?.name || block?.props?.caption || 'Audio', url);
    }

    case 'file':
    case 'embed':
    case 'bookmark':
    case 'linkPreview':
    case 'link_preview':
    case 'youtubeEmbed':
    case 'youtube':
    case 'YouTube': {
      const url = block?.props?.url || block?.props?.src || block?.props?.href;
      if (!url) return inlineHtml ? `<p class="sn-paragraph">${inlineHtml}</p>` : '';
      const kindMap = {
        youtubeEmbed: 'VIDEO',
        youtube: 'VIDEO',
        YouTube: 'VIDEO',
        audio: 'AUDIO',
        audioEmbed: 'AUDIO',
        embed: 'EMBED',
        bookmark: 'LINK',
        linkPreview: 'LINK',
        link_preview: 'LINK',
      };
      const kind = kindMap[block.type] || 'FILE';
      const label = block?.props?.name || block?.props?.caption || block?.props?.title || url;
      return renderMediaCard(kind, label, url);
    }

    case 'table':
      return renderTableBlock(block);

    case 'emoji': {
      const emoji =
        block?.props?.emoji ||
        block?.props?.native ||
        block?.props?.symbol ||
        (typeof block?.content === 'string' ? block.content : '') ||
        extractInlineText(block?.content) ||
        '';
      if (!emoji) return '';
      return `<p class="sn-emoji-block"${styleAttribute}>${escapeHtml(emoji)}</p>`;
    }

    case 'markdown':
      return `<div class="sn-markdown-block"${styleAttribute}>${renderMarkdownContent(block.content)}</div>${childrenHtml}`;

    case 'processFlow':
      return renderVisualShell(
        'Process Flow',
        '<p class="sn-visual-empty">Process flow export is not available yet.</p>',
      );
    case 'contextualHierarchy':
      return renderVisualShell(
        'Contextual Hierarchy',
        '<p class="sn-visual-empty">Contextual hierarchy export is not available yet.</p>',
      );
    case 'comparisonTable':
      return renderCustomVisual(block);


    default:
      if (inlineHtml) {
        return `<div class="sn-paragraph"${styleAttribute}>${inlineHtml}</div>${childrenHtml}`;
      }
      return childrenHtml;
  }
}

function getBlockWrapperClass(block) {
  if (!block) return 'sn-block';
  const type = block.type;

  if (type === 'heading') {
    const level = Math.max(1, Math.min(Number(block?.props?.level) || 2, 6));
    return `sn-block sn-block--heading sn-block--h${level}`;
  }
  if (type === 'toggleHeading' || type === 'toggleHeading1' || type === 'toggle_heading_1') {
    return 'sn-block sn-block--heading sn-block--h1';
  }
  if (type === 'toggleHeading2' || type === 'toggle_heading_2') {
    return 'sn-block sn-block--heading sn-block--h2';
  }
  if (type === 'toggleHeading3' || type === 'toggle_heading_3') {
    return 'sn-block sn-block--heading sn-block--h3';
  }
  if (type === 'paragraph') return 'sn-block sn-block--paragraph';
  if (type === 'quote' || type === 'blockquote' || type === 'callout') {
    return 'sn-block sn-block--quote';
  }
  if (isListBlock(block)) return 'sn-block sn-block--list';
  if (type === 'markdown') return 'sn-block sn-block--markdown';
  return 'sn-block';
}

function wrapBlockHtml(block, html) {
  if (!html) return '';
  return `<div class="${getBlockWrapperClass(block)}">${html}</div>`;
}

function renderBlocks(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';

  let index = 0;
  let html = '';

  while (index < blocks.length) {
    const block = blocks[index];
    if (!block) {
      index += 1;
      continue;
    }

    if (isListBlock(block)) {
      const group = getListGroup(block.type);
      const representativeType = block.type;
      const items = [];
      while (index < blocks.length && getListGroup(blocks[index]?.type) === group) {
        items.push(blocks[index]);
        index += 1;
      }
      html += wrapBlockHtml(
        { type: representativeType },
        renderList(representativeType, items),
      );
      continue;
    }

    html += wrapBlockHtml(block, renderBlock(block));
    index += 1;
  }

  return html;
}


function buildNotesPdfHtml({
  title,
  blocks,
  includeClientPrintChrome = false,
}) {
  const safeTitle = String(title || 'Notes').trim() || 'Notes';
  const resolvedBlocks = Array.isArray(blocks) ? blocks : [];

  if (!resolvedBlocks.length) {
    throw new Error('No notes available to export');
  }

  const contentHtml = renderBlocks(resolvedBlocks);
  const bodyClass = `dw-pdf dw-pdf--outfit ${includeClientPrintChrome ? 'dw-pdf--client' : 'dw-pdf--server'}`;
  const clientChrome = includeClientPrintChrome
    ? `
    <header class="sn-client-pdf-header" aria-hidden="true">
      <span class="sn-client-pdf-header-left">Darwinity</span>
    </header>
    <footer class="sn-client-pdf-footer" aria-hidden="true">
      <span class="sn-client-pdf-footer-page" aria-hidden="true"></span>
    </footer>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=595, initial-scale=1" />
    <title>${escapeHtml(safeTitle)}</title>
    <style>
${generateNotesPdfStyles(BRAND, NOTES_PDF_BODY_FONT_STACK, NOTES_PDF_MONO_FONT_STACK, pdfPageLayout)}
    </style>
  </head>
  <body class="${bodyClass}">
    <div class="sn-doc">
      ${clientChrome}
      <main class="sn-content">${contentHtml}</main>
    </div>
  </body>
</html>`;
}

export {
  buildNotesPdfHtml,
  notesToBlocks,
  sanitizePdfFilename,
};
