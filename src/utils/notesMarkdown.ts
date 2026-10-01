import { expandGlossaryMarkersInBlocks } from '@shared/glossaryMarkers.js';

export type BlockNoteInline = {
  type?: string;
  text?: string;
  styles?: Record<string, boolean>;
  props?: Record<string, any>;
  content?: BlockNoteInline[];
};

export type BlockNoteBlock = {
  type?: string;
  props?: Record<string, any>;
  content?: BlockNoteInline[];
  children?: BlockNoteBlock[];
};

const stripAllReferenceMarkers = (text: string): string => {
  return text
    .replace(/\[Watch:\s*\d{1,3}:\d{1,2}(?::\d{1,2})?s?\]/gi, '')
    .replace(/\[Page:?\s*\d+,\s*Lines?:?\s*\d+(?:-\d+)?\]/gi, '')
    .replace(/\[\d+\.?\d*s\]\s*/g, '')
    .replace(/\(\d+\.?\d*s(?:,\s*\d+\.?\d*s)*\)/g, '')
    .replace(/\s*\(\s*[Pp]age\s+\d+\s*\)/g, '')
    .trim();
};

const applyInlineStyles = (text: string, styles?: Record<string, boolean | string>): string => {
  if (!text) return '';
  if (!styles) return text;

  if (styles.code) {
    return `\`${text}\``;
  }

  const color = String((styles as Record<string, unknown>).textColor || '').toLowerCase();
  if (color === 'purple' || color === 'blue' || color === 'green') {
    return `[[${text}]]`;
  }

  let result = text;
  const isBold = !!styles.bold;
  const isItalic = !!styles.italic;
  if (isBold && isItalic) {
    result = `***${result}***`;
  } else {
    if (isBold) result = `**${result}**`;
    if (isItalic) result = `*${result}*`;
  }

  if (styles.strikethrough || styles.strike) {
    result = `~~${result}~~`;
  }

  const hasHighlight = !!(
    styles.backgroundColor ||
    styles.background ||
    styles.highlight ||
    (styles as Record<string, unknown>).revisionMark
  );
  if (hasHighlight) {
    result = `==${result}==`;
  }

  return result;
};

const inlineToMarkdown = (inline: BlockNoteInline | null | undefined): string => {
  if (!inline) return '';

  if (inline.type === 'text') {
    return applyInlineStyles(inline.text || '', inline.styles);
  }

  if (inline.type === 'math' || inline.type === 'inlineMath') {
    const latex = inline.props?.latex ?? '';
    if (!latex) return '';
    return inline.props?.display ? `$$${latex}$$` : `$${latex}$`;
  }

  if (inline.type === 'timestamp') {
    const time = inline.props?.time || '';
    return time ? `[Watch: ${time}]` : '';
  }

  if (inline.type === 'pdfReference') {
    const page = inline.props?.page;
    const startLine = inline.props?.startLine;
    const endLine = inline.props?.endLine;
    if (page && startLine && endLine) {
      if (startLine === endLine) {
        return `[Page: ${page}, Line: ${startLine}]`;
      }
      return `[Page: ${page}, Lines: ${startLine}-${endLine}]`;
    }
    return '';
  }

  if (inline.type === 'link') {
    const href = inline.props?.href || inline.props?.url;
    const linkText = inline.content?.map(inlineToMarkdown).join('') || inline.text || href || '';
    if (href) {
      return `[${linkText || href}](${href})`;
    }
    return linkText;
  }

  if (inline.text) return inline.text;

  if (Array.isArray(inline.content)) {
    return inline.content.map(inlineToMarkdown).join('');
  }

  return '';
};

const inlineContentToMarkdown = (content?: BlockNoteInline[]): string => {
  if (!Array.isArray(content) || content.length === 0) return '';
  return content.map(inlineToMarkdown).join('');
};

const isListBlock = (block: BlockNoteBlock | null | undefined): boolean => {
  return !!block && (
    block.type === 'bulletListItem' ||
    block.type === 'numberedListItem' ||
    block.type === 'checkListItem' ||
    block.type === 'toggleListItem'
  );
};

