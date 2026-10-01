export const CONTENT_PREFIX = '<!--fc:v1-->';

export type OcclusionRegion = {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
};

export type ContentBlock =
  | { t: 'md'; c: string }
  | { t: 'html'; c: string }
  | { t: 'occ'; src: string; regions: OcclusionRegion[]; reveal?: boolean }
  | { t: 'cloze'; answers: string[] };

export type StructuredContent = {
  v: number;
  blocks: ContentBlock[];
};

const CLOZE_BLANK_ATTR_RE = /fc-blank|data-fc-blank/i;

export function isStructuredContent(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(CONTENT_PREFIX);
}

export function parseCardContent(value: string | null | undefined): StructuredContent | null {
  if (!value || typeof value !== 'string') return null;
  if (!isStructuredContent(value)) return null;
  try {
    const parsed = JSON.parse(value.slice(CONTENT_PREFIX.length)) as StructuredContent;
    if (!parsed || !Array.isArray(parsed.blocks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function htmlHasClozeBlanks(html: string | null | undefined): boolean {
  return Boolean(html && CLOZE_BLANK_ATTR_RE.test(html));
}

export function contentHasClozeBlanks(value: string | null | undefined): boolean {
  if (!value) return false;
  if (htmlHasClozeBlanks(value)) return true;
  const structured = parseCardContent(value);
  return Boolean(structured?.blocks?.some((b) => b.t === 'html' && htmlHasClozeBlanks(b.c)));
}

export function extractClozeAnswers(value: string | null | undefined): string[] {
  if (!value) return [];
  const structured = parseCardContent(value);
  const sources = structured?.blocks?.length
    ? structured.blocks.filter((b) => b.t === 'html').map((b) => b.c || '')
    : htmlHasClozeBlanks(value)
      ? [value]
      : [];
  const answers: string[] = [];
  for (const source of sources) {
    if (!htmlHasClozeBlanks(source)) continue;
    const matches = source.matchAll(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi);
    for (const match of matches) {
      if (!CLOZE_BLANK_ATTR_RE.test(match[1] || '')) continue;
      const text = stripHtml(match[2] || '').replace(/\s+/g, ' ').trim();
      if (text) answers.push(text);
    }
  }
  return answers;
}

export function isClozeAnswersOnlyContent(value: string | null | undefined, front = ''): boolean {
  if (!value?.trim()) return true;
  const structured = parseCardContent(value);
  if (structured?.blocks?.length) {
    const onlyClozeMeta = structured.blocks.every((block) => {
      if (block.t === 'cloze') return true;
      if (block.t === 'html') return isEmptyHtmlChunk(block.c);
      if (block.t === 'md') return !(block.c || '').trim();
      if (block.t === 'occ') return false;
      return !(block.c || '').trim();
    });
    if (onlyClozeMeta) return true;
  }
  const clozeAnswers = extractClozeAnswers(front);
  if (!clozeAnswers.length) return false;
  const plain = cardContentToPlainText(value, Number.POSITIVE_INFINITY);
  const answersJoined = clozeAnswers.join(' · ');
  return plain === answersJoined || (clozeAnswers.length === 1 && plain === clozeAnswers[0]);
}

export function resolveFlashcardAnswerContent(front: string, back: string): string {
  if (contentHasClozeBlanks(front) && isClozeAnswersOnlyContent(back, front)) {
    return front || '';
  }
  return back || '';
}

export function flashcardAnswerPreviewText(front: string, back: string, maxLen = 140): string {
  if (contentHasClozeBlanks(front)) {
    const blanks = extractClozeAnswers(front);
    if (blanks.length) {
      const text = blanks.join(' · ');
      if (!Number.isFinite(maxLen) || maxLen <= 0 || text.length <= maxLen) return text;
      return `${text.slice(0, maxLen)}…`;
    }
  }
  return cardContentToPlainText(resolveFlashcardAnswerContent(front, back), maxLen);
}

export function flashcardQuestionPreviewText(value: string, maxLen = 120): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (!contentHasClozeBlanks(raw)) return cardContentToPlainText(raw, maxLen);

  const structured = parseCardContent(raw);
  const sources = structured?.blocks?.length
    ? structured.blocks.filter((b) => b.t === 'html').map((b) => b.c || '')
    : [raw];
  const parts = sources.map((html) =>
    stripHtml(
      html.replace(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi, (match, attrs) => {
        if (!CLOZE_BLANK_ATTR_RE.test(attrs)) return match;
        return ' ______ ';
      })
    )
  );
  const plain = parts.filter(Boolean).join(' · ');
  if (!Number.isFinite(maxLen) || maxLen <= 0 || plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen)}…`;
}

export function transformClozeHtml(html: string, { reveal = false }: { reveal?: boolean } = {}): string {
  if (!html || !htmlHasClozeBlanks(html)) return html || '';
  return html.replace(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi, (match, attrs: string, inner: string) => {
    if (!CLOZE_BLANK_ATTR_RE.test(attrs)) return match;
    if (reveal) {
      const cleanedAttrs = attrs.replace(/\sclass=(["'])(.*?)\1/i, (_m, q, cls) => {
        const next = `${cls} fc-blank--revealed`.replace(/\s+/g, ' ').trim();
        return ` class=${q}${next}${q}`;
      });
      const withClass = /class=/i.test(cleanedAttrs)
        ? cleanedAttrs
        : `${cleanedAttrs} class="fc-blank fc-blank--revealed"`;
      return `<span${withClass}>${inner}</span>`;
    }
    return ' ______ ';
  });
}

export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

function imageSrcMatches(attrSrc: string, targetSrc: string): boolean {
  if (!attrSrc || !targetSrc) return false;
  if (attrSrc === targetSrc) return true;
  return attrSrc.includes(targetSrc) || targetSrc.includes(attrSrc);
}

const IMG_TAG_REGEX = /<img\b[^>]*>/gi;

function extractSrcFromImgTag(tag: string): string | null {
  const match = tag.match(/src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

type ImageTagMatch = { tag: string; index: number };

function findMatchingImageTag(html: string, imageSrc: string): ImageTagMatch | null {
  if (!html || !imageSrc) return null;
  const regex = new RegExp(IMG_TAG_REGEX.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const tag = match[0];
    const src = extractSrcFromImgTag(tag);
    if (src && imageSrcMatches(src, imageSrc)) {
      return { tag, index: match.index };
    }
  }
  return null;
}

export function htmlContainsImageSrc(html: string, src: string): boolean {
  if (!html || !src) return false;
  if (html.includes(src)) return true;
  return extractImageSrcs(html).some((s) => imageSrcMatches(s, src));
}

export function extractImageSrcs(html: string): string[] {
  if (!html) return [];
  const matches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
  return matches.map((m) => m[1]);
}

export function isEmptyHtmlChunk(html: string): boolean {
  if (!html?.trim()) return true;
  const text = stripHtml(html);
  const hasImg = /<img\b/i.test(html);
  return !text && !hasImg;
}

export function splitHtmlAroundImage(html: string, imageSrc: string): { before: string; after: string } {
  if (!html || !imageSrc) return { before: html || '', after: '' };
  const found = findMatchingImageTag(html, imageSrc);
  if (!found) return { before: html, after: '' };
  return {
    before: html.slice(0, found.index).trim(),
    after: html.slice(found.index + found.tag.length).trim(),
  };
}

export function htmlWithoutImage(html: string, imageSrc: string): string {
  if (!html || !imageSrc) return html || '';
  const regex = new RegExp(IMG_TAG_REGEX.source, 'gi');
  return html
    .replace(regex, (tag) => {
      const src = extractSrcFromImgTag(tag);
      return src && imageSrcMatches(src, imageSrc) ? '' : tag;
    })
    .trim();
}

export type RenderPart = { type: 'html'; html: string } | { type: 'occ' };

export function buildInterleavedRenderParts(html: string, imageSrc: string): RenderPart[] {
  if (!html || !imageSrc) return [{ type: 'html', html }];

  const found = findMatchingImageTag(html, imageSrc);
  if (!found) {
    const parts: RenderPart[] = [];
    const textHtml = htmlWithoutImage(html, imageSrc);
    if (!isEmptyHtmlChunk(textHtml)) parts.push({ type: 'html', html: textHtml });
    parts.push({ type: 'occ' });
    return parts;
  }

  const parts: RenderPart[] = [];
  const before = html.slice(0, found.index).trim();
  const after = html.slice(found.index + found.tag.length).trim();
  if (!isEmptyHtmlChunk(before)) parts.push({ type: 'html', html: before });
  parts.push({ type: 'occ' });
  if (!isEmptyHtmlChunk(after)) parts.push({ type: 'html', html: after });
  return parts;
}

export function legacyFlashcardDisplayText(
  value: string | null | undefined,
  maxLen = Number.POSITIVE_INFINITY
): string {
  return cardContentToPlainText(value, maxLen);
}

export function cardContentToPlainText(value: string | null | undefined, maxLen = 120): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  const structured = parseCardContent(raw);
  if (!structured) {
    if (isStructuredContent(raw)) {
      return truncate(stripHtml(raw.slice(CONTENT_PREFIX.length)), maxLen);
    }
    return truncate(raw, maxLen);
  }
  const parts = structured.blocks.map((block) => {
    if (block.t === 'occ') {
      return block.regions?.map((r) => r.label).filter(Boolean).join(', ') || '[Image]';
    }
    if (block.t === 'cloze') return (block.answers || []).filter(Boolean).join(' · ');
    if (block.t === 'html') return stripHtml(block.c);
    return block.c || '';
  });
  return truncate(parts.filter(Boolean).join(' · '), maxLen);
}

function truncate(text: string, maxLen: number): string {
  if (!text) return '';
  if (!Number.isFinite(maxLen) || maxLen <= 0 || text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}
