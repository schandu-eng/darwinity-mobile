/** Geometry + saved-position math for the movable Ask AI FAB (web + native). */

export const FLOATING_CHAT_FAB_SIZE = 52;
export const FLOATING_CHAT_FAB_MARGIN = 16;
export const FLOATING_CHAT_FAB_TAP_SLOP = 10;
export const FLOATING_CHAT_FAB_STORAGE_KEY = 'dw.floatingChatFab.v2';

/** Matches `.mobile-bottom-bar` `--mobile-bottom-bar-height` plus the FAB gap. */
export const FLOATING_CHAT_FAB_BOTTOM_CSS =
  'calc(var(--mobile-bottom-bar-height, 4rem) + env(safe-area-inset-bottom, 0px) + 16px)';

export function getFloatingChatBounds({
  width,
  height,
  size = FLOATING_CHAT_FAB_SIZE,
  margin = FLOATING_CHAT_FAB_MARGIN,
  topInset = 0,
  bottomInset = 0,
}) {
  const minX = margin;
  const minY = topInset + margin;
  const maxX = Math.max(minX, width - size - margin);
  const maxY = Math.max(minY, height - size - bottomInset);
  return { minX, minY, maxX, maxY };
}

export function clampFloatingChatPosition({ x, y, ...boundsInput }) {
  const { minX, minY, maxX, maxY } = getFloatingChatBounds(boundsInput);
  return {
    x: Math.min(maxX, Math.max(minX, x)),
    y: Math.min(maxY, Math.max(minY, y)),
  };
}

export function defaultFloatingChatPosition(boundsInput) {
  const { maxX, maxY } = getFloatingChatBounds(boundsInput);
  return { x: maxX, y: maxY };
}

export function toFloatingChatFractions(x, y, boundsInput) {
  const { minX, minY, maxX, maxY } = getFloatingChatBounds(boundsInput);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  return {
    fx: (x - minX) / spanX,
    fy: (y - minY) / spanY,
  };
}

export function fromFloatingChatFractions(fx, fy, boundsInput) {
  const { minX, minY, maxX, maxY } = getFloatingChatBounds(boundsInput);
  return clampFloatingChatPosition({
    x: minX + fx * (maxX - minX),
    y: minY + fy * (maxY - minY),
    ...boundsInput,
  });
}

export function parseFloatingChatFractions(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const fx = Number(parsed?.fx);
    const fy = Number(parsed?.fy);
    if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null;
    return {
      fx: Math.min(1, Math.max(0, fx)),
      fy: Math.min(1, Math.max(0, fy)),
    };
  } catch {
    return null;
  }
}

export function serializeFloatingChatFractions(fx, fy) {
  return JSON.stringify({ fx, fy });
}
