const PDF_FONT_DESCRIPTORS = [
  { fileName: 'Outfit-Regular.ttf', family: 'Outfit', weight: '400', style: 'normal' },
  { fileName: 'Outfit-SemiBold.ttf', family: 'Outfit', weight: '600', style: 'normal' },
  { fileName: 'Outfit-Bold.ttf', family: 'Outfit', weight: '700', style: 'normal' },
  { fileName: 'Outfit-ExtraBold.ttf', family: 'Outfit', weight: '800', style: 'normal' },
  // Script coverage for exported PDFs only (not loaded on the website).
  { fileName: 'NotoSans-Regular.ttf', family: 'Noto Sans', weight: '400', style: 'normal' },
  { fileName: 'NotoSans-Bold.ttf', family: 'Noto Sans', weight: '700', style: 'normal' },
  { fileName: 'NotoSansMono-Regular.ttf', family: 'Noto Sans Mono', weight: '400', style: 'normal' },
  { fileName: 'NotoSansMono-Bold.ttf', family: 'Noto Sans Mono', weight: '700', style: 'normal' },
  { fileName: 'NotoSansSymbols-Regular.ttf', family: 'Noto Sans Symbols', weight: '400', style: 'normal' },
  { fileName: 'NotoSansDevanagari-Regular.ttf', family: 'Noto Sans Devanagari', weight: '400', style: 'normal' },
  { fileName: 'NotoSansArabic-Regular.ttf', family: 'Noto Sans Arabic', weight: '400', style: 'normal' },
  { fileName: 'NotoSansHebrew-Regular.ttf', family: 'Noto Sans Hebrew', weight: '400', style: 'normal' },
  { fileName: 'NotoSansThai-Regular.ttf', family: 'Noto Sans Thai', weight: '400', style: 'normal' },
  { fileName: 'NotoSansTamil-Regular.ttf', family: 'Noto Sans Tamil', weight: '400', style: 'normal' },
  { fileName: 'NotoSansTelugu-Regular.ttf', family: 'Noto Sans Telugu', weight: '400', style: 'normal' },
  { fileName: 'NotoSansBengali-Regular.ttf', family: 'Noto Sans Bengali', weight: '400', style: 'normal' },
  { fileName: 'NotoSansGurmukhi-Regular.ttf', family: 'Noto Sans Gurmukhi', weight: '400', style: 'normal' },
  { fileName: 'NotoSansGujarati-Regular.ttf', family: 'Noto Sans Gujarati', weight: '400', style: 'normal' },
  { fileName: 'NotoSansKannada-Regular.ttf', family: 'Noto Sans Kannada', weight: '400', style: 'normal' },
  { fileName: 'NotoSansMalayalam-Regular.ttf', family: 'Noto Sans Malayalam', weight: '400', style: 'normal' },
  { fileName: 'NotoSansOriya-Regular.ttf', family: 'Noto Sans Oriya', weight: '400', style: 'normal' },
  { fileName: 'NotoSansSinhala-Regular.ttf', family: 'Noto Sans Sinhala', weight: '400', style: 'normal' },
  { fileName: 'NotoSansMyanmar-Regular.ttf', family: 'Noto Sans Myanmar', weight: '400', style: 'normal' },
  { fileName: 'DroidSansFallbackFull.ttf', family: 'Droid Sans Fallback', weight: '400', style: 'normal' },
];

/** Website + notes/WebView UI: brand UI font only (Outfit). */
const NOTES_UI_BODY_FONT_STACK = '"Outfit", system-ui, sans-serif';

/**
 * PDF export body stack: Outfit first, then embedded script fonts for glyphs Outfit lacks.
 * These Noto/Droid faces are embedded into PDFs only — not loaded on the website.
 */
const NOTES_PDF_BODY_FONT_STACK = [
  '"Outfit"',
  '"Noto Sans"',
  '"Noto Sans Devanagari"',
  '"Noto Sans Arabic"',
  '"Noto Sans Hebrew"',
  '"Noto Sans Thai"',
  '"Noto Sans Tamil"',
  '"Noto Sans Telugu"',
  '"Noto Sans Bengali"',
  '"Noto Sans Gurmukhi"',
  '"Noto Sans Gujarati"',
  '"Noto Sans Kannada"',
  '"Noto Sans Malayalam"',
  '"Noto Sans Oriya"',
  '"Noto Sans Sinhala"',
  '"Noto Sans Myanmar"',
  '"Noto Sans SC"',
  '"Noto Sans JP"',
  '"Noto Sans KR"',
  '"Droid Sans Fallback"',
  '"Noto Sans Symbols"',
  'sans-serif',
].join(', ');

/** PDF code/mono: Outfit (brand) with embedded Noto Sans Mono as glyph fallback only. */
const NOTES_PDF_MONO_FONT_STACK = [
  '"Outfit"',
  '"Noto Sans Mono"',
  'sans-serif',
].join(', ');

const escapeCssUrl = (value) => String(value).replace(/["\\\n\r()]/g, (match) => {
  const escapes = {
    '"': '\\"',
    '\\': '\\\\',
    '\n': '',
    '\r': '',
    '(': '\\(',
    ')': '\\)',
  };
  return escapes[match] || match;
});

const buildEmbeddedFontCss = (resolveAssetUrl) => {
  if (typeof resolveAssetUrl !== 'function') return '';

  return PDF_FONT_DESCRIPTORS.map((descriptor) => {
    const assetUrl = resolveAssetUrl(descriptor);
    if (!assetUrl) return '';

    return `
@font-face {
  font-family: '${descriptor.family}';
  src: url("${escapeCssUrl(assetUrl)}") format('truetype');
  font-style: ${descriptor.style};
  font-weight: ${descriptor.weight};
  font-display: swap;
}`;
  }).join('\n');
};

export {
  PDF_FONT_DESCRIPTORS,
  NOTES_PDF_BODY_FONT_STACK,
  NOTES_UI_BODY_FONT_STACK,
  NOTES_PDF_MONO_FONT_STACK,
  buildEmbeddedFontCss,
};
