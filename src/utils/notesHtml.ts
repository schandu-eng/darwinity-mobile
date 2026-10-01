import type { BlockNoteBlock, BlockNoteInline } from './notesMarkdown';
import { stripBareNumberMath } from '@shared/mathText.js';
import { expandGlossaryMarkersInBlocks } from '@shared/glossaryMarkers.js';
import { toAbsoluteApiUrl } from '@/utils/noteImageUrl';

interface HtmlOptions {
  dark: boolean;
  primaryColor?: string;
}

const textColorLight: Record<string, string> = {
  gray: '#374151', blue: '#5A8A6A', green: '#5A8A6A', yellow: '#B45309',
  orange: '#C2410C', red: '#B91C1C', purple: '#5A8A6A', pink: '#BE185D',
};
const textColorDark: Record<string, string> = {
  gray: '#E5E7EB', blue: '#8FB39C', green: '#8FB39C', yellow: '#FDE68A',
  orange: '#FDBA74', red: '#FCA5A5', purple: '#8FB39C', pink: '#F9A8D4',
};
const bgColorLight: Record<string, string> = {
  gray: '#E5E7EB', blue: '#E5E7EB', green: '#E5E7EB', yellow: '#FEF3C7',
  orange: '#FFEDD5', red: '#FEE2E2', purple: '#E5E7EB', pink: '#FCE7F3',
};
const bgColorDark: Record<string, string> = {
  gray: '#3F3F46', blue: '#3F3F46', green: '#3F3F46', yellow: '#713F12',
  orange: '#7C2D12', red: '#7F1D1D', purple: '#3F3F46', pink: '#831843',
};

function resolveTextColor(value: unknown, opts: HtmlOptions): string | undefined {
  if (!value || value === 'default') return undefined;
  const v = String(value);
  if (v.startsWith('#') || v.startsWith('rgb')) return v;
  if (v === 'primary') return opts.primaryColor;
  return (opts.dark ? textColorDark : textColorLight)[v];
}

