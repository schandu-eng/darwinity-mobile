const STORAGE_PREFIX = 'dw.games.typingRush.best.';

export function highlightSetFingerprint(items) {
  const answers = (items || [])
    .map((item) => String(item?.answer || '').replace(/\s+/g, ' ').trim().toLowerCase())
    .filter(Boolean)
    .sort();
  return answers.join('\u0001');
}

export function typingRushStorageKey(contentId, fingerprint) {
  return `${STORAGE_PREFIX}${contentId || 'anon'}.${fingerprint || 'empty'}`;
}

function readBest(getItem, contentId, fingerprint) {
  if (!fingerprint || typeof getItem !== 'function') return 0;
  try {
    const raw = getItem(typingRushStorageKey(contentId, fingerprint));
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeBest(setItem, contentId, fingerprint, value) {
  if (!fingerprint || typeof setItem !== 'function') return;
  try {
    setItem(typingRushStorageKey(contentId, fingerprint), String(value));
  } catch {
    /* ignore quota */
  }
}

function webStorage() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
  };
}

export function loadTypingBestMs(contentId, fingerprint, storage = webStorage()) {
  return readBest(storage?.getItem?.bind(storage), contentId, fingerprint);
}

export function saveTypingBestMs(contentId, fingerprint, elapsedMs, storage = webStorage()) {
  if (!fingerprint || !(elapsedMs > 0)) {
    return loadTypingBestMs(contentId, fingerprint, storage);
  }
  const prev = loadTypingBestMs(contentId, fingerprint, storage);
  const next = prev > 0 ? Math.min(prev, elapsedMs) : elapsedMs;
  writeBest(storage?.setItem?.bind(storage), contentId, fingerprint, next);
  return next;
}

export function formatTypingTime(ms) {
  if (!ms || ms <= 0) return '-';
  const totalSec = ms / 1000;
  if (totalSec < 60) return `${totalSec.toFixed(2)}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export function buildTypingRaceText(items) {
  const seen = new Set();
  const parts = [];
  (items || []).forEach((item) => {
    const answer = String(item?.answer || '').replace(/\s+/g, ' ').trim();
    if (!answer) return;
    const key = answer.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    parts.push(answer);
  });
  return parts.join(' ');
}

export function charsMatch(a, b) {
  if (a == null || b == null) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}