const escapeTableCell = (value: string): string => {
  return value.replace(/\|/g, '\\|').replace(/\n/g, '<br/>');
};

const extractInlineFromBlock = (block: BlockNoteBlock | null | undefined): string => {
  if (!block) return '';
  const inline = inlineContentToMarkdown(block.content).trim();
  if (inline) return inline;

  const children = Array.isArray(block.children) ? block.children : [];
  if (children.length === 0) return '';
  return children
    .map((child) => extractInlineFromBlock(child))
    .filter(Boolean)
    .join('<br/>');
};

const getTableRows = (tableBlock: BlockNoteBlock): string[][] => {

  const anyTable = tableBlock as any;
  if (anyTable.content && !Array.isArray(anyTable.content) && Array.isArray(anyTable.content.rows)) {
    return anyTable.content.rows
      .map((row: any) => {
        if (Array.isArray(row?.cells)) {
          return row.cells.map((cell: any) => {

            if (cell && cell.type === 'tableCell' && Array.isArray(cell.content)) {
              return escapeTableCell(cell.content.map(inlineToMarkdown).join('').trim());
            }
            if (Array.isArray(cell)) {
              return escapeTableCell(cell.map(inlineToMarkdown).join('').trim());
            }
            return escapeTableCell(typeof cell === 'string' ? cell : (cell?.text || ''));
          }).filter((cell: string) => cell.length > 0);
        }
        return [];
      })
      .filter((row: string[]) => row.length > 0);
  }

  const rowBlocks = Array.isArray(tableBlock.content)
    ? (tableBlock.content as unknown as BlockNoteBlock[])
    : Array.isArray(tableBlock.children)
      ? tableBlock.children
      : [];

  return rowBlocks
    .map((row) => {
      const cellBlocks = Array.isArray(row.content)
        ? (row.content as unknown as BlockNoteBlock[])
        : Array.isArray(row.children)
          ? row.children
          : [];

      return cellBlocks
        .map((cell) => escapeTableCell(extractInlineFromBlock(cell).trim()))
        .filter((cell) => cell.length > 0);
    })
    .filter((row) => row.length > 0);
};

const buildMarkdownTable = (rows: string[][], hasHeader: boolean): string => {
  if (rows.length === 0) return '';
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const normalizeRow = (row: string[]) => {
    const normalized = row.slice(0, columnCount);
    while (normalized.length < columnCount) normalized.push('');
    return normalized;
  };

  const normalizedRows = rows.map(normalizeRow);
  const headerRow = hasHeader ? normalizedRows[0] : new Array(columnCount).fill('');
  const bodyRows = hasHeader ? normalizedRows.slice(1) : normalizedRows;

  const headerLine = `| ${headerRow.join(' | ')} |`;
  const separatorLine = `| ${new Array(columnCount).fill('---').join(' | ')} |`;
  const bodyLines = bodyRows.map((row) => `| ${row.join(' | ')} |`);

  return [headerLine, separatorLine, ...bodyLines].join('\n');
};

