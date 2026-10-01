const TOOLTIP_GAP = 8;
const VIEWPORT_PADDING = 16;
const ARROW_SIZE = 9;
const ARROW_MARGIN = 12;

const PLACEMENT_ORDER = ['bottom', 'top', 'right', 'left'];

function fitsInViewport(left, top, width, height, viewport) {
  return (
    left >= VIEWPORT_PADDING
    && top >= VIEWPORT_PADDING
    && left + width <= viewport.width - VIEWPORT_PADDING
    && top + height <= viewport.height - VIEWPORT_PADDING
  );
}

function positionForPlacement(placement, targetRect, tooltipSize) {
  const { width: tw, height: th } = tooltipSize;
  const centerX = targetRect.left + targetRect.width / 2;
  const centerY = targetRect.top + targetRect.height / 2;

  switch (placement) {
    case 'top':
      return {
        left: centerX - tw / 2,
        top: targetRect.top - th - TOOLTIP_GAP,
        placement,
      };
    case 'bottom':
      return {
        left: centerX - tw / 2,
        top: targetRect.bottom + TOOLTIP_GAP,
        placement,
      };
    case 'left':
      return {
        left: targetRect.left - tw - TOOLTIP_GAP,
        top: centerY - th / 2,
        placement,
      };
    case 'right':
      return {
        left: targetRect.right + TOOLTIP_GAP,
        top: centerY - th / 2,
        placement,
      };
    default:
      return positionForPlacement('bottom', targetRect, tooltipSize);
  }
}

function clampToViewport(left, top, width, height, viewport) {
  const maxLeft = viewport.width - width - VIEWPORT_PADDING;
  const maxTop = viewport.height - height - VIEWPORT_PADDING;

  return {
    left: Math.min(Math.max(left, VIEWPORT_PADDING), Math.max(VIEWPORT_PADDING, maxLeft)),
    top: Math.min(Math.max(top, VIEWPORT_PADDING), Math.max(VIEWPORT_PADDING, maxTop)),
  };
}

function spaceForPlacement(placement, targetRect, viewport) {
  switch (placement) {
    case 'top':
      return targetRect.top - VIEWPORT_PADDING;
    case 'bottom':
      return viewport.height - targetRect.bottom - VIEWPORT_PADDING;
    case 'left':
      return targetRect.left - VIEWPORT_PADDING;
    case 'right':
      return viewport.width - targetRect.right - VIEWPORT_PADDING;
    default:
      return 0;
  }
}

/**
 * Offset of the pointer along the tooltip edge so it aims at the target center.
 * For top/bottom placements this is `left`; for left/right it is `top`.
 */
export function computeArrowOffset(placement, tooltipPosition, targetRect, tooltipSize) {
  if (!targetRect || !tooltipSize?.width || !tooltipSize?.height) {
    return ARROW_MARGIN;
  }

  const alongHorizontal = placement === 'top' || placement === 'bottom';
  const targetCenter = alongHorizontal
    ? targetRect.left + targetRect.width / 2
    : targetRect.top + targetRect.height / 2;
  const tooltipOrigin = alongHorizontal ? tooltipPosition.left : tooltipPosition.top;
  const tooltipExtent = alongHorizontal ? tooltipSize.width : tooltipSize.height;
  const raw = targetCenter - tooltipOrigin - ARROW_SIZE / 2;
  const max = Math.max(ARROW_MARGIN, tooltipExtent - ARROW_MARGIN - ARROW_SIZE);
  return Math.min(Math.max(raw, ARROW_MARGIN), max);
}

function withArrow(position, targetRect, tooltipSize) {
  return {
    ...position,
    arrowOffset: computeArrowOffset(
      position.placement,
      position,
      targetRect,
      tooltipSize,
    ),
  };
}

/** Expand a measured rect by padding (DOM or RN measureInWindow). */
export function padRect(rect, padding = 8) {
  if (!rect) return null;

  return {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
    right: rect.right + padding,
    bottom: rect.bottom + padding,
  };
}

/**
 * @param {object|null|undefined} targetRect
 * @param {{ width: number, height: number }} tooltipSize
 * @param {string} [preferredPlacement]
 * @param {{ width: number, height: number }} viewport
 */
export function computeTooltipPosition(
  targetRect,
  tooltipSize,
  preferredPlacement = 'auto',
  viewport = { width: 0, height: 0 },
) {
  if (!targetRect || !tooltipSize?.width || !tooltipSize?.height) {
    return {
      left: VIEWPORT_PADDING,
      top: VIEWPORT_PADDING,
      placement: 'bottom',
      arrowOffset: ARROW_MARGIN,
    };
  }

  const candidates = preferredPlacement === 'auto'
    ? PLACEMENT_ORDER
    : [preferredPlacement, ...PLACEMENT_ORDER.filter((p) => p !== preferredPlacement)];

  for (const placement of candidates) {
    const candidate = positionForPlacement(placement, targetRect, tooltipSize);
    if (fitsInViewport(
      candidate.left,
      candidate.top,
      tooltipSize.width,
      tooltipSize.height,
      viewport,
    )) {
      return withArrow(candidate, targetRect, tooltipSize);
    }
  }

  // Preferred side didn't fit. Use the side with the most room, then clamp
  // the other axis so the pointer can still aim at the target.
  let bestPlacement = candidates[0];
  let bestSpace = -Infinity;
  for (const placement of candidates) {
    const space = spaceForPlacement(placement, targetRect, viewport);
    if (space > bestSpace) {
      bestSpace = space;
      bestPlacement = placement;
    }
  }

  const fallback = positionForPlacement(bestPlacement, targetRect, tooltipSize);
  const clamped = clampToViewport(
    fallback.left,
    fallback.top,
    tooltipSize.width,
    tooltipSize.height,
    viewport,
  );

  return withArrow({ ...fallback, ...clamped }, targetRect, tooltipSize);
}
