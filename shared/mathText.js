const inlineMathRe = () => /\$((?:\\.|[^$\\\n])+?)\$(?!\d)/g;
const displayMathRe = () => /\$\$([\s\S]+?)\$\$/g;

const BARE_NUMBER_RE = /^[\d.,]+$/;

export function isBareNumber(latex) {
  const t = (latex || "").trim();
  return t.length > 0 && BARE_NUMBER_RE.test(t);
}

export function isLikelyMath(latex) {
  const t = (latex || "").trim();
  if (!t) return false;
  return !BARE_NUMBER_RE.test(t);
}

function unwrapBareNumbers(chunk) {
  return chunk.replace(inlineMathRe(), (match, latex) =>
    isBareNumber(latex) ? latex.trim() : match
  );
}

export function stripBareNumberMath(text) {
  if (!text || typeof text !== "string" || !text.includes("$")) return text;

  const out = [];
  const display = displayMathRe();
  let last = 0;
  let match;
  while ((match = display.exec(text)) !== null) {
    out.push(unwrapBareNumbers(text.slice(last, match.index)), match[0]);
    last = match.index + match[0].length;
  }
  out.push(unwrapBareNumbers(text.slice(last)));
  return out.join("");
}

export function hasMath(text) {
  if (!text || typeof text !== "string") return false;
  if (displayMathRe().test(text)) return true;

  const inline = inlineMathRe();
  let match;
  while ((match = inline.exec(text)) !== null) {
    if (isLikelyMath(match[1])) return true;
  }
  return false;
}
