export function generateNotesPdfStyles(BRAND, NOTES_PDF_BODY_FONT_STACK, NOTES_PDF_MONO_FONT_STACK, pdfPageLayout) {
  return `
    :root {
      color-scheme: light;
      --dw-pdf-margin-x-pt: ${pdfPageLayout.marginXPt};
      --dw-pdf-top-band-pt: ${pdfPageLayout.topContentBandPt};
      --dw-pdf-bottom-band-pt: ${pdfPageLayout.bottomContentBandPt};
    }

@page {
  size: A4;
  margin: 0;
}

* {
  box-sizing: border-box;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

html {
  /* Match .bn-editor root (1rem = 16px) so rem type scale equals preview. */
  font-size: 16px;
  background: #ffffff !important;
}


body.dw-pdf--server {
  margin: 0;
  padding: 0;
  background: #ffffff !important;
  color: ${BRAND.text};
  font-family: ${NOTES_PDF_BODY_FONT_STACK};
  font-size: 1rem;
  line-height: 1.7;
  letter-spacing: -0.005em;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body.dw-pdf--server main.sn-content {
  background: #ffffff !important;
}

body.dw-pdf--server .sn-visual-svg svg,
body.dw-pdf--server .sn-image {
  max-width: 100%;
  max-height: 520px;
  height: auto;
  object-fit: contain;
}

body.dw-pdf--client {
  margin: 0;
  padding: 40px 40px 40px 40px;
  background: #ffffff;
  color: ${BRAND.text};
  font-family: ${NOTES_PDF_BODY_FONT_STACK};
  font-size: 1rem;
  line-height: 1.7;
  letter-spacing: -0.005em;
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  color: inherit;
}

img {
  max-width: 100%;
}

.sn-doc {
  position: relative;
  min-height: 100%;
}

.sn-content {
  --dw-note-tab: 1.25rem;
  color: ${BRAND.text};
}

/*
  Hierarchy mirrors StudyMaterialPage.css BlockNote preview:
  H1 flush left; H2 + body share one tab; H3+/lists take two tabs.
*/
.sn-block {
  box-sizing: border-box;
  padding-left: var(--dw-note-tab);
  margin-block: 0.06em;
}

.sn-block--h1 {
  padding-left: 0;
  margin-block: 0.1em 0.35em;
}

.sn-block--h2 {
  padding-left: var(--dw-note-tab);
  margin-block: 1.05em 0;
}

.sn-block--h1 + .sn-block--h2 {
  margin-top: 0.55em;
}

.sn-content > .sn-block:first-child.sn-block--heading {
  margin-top: 0;
}

.sn-block--h3,
.sn-block--h4,
.sn-block--h5,
.sn-block--h6 {
  padding-left: calc(2 * var(--dw-note-tab));
  margin-block: 0.85em 0;
}

.sn-block--paragraph {
  margin-block: 0 0.08em;
}

.sn-block--heading + .sn-block--paragraph {
  margin-top: 0;
}

.sn-block--heading + .sn-block--paragraph .sn-paragraph {
  padding-top: 2px;
}

.sn-block--h3 + .sn-block--paragraph,
.sn-block--h3 + .sn-block--paragraph + .sn-block--paragraph,
.sn-block--h4 + .sn-block--paragraph {
  padding-left: calc(2 * var(--dw-note-tab));
}

.sn-block--quote {
  padding-left: var(--dw-note-tab);
  margin-block: 0.2em 0.28em;
}

.sn-block--heading + .sn-block--quote {
  margin-top: 0.12em;
}

.sn-block--list {
  padding-left: calc(2 * var(--dw-note-tab));
  margin-block: 0.02em 0.04em;
}

/* Nested BlockNote children: one extra tab from the parent, not absolute level. */
.sn-block .sn-block {
  padding-left: var(--dw-note-tab) !important;
  margin-block: 0.06em;
}

.sn-list-item-body > .sn-block,
.sn-toggle-body > .sn-block,
.sn-quote > .sn-block,
.sn-markdown-block > .sn-block {
  padding-left: 0 !important;
}

.sn-list-item-body > .sn-block--list {
  padding-left: 0 !important;
}

.sn-list-item-body > .sn-block--list > .sn-list {
  padding-left: var(--dw-note-tab);
}

.sn-client-pdf-footer {
  display: none;
}

.sn-client-pdf-header {
  display: none;
}

mark.dw-pdf-highlight {
  color: inherit;
  font: inherit;
  font-weight: inherit;
  font-style: inherit;
  text-decoration: inherit;
  /* Prefer inline so highlights stay in the text run (Story also requires this). */
  display: inline;
  vertical-align: baseline;
  padding: 0.05em 0.22em;
  border-radius: 0;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

@media print {
  .dw-pdf--client .sn-client-pdf-header {
    display: flex;
    align-items: center;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    height: 32px;
    padding: 0 72px 0 40px;
    background: #ffffff;
  }

  .dw-pdf--client .sn-client-pdf-header-left {
    font-size: 9px;
    font-weight: 700;
    color: rgba(25, 56, 122, 0.55);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .dw-pdf--client .sn-client-pdf-footer {
    display: block;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    min-height: 32px;
    padding: 8px 72px 10px 40px;
    background: #ffffff;
  }

  .dw-pdf--client .sn-client-pdf-footer-page {
    position: absolute;
    right: 40px;
    bottom: 10px;
    font-size: 10px;
    font-weight: 600;
    text-transform: none;
    letter-spacing: normal;
    color: ${BRAND.muted};
  }

  .dw-pdf--client .sn-client-pdf-footer-page::before {
    content: counter(page);
  }
}

.sn-heading {
  margin: 0;
  line-height: 1.3;
  color: ${BRAND.heading};
  text-align: left;
  page-break-after: avoid;
}

.sn-math {
  display: inline-block;
}
.sn-math-inline {
  margin: 0 1px;
}
.sn-math-block {
  display: inline-block;
}
.sn-math-block-wrap {
  display: block;
  text-align: center;
  margin: 8px 0;
}

.sn-heading-1 {
  font-size: 1.85rem;
  line-height: 1.18;
  font-weight: 800;
  letter-spacing: -0.04em;
  color: ${BRAND.heading};
  margin: 0.15rem 0 0.4rem;
  padding-bottom: 0;
  border-bottom: none;
}
.sn-heading-2 {
  font-size: 1.22rem;
  line-height: 1.28;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: ${BRAND.heading};
  margin: 0;
  padding-bottom: 0;
  border-bottom: none;
}
.sn-heading-3 {
  font-size: 1.05rem;
  line-height: 1.3;
  font-weight: 800;
  letter-spacing: -0.015em;
  color: ${BRAND.headingSub || '#18181b'};
  margin: 0;
  padding-bottom: 0;
  border-bottom: none;
}
.sn-heading-4,
.sn-heading-5,
.sn-heading-6 {
  font-size: 1.02rem;
  line-height: 1.3;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: ${BRAND.headingSub || '#18181b'};
  margin: 0;
  padding-bottom: 0;
  border-bottom: none;
  text-transform: none;
}

.sn-paragraph {
  margin: 0;
  font-size: 1rem;
  line-height: 1.6;
  letter-spacing: -0.005em;
  color: ${BRAND.text};
}

.sn-link {
  color: #5A8A6A;
  text-decoration: underline;
  text-decoration-color: rgba(90, 138, 106, 0.4);
  text-underline-offset: 3px;
  font-weight: 400;
  word-break: break-word;
}

.sn-markdown-block {
  margin: 0;
  font-size: 1rem;
  line-height: 1.6;
  letter-spacing: -0.005em;
  color: ${BRAND.text};
}

.sn-markdown-block p {
  margin: 0 0 0.08em;
  font-size: 1rem;
  line-height: 1.6;
  letter-spacing: -0.005em;
  color: ${BRAND.text};
}

.sn-markdown-block h1,
.sn-markdown-block h2,
.sn-markdown-block h3,
.sn-markdown-block h4,
.sn-markdown-block h5,
.sn-markdown-block h6 {
  color: ${BRAND.heading};
  text-align: left;
  page-break-after: avoid;
  border-bottom: none;
  padding-bottom: 0;
}

.sn-markdown-block h1 {
  font-size: 1.85rem;
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.18;
  margin: 0.15rem 0 0.4rem;
}
.sn-markdown-block h2 {
  font-size: 1.22rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  line-height: 1.28;
  margin: 1.05em 0 0;
}
.sn-markdown-block h3 {
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.015em;
  line-height: 1.3;
  color: ${BRAND.headingSub || '#18181b'};
  margin: 0.85em 0 0;
}
.sn-markdown-block h4,
.sn-markdown-block h5,
.sn-markdown-block h6 {
  font-size: 1.02rem;
  font-weight: 800;
  line-height: 1.3;
  color: ${BRAND.headingSub || '#18181b'};
  margin: 0.85em 0 0;
  text-transform: none;
  letter-spacing: -0.01em;
}

.sn-markdown-block pre {
  margin: 0 0 10px;
  padding: 10px 12px;
  overflow-x: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  border-radius: 8px;
  background-color: #f8fafc !important;
  background: #f8fafc !important;
  color: #0f172a !important;
  border: 1px solid #cbd5e1;
}

.sn-markdown-block pre code {
  color: #0f172a !important;
  background: transparent !important;
  background-color: transparent !important;
  font-family: ${NOTES_PDF_MONO_FONT_STACK};
  font-size: 12px;
}

.sn-markdown-block code {
  font-family: ${NOTES_PDF_MONO_FONT_STACK};
  font-size: 12px;
  color: #1f2a44;
}

.sn-markdown-block blockquote {
  margin: 0.2em 0 0.28em;
  padding: 8px 12px;
  border: 1px solid rgba(90, 138, 106, 0.22);
  border-radius: 8px;
  background: ${BRAND.quoteBg};
  color: #292524;
  font-size: 1rem;
  line-height: 1.6;
  font-style: normal;
}

.sn-markdown-block ul,
.sn-markdown-block ol {
  margin: 0.02em 0 0.04em;
  padding-left: 0;
  font-size: 1rem;
  color: ${BRAND.text};
}

.sn-markdown-block ul {
  list-style: none;
}

.sn-markdown-block ol {
  list-style: decimal;
  padding-left: 1.5em;
}

.sn-markdown-block ul ul,
.sn-markdown-block ol ol,
.sn-markdown-block ul ol,
.sn-markdown-block ol ul {
  margin: 0.04em 0 0;
  padding-left: var(--dw-note-tab, 1.25rem);
}

.sn-markdown-block li {
  margin: 0 0 0.04em;
  line-height: 1.6;
}

.sn-markdown-block ul > li {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: flex-start;
  gap: 0;
}

.sn-markdown-block ul > li::before {
  content: "•";
  color: #5A8A6A;
  flex: 0 0 auto;
  min-width: 24px;
  padding-right: 4px;
  box-sizing: border-box;
}

.sn-markdown-block ul ul > li::before {
  content: "◦";
  color: #6B9B78;
}

.sn-markdown-block ul ul ul > li::before {
  content: "▪";
  color: #7A9E86;
}

.sn-markdown-block table {
  width: 100%;
  border-collapse: collapse;
  border-spacing: 0;
  margin: 0 0 13px;
  font-size: 12px;
  border: none;
}

.sn-markdown-block th,
.sn-markdown-block td {
  padding: 7px 9px;
  border: 1px solid ${BRAND.border};
  vertical-align: top;
  text-align: left;
}

.sn-markdown-block th {
  background: ${BRAND.headerBg || BRAND.surfaceAlt};
  font-weight: 700;
  color: ${BRAND.heading};
}

.sn-markdown-block img {
  max-width: 100%;
  display: block;
  margin: 0 0 10px;
}

strong,
.sn-markdown-block strong {
  font-weight: 600;
  color: ${BRAND.text};
}

.sn-heading strong,
.sn-heading-1 strong,
.sn-heading-2 strong,
.sn-heading-3 strong,
.sn-heading-4 strong,
.sn-heading-5 strong,
.sn-heading-6 strong,
.sn-markdown-block h1 strong,
.sn-markdown-block h2 strong,
.sn-markdown-block h3 strong,
.sn-markdown-block h4 strong,
.sn-markdown-block h5 strong,
.sn-markdown-block h6 strong {
  color: inherit;
  font-weight: inherit;
}

.sn-list,
.sn-list ul,
.sn-markdown-block ul,
.sn-markdown-block ul ul {
  list-style-type: none;
}

.sn-list ul ul,
.sn-markdown-block ul ul ul {
  list-style-type: none;
}

.sn-markdown-block em { font-style: italic; }
.sn-markdown-block del,
.sn-markdown-block s { text-decoration: line-through; }

.sn-markdown-block a {
  color: #5A8A6A;
  text-decoration: underline;
  text-decoration-color: rgba(90, 138, 106, 0.4);
  text-underline-offset: 3px;
  font-weight: 400;
  word-break: break-word;
}

.sn-markdown-block hr {
  height: 1px;
  border: 0;
  margin: 16px 0;
  background-color: rgba(208, 215, 222, 0.6);
}

.sn-inline-tag {
  display: inline-block;
  margin: 0 0.12em;
  padding: 0.14em 0.4em;
  border-radius: 999px;
  border: 1px solid ${BRAND.border};
  background: ${BRAND.surfaceAlt};
  color: ${BRAND.muted};
  font-size: 0.75rem;
  line-height: 1.4;
  vertical-align: baseline;
}

.sn-list {
  display: block;
  margin: 0;
  padding-left: 0;
  font-size: 1rem;
  line-height: 1.6;
  color: ${BRAND.text};
}

ul.sn-list:not(.sn-check-list) {
  list-style: none;
}

ol.sn-list {
  list-style: decimal;
  padding-left: 1.5em;
}

.sn-list .sn-list {
  margin: 0.04em 0 0;
  padding-left: var(--dw-note-tab, 1.25rem);
}

.sn-list-item {
  margin: 0 0 0.04em;
}

ul.sn-list:not(.sn-check-list) > .sn-list-item {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: flex-start;
  gap: 0;
}

ul.sn-list:not(.sn-check-list) > .sn-list-item::before {
  content: "•";
  color: #5A8A6A;
  flex: 0 0 auto;
  min-width: 24px;
  padding-right: 4px;
  box-sizing: border-box;
  line-height: 1.6;
}

ul.sn-list:not(.sn-check-list) .sn-list > .sn-list-item::before {
  content: "◦";
  color: #6B9B78;
}

ul.sn-list:not(.sn-check-list) .sn-list .sn-list > .sn-list-item::before {
  content: "▪";
  color: #7A9E86;
}

.sn-list-item-body {
  display: block;
  flex: 1 1 auto;
  min-width: 0;
}

.sn-check-list {
  list-style: none;
  padding-left: 0;
  display: block;
}

.sn-check-list .sn-list-item {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  clear: both;
}

.sn-check-list .sn-list-item-body {
  display: block;
  flex: 1 1 auto;
}

.sn-check-marker {
  min-width: 14px;
  margin-top: 2px;
  color: ${BRAND.primaryDark};
  font-weight: 700;
  font-size: 0.9rem;
}

.sn-quote {
  margin: 0;
  padding: 8px 12px;
  border: 1px solid rgba(90, 138, 106, 0.22);
  border-radius: 8px;
  background: ${BRAND.quoteBg};
  color: #292524;
  font-size: 1rem;
  line-height: 1.6;
  font-style: normal;
}

.sn-quote strong {
  color: #3F6B4F;
  font-style: normal;
  font-weight: 700;
}

.sn-code-block {
  margin: 0 0 12px;
  overflow: hidden;
  border-radius: 8px;
  page-break-inside: avoid;
  background: transparent !important;
  background-color: transparent !important;
  border: none;
}

.sn-code-language {
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #475569 !important;
  background-color: #e2e8f0 !important;
  background: #e2e8f0 !important;
}

.sn-code-block pre {
  margin: 0;
  padding: 10px 12px;
  overflow-x: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  border: 1px solid #cbd5e1;
  border-top: none;
  border-radius: 0 0 8px 8px;
  background-color: #f8fafc !important;
  background: #f8fafc !important;
  color: #0f172a !important;
}

.sn-code-block--solo pre {
  border-top: 1px solid #cbd5e1;
  border-radius: 8px;
}

.sn-code-block code {
  color: #0f172a !important;
  background-color: transparent !important;
  background: transparent !important;
  font-family: ${NOTES_PDF_MONO_FONT_STACK};
  font-size: 12px;
  line-height: 1.6;
}

.sn-divider {
  height: 1px;
  border: 0;
  margin: 18px 0;
  background-color: ${BRAND.divider};
}

.sn-image-shell {
  margin: 0 0 12px;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid ${BRAND.border};
  background: ${BRAND.surface};
  page-break-inside: avoid;
}

.sn-image {
  display: block;
  width: 100%;
  max-height: 280px;
  object-fit: contain;
  background: #ffffff;
}

.sn-image-shell figcaption {
  padding: 6px 10px 8px;
  text-align: center;
  font-size: 10px;
  color: ${BRAND.muted};
}

.sn-media-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0 0 10px;
  padding: 10px 12px;
  text-decoration: none;
  border: 1px solid ${BRAND.border};
  border-radius: 8px;
  background: ${BRAND.surface};
  page-break-inside: avoid;
}

.sn-media-icon {
  min-width: 44px;
  padding: 6px 5px;
  border-radius: 6px;
  background: linear-gradient(180deg, ${BRAND.primary}, ${BRAND.primaryDark});
  color: white;
  text-align: center;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.07em;
}

.sn-media-title {
  font-size: 13px;
  font-weight: 700;
  color: ${BRAND.heading};
}

.sn-media-url {
  margin-top: 3px;
  font-size: 10px;
  color: ${BRAND.muted};
  word-break: break-word;
}

.sn-note-figure {
  margin: 0 0 14px;
  page-break-inside: avoid;
}

.sn-note-image {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid ${BRAND.border};
}

.sn-note-figcaption {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.35;
  color: ${BRAND.muted};
}

.sn-table-wrap {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 0 0 12px;
  page-break-inside: avoid;
  vertical-align: top;
  box-sizing: border-box;
}

.sn-table {
  width: auto;
  max-width: 100%;
  border-collapse: collapse;
  border-spacing: 0;
  table-layout: auto;
  border: none;
  margin: 0;
}

.sn-table th,
.sn-table td {
  padding: 7px 10px;
  border: 1px solid ${BRAND.border};
  vertical-align: top;
  text-align: left;
  font-size: 12px;
  line-height: 1.55;
  white-space: normal;
  word-break: break-word;
}

.sn-table th {
  background: ${BRAND.headerBg || BRAND.surfaceAlt};
  color: ${BRAND.heading};
  font-weight: 700;
}

.sn-toggle-shell {
  margin: 0 0 10px;
  border: 1px solid ${BRAND.border};
  border-radius: 8px;
  background: #ffffff;
  page-break-inside: avoid;
}

.sn-toggle-summary {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 15px 9px;
}

.sn-toggle-glyph {
  margin-top: 3px;
  color: ${BRAND.primaryDark};
  font-size: 13px;
  font-weight: 800;
}

.sn-toggle-title {
  flex: 1;
}

.sn-toggle-title .sn-heading,
.sn-toggle-title .sn-paragraph {
  margin-bottom: 0;
  margin-top: 0;
}

.sn-toggle-body {
  padding: 0 15px 12px 34px;
  border-top: 1px solid rgba(214, 226, 250, 0.72);
}

.sn-heading-toggle .sn-toggle-summary {
  padding-top: 8px;
}

.sn-emoji-block {
  font-size: 26px;
  margin: 0 0 8px;
  line-height: 1.4;
  letter-spacing: 0.1em;
}

.sn-visual-shell {
  margin: 0 0 12px;
  overflow: hidden;
  border: 1px solid ${BRAND.border};
  border-radius: 8px;
  background: ${BRAND.surface};
  page-break-inside: avoid;
}

.sn-visual-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 11px 15px;
  border-bottom: 1px solid ${BRAND.border};
}

.sn-visual-header h4 {
  margin: 0;
  font-size: 16px;
  color: ${BRAND.heading};
  font-weight: 700;
}

.sn-visual-badge {
  padding: 3px 6px;
  border-radius: 999px;
  background: rgba(100, 149, 237, 0.12);
  color: ${BRAND.primaryDark};
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.sn-visual-body {
  padding: 15px;
}

.sn-visual-svg {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.sn-visual-svg svg {
  width: 100%;
  height: auto;
  display: block;
}

.sn-visual-empty {
  margin: 0;
  color: ${BRAND.muted};
  font-size: 12px;
}

.sn-flow-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sn-flow-step {
  display: flex;
  gap: 10px;
  align-items: stretch;
}

.sn-flow-step + .sn-flow-step {
  margin-top: 10px;
}

.sn-flow-index {
  min-width: 26px;
  height: 26px;
  border-radius: 999px;
  background: linear-gradient(180deg, ${BRAND.primary}, ${BRAND.primaryDark});
  color: white;
  font-size: 14px;
  font-weight: 800;
  line-height: 26px;
  text-align: center;
}

.sn-flow-card {
  flex: 1;
  padding: 8px 10px;
  border-radius: 6px;
  background: #ffffff;
  border: 1px solid ${BRAND.border};
}

.sn-flow-label {
  font-size: 14px;
  font-weight: 700;
  color: ${BRAND.heading};
}

.sn-flow-meta {
  margin-top: 3px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: ${BRAND.primaryDark};
}

.sn-flow-desc {
  margin: 5px 0 0;
  font-size: 12px;
  color: ${BRAND.text};
}

.sn-hierarchy-root,
.sn-hierarchy-node {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid ${BRAND.border};
  background: #ffffff;
}

.sn-hierarchy-root {
  margin-bottom: 8px;
  background: linear-gradient(180deg, rgba(100, 149, 237, 0.14), rgba(255, 255, 255, 1));
}

.sn-hierarchy-label {
  font-size: 14px;
  font-weight: 700;
  color: ${BRAND.heading};
}

.sn-hierarchy-desc {
  margin-top: 4px;
  font-size: 12px;
  color: ${BRAND.muted};
}

.sn-hierarchy-list {
  margin: 7px 0 0 14px;
  padding-left: 12px;
}

.sn-hierarchy-list > li {
  margin: 0 0 7px;
}
  `;
}
