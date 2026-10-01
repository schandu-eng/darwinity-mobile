import { Dimensions } from 'react-native';
import {
  padRect,
  computeTooltipPosition as computeTooltipPositionShared,
} from '@shared/feature-tour/index.js';
import type { MeasuredRect } from './types';

export function getViewport() {
  const { width, height } = Dimensions.get('window');
  return { width, height };
}

export function rectFromMeasure(
  x: number,
  y: number,
  width: number,
  height: number,
  padding = 8,
): MeasuredRect | null {
  return padRect(
    {
      top: y,
      left: x,
      width,
      height,
      right: x + width,
      bottom: y + height,
    },
    padding,
  );
}

export function computeTooltipPosition(
  targetRect: MeasuredRect | null,
  tooltipSize: { width: number; height: number },
  preferredPlacement: string = 'auto',
  viewport: { width: number; height: number } = getViewport(),
) {
  return computeTooltipPositionShared(
    targetRect as object | undefined,
    tooltipSize,
    preferredPlacement,
    viewport,
  );
}