const blockToMarkdown = (block: BlockNoteBlock | null | undefined, depth: number = 0): string => {
  if (!block) return '';
  const indent = '  '.repeat(Math.max(0, depth));
  const inlineText = inlineContentToMarkdown(block.content).trim();

  let line = '';
  let skipChildren = false;

  switch (block.type) {
    case 'heading': {
      const levelRaw = Number(block.props?.level);
      const level = Number.isFinite(levelRaw) ? Math.min(Math.max(levelRaw, 1), 6) : 1;
      const hashes = '#'.repeat(level);
      line = inlineText ? `${hashes} ${inlineText}` : `${hashes}`;
      break;
    }
    case 'paragraph':
      line = inlineText;
      break;
    case 'bulletListItem':
      line = `${indent}- ${inlineText}`;
      break;
    case 'numberedListItem':
      line = `${indent}1. ${inlineText}`;
      break;
    case 'checkListItem': {
      const checked = !!block.props?.checked;
      line = `${indent}- [${checked ? 'x' : ' '}] ${inlineText}`;
      break;
    }
    case 'quote':
    case 'blockquote': {
      const quoteLines = inlineText ? inlineText.split('\n') : [];
      line = quoteLines.map((quoteLine) => `> ${quoteLine}`).join('\n');
      break;
    }
    case 'toggleListItem':
      line = `${indent}- ${inlineText}`;
      break;
    case 'divider':
    case 'horizontalRule':
      line = '---';
      break;
    case 'codeBlock': {
      const language = typeof block.props?.language === 'string' ? block.props.language : '';
      const code = inlineText;
      line = `\`\`\`${language}\n${code}\n\`\`\``;
      break;
    }
    case 'image': {
      const imageUrl = typeof block.props?.url === 'string' ? block.props.url : '';
      const imageCaption =
        typeof block.props?.caption === 'string' ? block.props.caption : '';
      line = imageUrl ? `![${imageCaption}](${imageUrl})` : '';
      break;
    }
    case 'table': {
      const rows = getTableRows(block);
      if (rows.length > 0) {
        const hasHeader =
          block.props?.hasHeaderRow === true ||
          block.props?.withHeaderRow === true ||
          block.props?.headerRow === true ||
          rows.length > 1;
        line = buildMarkdownTable(rows, !!hasHeader);
      }
      skipChildren = true;
      break;
    }
    case 'video': {
      const videoUrl = block.props?.url;
      const videoName = block.props?.name || block.props?.caption || 'Video';
      line = videoUrl ? `[${videoName}](${videoUrl})` : '';
      break;
    }
    case 'audio': {
      const audioUrl = block.props?.url;
      const audioName = block.props?.name || block.props?.caption || 'Audio';
      line = audioUrl ? `[${audioName}](${audioUrl})` : '';
      break;
    }
    case 'file': {
      const fileUrl = block.props?.url;
      const fileName = block.props?.name || block.props?.caption || 'File';
      line = fileUrl ? `[${fileName}](${fileUrl})` : '';
      break;
    }
    case 'processFlow':
    case 'contextualHierarchy':
    case 'comparisonTable': {
      const title = block.props?.title ? String(block.props.title).trim() : '';
      const label = title ? `Visual: ${title}` : 'Visual';
      line = `> ${label}`;
      break;
    }
    default:
      line = inlineText;
      break;
  }

  if (skipChildren) {
    return line.trimEnd();
  }

  const childBlocks = Array.isArray(block.children) ? block.children : [];
  if (childBlocks.length > 0) {
    const childDepth = isListBlock(block) ? depth + 1 : depth;
    const childMarkdown = childBlocks
      .map((child) => blockToMarkdown(child, childDepth))
      .filter(Boolean)
      .join('\n');
    if (childMarkdown) {
      line = line ? `${line}\n${childMarkdown}` : childMarkdown;
    }
  }

  return line.trimEnd();
};

const blocksToMarkdown = (blocks: BlockNoteBlock[]): string => {
  let result = '';
  let prevWasList = false;

  blocks.forEach((block) => {
    const current = blockToMarkdown(block, 0).trim();
    if (!current) return;

    const currentIsList = isListBlock(block);
    if (result) {
      result += prevWasList && currentIsList ? '\n' : '\n\n';
    }
    result += current;
    prevWasList = currentIsList;
  });

  return result;
};

const normalizeEditorBlocks = (value: unknown): BlockNoteBlock[] | null => {
  if (Array.isArray(value)) return value as BlockNoteBlock[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as BlockNoteBlock[]) : null;
    } catch {
      return null;
    }
  }
  return null;
};

export const getEditorBlocks = (summaryOrBlocks: any): BlockNoteBlock[] | null => {
  let blocks: BlockNoteBlock[] | null = null;
  if (Array.isArray(summaryOrBlocks)) {
    blocks = normalizeEditorBlocks(summaryOrBlocks);
  } else if (summaryOrBlocks && typeof summaryOrBlocks === 'object') {
    blocks = normalizeEditorBlocks(summaryOrBlocks.editor_blocks);
  }
  return blocks ? (expandGlossaryMarkersInBlocks(blocks) as BlockNoteBlock[]) : null;
};

