export function flattenInlineContent(item) {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return '';

  if (item.type === 'text' && item.text) {
    return String(item.text);
  }
  if (item.text) {
    return String(item.text);
  }

  if (item.type === 'link' && Array.isArray(item.content)) {
    return item.content.map((child) => flattenInlineContent(child)).join('');
  }

  if (item.type === 'math' && item.props?.latex) {
    return String(item.props.latex);
  }

  if (Array.isArray(item.content)) {
    return item.content.map((child) => flattenInlineContent(child)).join('');
  }
  if (item.content && typeof item.content === 'object' && Array.isArray(item.content.rows)) {
    return flattenTableContent(item.content);
  }
  return '';
}

function flattenTableContent(tableContent) {
  const rows = tableContent?.rows;
  if (!Array.isArray(rows)) return '';

  const cellTexts = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object' || !Array.isArray(row.cells)) continue;
    for (const cell of row.cells) {
      if (Array.isArray(cell)) {
        const text = cell.map((part) => flattenInlineContent(part)).join('');
        if (text) cellTexts.push(text);
      } else if (cell && typeof cell === 'object' && Array.isArray(cell.content)) {
        const text = cell.content.map((part) => flattenInlineContent(part)).join('');
        if (text) cellTexts.push(text);
      }
    }
  }
  return cellTexts.join(' ');
}

export function flattenBlockText(block) {
  if (!block || typeof block !== 'object') return '';

  const content = block.content;
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object' && Array.isArray(content.rows)) {
    return flattenTableContent(content);
  }

  const parts = [];
  if (Array.isArray(content)) {
    for (const item of content) {
      const inlineText = flattenInlineContent(item);
      if (inlineText) {
        parts.push(inlineText);
      }
    }
  }

  const children = block.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const childText = flattenBlockText(child);
      if (childText) {
        parts.push(childText);
      }
    }
  }

  if (parts.length > 0) {
    return parts.join('');
  }

  return '';
}

export function flattenBlocksText(blocks) {
  if (!Array.isArray(blocks)) return '';
  return blocks
    .map((b) => (b && typeof b === 'object' ? flattenBlockText(b) : ''))
    .filter(Boolean)
    .join('\n');
}
