import { hasMath, isLikelyMath } from '@shared/mathText.js';
import { NOTES_UI_BODY_FONT_STACK } from '@shared/notesPdfFonts.js';
import { OUTFIT_FONT_CSS } from './outfitFont';
import {
  KATEX_JS_SRC,
  KATEX_AUTORENDER_SRC,
  MARKDOWN_IT_SRC,
  KATEX_CSS_SRC,
} from './katexBundle';

export { hasMath };

export interface KatexHtmlOptions {
  dark?: boolean;
  fontSize?: number;
  textColor?: string;
  backgroundColor?: string;
  compact?: boolean;
  isHtml?: boolean;

  center?: boolean;

  boldColor?: string;
}

export function buildKatexHtml(markdown: string, options: KatexHtmlOptions = {}): string {
  const dark = !!options.dark;
  const isHtml = !!options.isHtml;
  const bg = options.backgroundColor || (dark ? '#1c1c1f' : '#ffffff');
  const fg = options.textColor || (dark ? '#e7e5e4' : '#1c1917');
  const fontSize = options.fontSize || 16;
  const border = dark ? '#3f3f46' : 'rgba(63, 107, 79, 0.22)';
  const headerBg = dark ? 'rgba(122, 158, 134, 0.22)' : 'rgba(24, 24, 27, 0.04)';
  const codeBg = dark ? '#26262a' : '#f3f1ec';
  const preBg = dark ? '#18181b' : '#f7f5f0';
  const quoteText = dark ? '#e7e5e4' : '#292524';
  const quoteBg = dark ? 'rgba(122, 158, 134, 0.12)' : 'rgba(63, 107, 79, 0.06)';
  const linkColor = dark ? '#9bb8a6' : '#3f6b4f';
  const bodyMargin = options.compact ? '0' : '0';

  const SENTINEL = String.fromCharCode(0xe000);
  const mathStore: { l: string; d: boolean }[] = [];
  let mdSource = markdown;
  if (!isHtml) {
    mdSource = markdown
      .replace(/\$\$([\s\S]+?)\$\$/g, (_m, latex) => {
        mathStore.push({ l: String(latex), d: true });
        return `${SENTINEL}${mathStore.length - 1}${SENTINEL}`;
      })

      .replace(/\$((?:\\.|[^$\\\n])+?)\$(?!\d)/g, (m, latex) => {
        const inner = String(latex).trim();
        if (!inner) return m;
        if (!isLikelyMath(inner)) return inner;
        mathStore.push({ l: String(latex), d: false });
        return `${SENTINEL}${mathStore.length - 1}${SENTINEL}`;
      });
  }

  const needsMath = isHtml ? hasMath(markdown) : mathStore.length > 0;
  const needsMarkdownIt = !isHtml;

  const jsStringSafe = (json: string) =>
    json.replace(/<\//g, '<\\/').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  const payload = jsStringSafe(JSON.stringify(mdSource));
  const mathJson = jsStringSafe(JSON.stringify(mathStore));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
${needsMath ? `<style>${KATEX_CSS_SRC}</style>` : ''}
<style>
${OUTFIT_FONT_CSS}
  html, body { margin: 0; padding: ${bodyMargin}; background: ${bg}; color: ${fg}; }
  body {
    font-size: ${fontSize}px;
    font-family: ${NOTES_UI_BODY_FONT_STACK};
    font-weight: 400;
    line-height: 1.72;
    letter-spacing: 0.01em;
    word-wrap: break-word;
    overflow-wrap: anywhere;
    -webkit-text-size-adjust: 100%;${options.center ? '\n    text-align: center;' : ''}
  }
  #content > *:first-child { margin-top: 0; }
  #content > *:last-child { margin-bottom: 0; }
  p { margin: 0 0 6px; padding-left: 1.25em; }
  ul, ol { margin: 4px 0 10px; padding-left: 2.5em; }
  ul ul, ol ol, ul ol, ol ul { margin: 4px 0 0; padding-left: 1.35em; }
  li { margin: 4px 0; line-height: 1.65; }
  li > ul, li > ol { margin-top: 4px; }
  strong { font-weight: 700;${options.boldColor ? ` color: ${options.boldColor};` : ''} }
  
  h1, h2, h3, h4, h5, h6 { font-weight: 800; text-align: left; color: ${dark ? '#fafaf9' : '#0f172a'}; }
  h1 { font-size: 1.45em; line-height: 1.28; letter-spacing: -0.02em; margin: 0 0 10px; padding-left: 0; }
  h2 { font-size: 1.22em; line-height: 1.32; letter-spacing: -0.015em; margin: 1.15em 0 0.05em; padding-left: 1.25em; }
  h3 { font-size: 1.08em; line-height: 1.38; font-weight: 800; margin: 0.85em 0 0.04em; padding-left: 2.5em; }
  h4 { font-size: 1.02em; line-height: 1.4; font-weight: 800; margin: 0.85em 0 0.04em; padding-left: 2.5em; }
  h5 { font-size: 0.98em; line-height: 1.42; font-weight: 600; color: ${dark ? '#a8a29e' : '#57534e'}; margin: 0.75em 0 0.12em; padding-left: 2.5em; }
  h6 { font-size: 0.88em; line-height: 1.45; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: ${dark ? '#a8a29e' : '#57534e'}; margin: 0.75em 0 0.12em; padding-left: 2.5em; }
  h1 + h2 { margin-top: 0.55em; }
  h3 + p, h4 + p { padding-left: 2.5em; }
  h1 strong, h2 strong, h3 strong, h4 strong, h5 strong, h6 strong { font-weight: inherit;${options.boldColor ? ' color: inherit;' : ''} }
  a { color: ${linkColor}; text-decoration: underline; text-underline-offset: 2px; text-decoration-color: ${dark ? 'rgba(155,184,166,0.45)' : 'rgba(63,107,79,0.35)'}; }
  mark { background: ${dark ? '#27272A' : '#F3F1EC'}; color: ${fg}; padding: 1px 3px; border-radius: 3px; }
  code { background: ${codeBg}; padding: 1px 5px; border-radius: 4px; font-size: 0.9em; }
  pre { background: ${preBg}; padding: 12px; border-radius: 8px; overflow-x: auto; border: 1px solid ${border}; }
  pre code { background: none; padding: 0; }
  figure { margin: 14px 0; }
  img { max-width: 100%; height: auto; border-radius: 10px; display: block; border: 1px solid ${border}; }
  figcaption { margin-top: 6px; font-size: 12px; font-style: normal; text-align: left; opacity: 0.75; color: ${dark ? '#a8a29e' : '#57534e'}; }
  blockquote {
    border: 1px solid ${dark ? 'rgba(143,179,156,0.28)' : 'rgba(90,138,106,0.22)'};
    margin: 4px 0 8px 1.25em;
    padding: 8px 12px;
    color: ${quoteText};
    background: ${quoteBg};
    border-radius: 8px;
    font-style: normal;
    box-sizing: border-box;
  }
  blockquote strong { color: ${dark ? '#9bb8a6' : '#1a2f23'}; font-weight: 700; }

  .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 8px 0; max-width: 100%; }
  .table-wrap > table { margin: 0; }
  table { border-collapse: collapse; table-layout: auto; width: auto; min-width: 100%; margin: 8px 0; font-size: 0.95em; }

  th, td { border: 1px solid ${border}; padding: 6px 10px; text-align: left; vertical-align: top; white-space: normal; overflow-wrap: break-word; word-break: normal; min-width: 96px; }
  th { background: ${headerBg}; font-weight: 600; }
  .katex-display { overflow-x: auto; overflow-y: hidden; margin: 0.5em 0; padding-bottom: 2px; }
  .katex { font-size: 1.05em; }
</style>
</head>
<body>
<div id="content"></div>
${needsMarkdownIt ? `<script>${MARKDOWN_IT_SRC}</script>` : ''}
${needsMath ? `<script>${KATEX_JS_SRC}</script>` : ''}
${needsMath && isHtml ? `<script>${KATEX_AUTORENDER_SRC}</script>` : ''}
<script>
  (function () {
    var raw = ${payload};
    var MATH = ${mathJson};
    var SENT = String.fromCharCode(57344);
    var IS_HTML = ${isHtml};
    var el = document.getElementById('content');
    var lastH = -1;

    function post() {
      if (!el) return;
      var h = Math.ceil(el.getBoundingClientRect().height);
      if (h > 0 && h !== lastH) {
        lastH = h;
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(String(h));
      }
    }
    function autoRenderMath(elm) {
      try {
        if (window.renderMathInElement) {
          window.renderMathInElement(elm, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '$', right: '$', display: false }
            ],
            throwOnError: false,
            ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
          });
        }
      } catch (e) {}
    }

    function wrapTables(elm) {
      var tables = elm.getElementsByTagName('table');
      for (var i = tables.length - 1; i >= 0; i--) {
        var t = tables[i];
        var parent = t.parentNode;
        if (!parent || parent.className === 'table-wrap') continue;
        var wrap = document.createElement('div');
        wrap.className = 'table-wrap';
        parent.insertBefore(wrap, t);
        wrap.appendChild(t);
      }
    }
    function render() {
      try {
        if (IS_HTML) {
          el.innerHTML = raw;
          autoRenderMath(el);
          wrapTables(el);
        } else if (window.markdownit) {
          var md = window.markdownit({ html: false, linkify: true, breaks: true });

          md.inline.ruler.before('emphasis', 'mark', function (state, silent) {
            if (state.src.charCodeAt(state.pos) !== 0x3d || state.src.charCodeAt(state.pos + 1) !== 0x3d) return false;
            var start = state.pos + 2;
            var end = state.src.indexOf('==', start);
            if (end === -1 || end === start) return false;
            if (silent) return true;
            var open = state.push('mark_open', 'mark', 1);
            open.markup = '==';
            var textTok = state.push('text', '', 0);
            textTok.content = state.src.slice(start, end);
            var close = state.push('mark_close', 'mark', -1);
            close.markup = '==';
            state.pos = end + 2;
            return true;
          });
          var out = md.render(raw);
          if (window.katex && MATH.length) {
            out = out.replace(new RegExp(SENT + '([0-9]+)' + SENT, 'g'), function (_, i) {
              var b = MATH[+i];
              if (!b) return '';
              try {
                return window.katex.renderToString(String(b.l).trim(), { displayMode: !!b.d, throwOnError: false });
              } catch (e) {
                return (b.d ? '$$' : '$') + b.l + (b.d ? '$$' : '$');
              }
            });
          }
          el.innerHTML = out;
          wrapTables(el);
        } else {
          el.textContent = raw;
        }
      } catch (e) { el.textContent = raw; }
      post();

      if (window.ResizeObserver) { try { new ResizeObserver(post).observe(el); } catch (e) {} }
      var imgs = el.getElementsByTagName('img');
      for (var i = 0; i < imgs.length; i++) {
        if (!imgs[i].complete) { imgs[i].addEventListener('load', post); imgs[i].addEventListener('error', post); }
      }
      setTimeout(post, 300);
      setTimeout(post, 900);
    }
    if (document.readyState !== 'loading') render();
    else document.addEventListener('DOMContentLoaded', render);
    window.addEventListener('load', post);
  })();
</script>
</body>
</html>`;
}