export const streamedNoteToMarkdown = (note: { title?: string; content?: string }): string => {
  const title = note.title || 'Untitled';
  const body = stripAllReferenceMarkers(note.content || '');
  return `# ${title}\n${body}`;
};

const titleHeadingBlock = (title?: string): BlockNoteBlock => ({
  type: 'heading',
  props: { level: 1 },
  content: [{ type: 'text', text: title || 'Untitled', styles: {} }],
});

export const topicsToBlocks = (topics: any[]): BlockNoteBlock[] | null => {
  if (!Array.isArray(topics) || topics.length === 0) return null;
  const out: BlockNoteBlock[] = [];
  topics.forEach((topic) => {
    const blocks = topic?.note_blocks;
    if (Array.isArray(blocks) && blocks.length > 0) {
      out.push(titleHeadingBlock(topic.title));
      out.push(...blocks);
    }
  });
  return out.length > 0 ? out : null;
};

export const topicsToMarkdown = (topics: any[], editorBlocks: any): string => {
  const blocks = normalizeEditorBlocks(editorBlocks);
  if (blocks && blocks.length > 0) {
    const markdown = blocksToMarkdown(blocks).trim();
    if (markdown.length > 0) return markdown;
  }

  if (Array.isArray(topics) && topics.length > 0) {
    return topics
      .map((topic: any) => {
        const title = topic.title || 'Untitled';
        const noteContent = stripAllReferenceMarkers(topic.note || '');
        return `# ${title}\n${noteContent}`;
      })
      .join('\n');
  }

  return 'Notes available';
};

export type NoteSection = {
  key: string;
  markdown: string;
};

const BLOCK_CHUNK_SIZE = 12;

function splitBlocksByHeading(blocks: BlockNoteBlock[]): BlockNoteBlock[][] {
  const groups: BlockNoteBlock[][] = [];
  let current: BlockNoteBlock[] = [];
  for (const block of blocks) {
    const level = Number(block.props?.level);
    const isSectionStart = block.type === 'heading' && (level === 1 || level === 2);
    if (isSectionStart && current.length > 0) {
      groups.push(current);
      current = [block];
    } else {
      current.push(block);
    }
  }
  if (current.length > 0) groups.push(current);

  if (groups.length === 1 && groups[0].length > BLOCK_CHUNK_SIZE) {
    const chunked: BlockNoteBlock[][] = [];
    for (let i = 0; i < groups[0].length; i += BLOCK_CHUNK_SIZE) {
      chunked.push(groups[0].slice(i, i + BLOCK_CHUNK_SIZE));
    }
    return chunked;
  }
  return groups;
}

function splitMarkdownByHeading(title: string, body: string, keyPrefix: string): NoteSection[] {
  const text = stripAllReferenceMarkers(body || '').trim();
  const chunks = text.split(/(?=^#{1,2} )/m).map((part) => part.trim()).filter(Boolean);
  if (chunks.length <= 1) {
    return [{ key: keyPrefix, markdown: `# ${title}\n${text}` }];
  }
  return chunks.map((chunk, index) => ({
    key: `${keyPrefix}-${index}`,
    markdown: chunk.startsWith('#') ? chunk : `## ${title}\n${chunk}`,
  }));
}

export const notesToSections = (topics: any[], editorBlocks: any): NoteSection[] => {
  const blocks = normalizeEditorBlocks(editorBlocks);
  if (blocks && blocks.length > 0) {
    const sections = splitBlocksByHeading(blocks)
      .map((group, index) => {
        const markdown = blocksToMarkdown(group).trim();
        return markdown ? { key: `block-${index}`, markdown } : null;
      })
      .filter((section): section is NoteSection => section != null);
    if (sections.length > 0) return sections;
  }

  if (!Array.isArray(topics) || topics.length === 0) return [];

  return topics.flatMap((topic: any, index: number) =>
    splitMarkdownByHeading(
      topic.title || 'Untitled',
      topic.note || '',
      `topic-${topic.id ?? index}`
    )
  );
};