function resolveBgColor(value: unknown, opts: HtmlOptions): string | undefined {
  if (!value || value === 'default') return undefined;
  if (value === true) return opts.dark ? bgColorDark.gray : bgColorLight.gray;
  const v = String(value);
  if (v.startsWith('#') || v.startsWith('rgb')) return v;
  return (opts.dark ? bgColorDark : bgColorLight)[v];
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineToHtml(
  node: BlockNoteInline | null | undefined,
  opts: HtmlOptions,
  isHeading = false,
): string {
  if (!node) return '';
  const type = node.type;

  if (type === 'math') {
    const latex = String(node.props?.latex ?? '');
    if (!latex) return '';
    return node.props?.display ? `$$${esc(latex)}$$` : `$${esc(latex)}$`;
  }

  if (type === 'link') {
    const href = node.props?.href || node.props?.url || '';
    const inner = Array.isArray(node.content)
      ? node.content.map((c) => inlineToHtml(c, opts, isHeading)).join('')
      : esc(node.text || String(href));
    return href ? `<a href="${esc(String(href))}">${inner || esc(String(href))}</a>` : inner;
  }

  if (type === 'timestamp') {
    const time = node.props?.time || '';
    return time ? esc(`[Watch: ${time}]`) : '';
  }

  if (type === 'pdfReference') {
    const { page, startLine, endLine } = node.props || {};
    if (page && startLine && endLine) {
      return esc(startLine === endLine ? `[Page ${page}, Line ${startLine}]` : `[Page ${page}, Lines ${startLine}-${endLine}]`);
    }
    return '';
  }

  if (type === 'text' || (!type && node.text != null)) {
    const s = node.styles || {};
    const raw = node.text || '';
    let html = esc(s.code ? raw : stripBareNumberMath(raw));
    if (!html) return '';
    if (s.code) return `<code>${html}</code>`;
    const isBold = !!s.bold;
    if (isBold) html = `<strong>${html}</strong>`;
    if (s.italic) html = `<em>${html}</em>`;
    if (s.underline || (s as any).underlined) html = `<u>${html}</u>`;
    if (s.strike || (s as any).strikethrough) html = `<s>${html}</s>`;
    let color = resolveTextColor((s as any).textColor ?? (s as any).color, opts);
    let bg = resolveBgColor((s as any).backgroundColor ?? (s as any).background ?? (s as any).highlight, opts);
    if (!bg && (s as any).revisionMark) {
      bg = opts.dark ? 'rgba(250, 204, 21, 0.28)' : 'rgba(250, 204, 21, 0.45)';
    }

    if (isBold && !isHeading && !color) color = opts.dark ? '#8FB39C' : '#3F6B4F';
    if (color || bg) {
      const parts: string[] = [];
      if (color) parts.push(`color:${color}`);
      if (bg) parts.push(`background-color:${bg};border-radius:3px;padding:0 3px`);
      html = `<span style="${parts.join(';')}">${html}</span>`;
    }
    return html;
  }

  if (Array.isArray(node.content)) return node.content.map((c) => inlineToHtml(c, opts, isHeading)).join('');
  if (node.text) return esc(stripBareNumberMath(node.text));
  return '';
}

function inlinesToHtml(
  content: BlockNoteInline[] | undefined,
  opts: HtmlOptions,
  isHeading = false,
): string {
  if (!Array.isArray(content) || content.length === 0) return '';
  return content.map((c) => inlineToHtml(c, opts, isHeading)).join('');
}

function listTag(block: BlockNoteBlock): 'ul' | 'ol' | null {
  switch (block.type) {
    case 'bulletListItem':
    case 'toggleListItem':
    case 'checkListItem':
      return 'ul';
    case 'numberedListItem':
      return 'ol';
    default:
      return null;
  }
}

function listItemToHtml(block: BlockNoteBlock, opts: HtmlOptions): string {
  const inner = inlinesToHtml(block.content, opts);
  const children = Array.isArray(block.children) && block.children.length
    ? renderBlocks(block.children, opts)
    : '';
  if (block.type === 'checkListItem') {
    const checked = block.props?.checked ? 'checked' : '';
    return `<li class="check"><input type="checkbox" disabled ${checked}/><span>${inner}</span>${children}</li>`;
  }
  return `<li>${inner}${children}</li>`;
}

function getTableRowsInline(block: BlockNoteBlock): BlockNoteInline[][][] {
  const anyTable = block as any;
  const c = anyTable.content;
  if (c && !Array.isArray(c) && Array.isArray(c.rows)) {
    return c.rows.map((row: any) =>
      Array.isArray(row?.cells)
        ? row.cells.map((cell: any) => {
          if (cell && cell.type === 'tableCell' && Array.isArray(cell.content)) return cell.content;
          if (Array.isArray(cell)) return cell;
          if (typeof cell === 'string') return [{ type: 'text', text: cell }];
          return cell?.content || [];
        })
        : [],
    );
  }
  return [];
}

function tableToHtml(block: BlockNoteBlock, opts: HtmlOptions): string {
  const rows = getTableRowsInline(block);
  if (!rows.length) return '';
  const columns = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const tableContent = (block as any).content;
  const hasHeader =
    (typeof tableContent?.headerRows === 'number' && tableContent.headerRows >= 1) ||
    block.props?.hasHeaderRow === true ||
    block.props?.withHeaderRow === true ||
    block.props?.headerRow === true ||
    rows.length > 1;

  let html = '<div class="table-wrap"><table>';
  rows.forEach((cells, ri) => {
    const isHeader = hasHeader && ri === 0;
    const cellTag = isHeader ? 'th' : 'td';
    const thStyle = isHeader
      ? ' style="background:rgba(24,24,27,0.04);color:#18181b;font-weight:600;padding:8px 12px;border:1px solid rgba(24,24,27,0.1);"'
      : ' style="padding:8px 12px;border:1px solid rgba(24,24,27,0.08);"';
    html += '<tr>';
    for (let i = 0; i < columns; i++) {
      html += `<${cellTag}${thStyle}>${inlinesToHtml(cells[i], opts)}</${cellTag}>`;
    }
    html += '</tr>';
  });
  html += '</table></div>';
  return html;
}

function blockToHtml(block: BlockNoteBlock, opts: HtmlOptions): string {
  const inner = inlinesToHtml(block.content, opts);
  const children =
    Array.isArray(block.children) && block.children.length ? renderBlocks(block.children, opts) : '';

  switch (block.type) {
    case 'heading': {
      const raw = Number(block.props?.level);
      const level = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 6) : 1;
      const headingInner = inlinesToHtml(block.content, opts, true);
      return `<h${level}>${headingInner}</h${level}>${children}`;
    }
    case 'paragraph':
      return `<p>${inner || '&nbsp;'}</p>${children}`;
    case 'quote':
    case 'blockquote':
      return `<blockquote style="border:1px solid rgba(90,138,106,0.22);padding:8px 12px;margin:4px 0 8px;background:rgba(90,138,106,0.06);border-radius:8px;font-style:normal;box-sizing:border-box;">${inner}</blockquote>${children}`;
    case 'codeBlock':
      return `<pre><code>${inner}</code></pre>`;
    case 'image': {
      const url = String(block.props?.url || block.props?.src || '').trim();
      if (!url) return '';
      const caption = block.props?.caption ? esc(String(block.props.caption)) : '';
      const abs =
        url.startsWith('data:') ? url : toAbsoluteApiUrl(url);
      const img = `<img src="${esc(abs)}" alt="${caption}" style="max-width:100%;height:auto;border-radius:8px;margin:12px 0;" />`;
      return caption
        ? `<figure style="margin:12px 0;">${img}<figcaption style="font-size:12px;opacity:0.75;margin-top:4px;">${caption}</figcaption></figure>`
        : img;
    }
    case 'divider':
    case 'horizontalRule':
      return '<hr/>';
    case 'table':
      return tableToHtml(block, opts);
    case 'processFlow':
    case 'contextualHierarchy':
    case 'comparisonTable': {
      const title = block.props?.title ? esc(String(block.props.title)) : 'Visual';
      return `<blockquote>${title}</blockquote>`;
    }
    default:
      return inner ? `<p>${inner}</p>${children}` : children;
  }
}

function renderBlocks(blocks: BlockNoteBlock[], opts: HtmlOptions): string {
  let html = '';
  let i = 0;
  while (i < blocks.length) {
    const tag = listTag(blocks[i]);
    if (tag) {
      let items = '';
      while (i < blocks.length && listTag(blocks[i]) === tag) {
        items += listItemToHtml(blocks[i], opts);
        i++;
      }
      html += `<${tag}>${items}</${tag}>`;
    } else {
      html += blockToHtml(blocks[i], opts);
      i++;
    }
  }
  return html;
}

export function blocksToHtml(blocks: BlockNoteBlock[], opts: HtmlOptions): string {
  if (!Array.isArray(blocks) || blocks.length === 0) return '';
  return renderBlocks(expandGlossaryMarkersInBlocks(blocks), opts);
}
