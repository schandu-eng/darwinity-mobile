import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { ChevronLeft, ChevronRight } from '@/icons';
import { splitTourBodyForEmphasis } from '@shared/feature-tour/index.js';
import { useAppTheme } from '@/store/appThemeStore';
import useFeatureTour from './useFeatureTour';
import { computeTooltipPosition, rectFromMeasure } from './tourPositioning';
import type { MeasuredRect } from './types';

import { Fonts } from '@/config/fonts';
import { pointerEventsProp, pointerEventsStyle } from '@/theme/webCompat';

const DEFAULT_TOOLTIP_WIDTH = 220;
const DEFAULT_TOOLTIP_HEIGHT = 100;
const ANCHOR_RETRY_MS = 50;
const ANCHOR_LAYOUT_DELAY_MS = 80;

function formatTourBody(body: string | undefined) {
  const segments = splitTourBodyForEmphasis(body);
  if (!segments) return body;

  return segments.map((segment, index) =>
    segment.emphasize ? (
      <Text key={index} style={styles.bodyEmphasis}>
        {segment.text}
      </Text>
    ) : (
      segment.text
    ),
  );
}

function TourTooltipArrow({
  placement,
  offset,
}: {
  placement: string;
  offset: number;
}) {
  const edge = [
    styles.arrow,
    styles.arrowFill,
    pointerEventsStyle('none'),
  ];
  const none = pointerEventsProp('none');

  if (placement === 'bottom') {
    return <View pointerEvents={none} style={[...edge, styles.arrowBottom, { left: offset }]} />;
  }
  if (placement === 'top') {
    return <View pointerEvents={none} style={[...edge, styles.arrowTop, { left: offset }]} />;
  }
  if (placement === 'right') {
    return <View pointerEvents={none} style={[...edge, styles.arrowRight, { top: offset }]} />;
  }
  if (placement === 'left') {
    return <View pointerEvents={none} style={[...edge, styles.arrowLeft, { top: offset }]} />;
  }
  return null;
}

function ScrimCutout({
  targetRect,
  screenWidth,
  screenHeight,
  scrimColor,
  isDark,
  onDismiss,
}: {
  targetRect: MeasuredRect;
  screenWidth: number;
  screenHeight: number;
  scrimColor: string;
  isDark: boolean;
  onDismiss: () => void;
}) {
  const { top, left, width, height } = targetRect;
  const right = Math.max(0, screenWidth - left - width);
  const bottom = Math.max(0, screenHeight - top - height);

  return (
    <>
      <Pressable
        onPress={onDismiss}
        style={[styles.scrim, { backgroundColor: scrimColor, top: 0, left: 0, right: 0, height: Math.max(0, top) }]}
      />
      <Pressable
        onPress={onDismiss}
        style={[styles.scrim, { backgroundColor: scrimColor, top, left: 0, width: Math.max(0, left), height }]}
      />
      <Pressable
        onPress={onDismiss}
        style={[styles.scrim, { backgroundColor: scrimColor, top, right: 0, width: right, height }]}
      />
      <Pressable
        onPress={onDismiss}
        style={[styles.scrim, { backgroundColor: scrimColor, top: top + height, left: 0, right: 0, height: bottom }]}
      />
      {isDark ? (
        <View
          pointerEvents={pointerEventsProp('none')}
          style={[
            styles.spotlightRing,
            pointerEventsStyle('none'),
            { top, left, width, height },
          ]}
        />
      ) : null}
    </>
  );
}

export default function OnboardingTourOverlay() {
  const {
    isActive,
    currentStep,
    currentIndex,
    totalSteps,
    next,
    prev,
    skip,
    getAnchorRef,
  } = useFeatureTour();

  const isDark = useAppTheme() === 'dark';
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const overlayRef = useRef<View>(null);
  const [targetRect, setTargetRect] = useState<MeasuredRect | null>(null);
  const [tooltipSize, setTooltipSize] = useState({
    width: DEFAULT_TOOLTIP_WIDTH,
    height: DEFAULT_TOOLTIP_HEIGHT,
  });

  useEffect(() => {
    if (!isActive || !currentStep) {
      setTargetRect(null);
      return undefined;
    }

    setTargetRect(null);

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let layoutTimer: ReturnType<typeof setTimeout> | null = null;
    let frame: number | null = null;

    const tryAttach = () => {
      if (cancelled) return;

      const node = getAnchorRef(currentStep.id)?.current;
      if (!node?.measureInWindow) {
        retryTimer = setTimeout(tryAttach, ANCHOR_RETRY_MS);
        return;
      }

      const applyMeasure = (
        ox: number,
        oy: number,
        x: number,
        y: number,
        width: number,
        height: number,
      ) => {
        if (cancelled) return;
        if (width <= 1 || height <= 1) {
          retryTimer = setTimeout(tryAttach, ANCHOR_RETRY_MS);
          return;
        }
        setTargetRect(
          rectFromMeasure(
            x - ox,
            y - oy,
            width,
            height,
            currentStep.spotlightPadding ?? 8,
          ),
        );
      };

      const measureNode = node.measureInWindow;
      if (!measureNode) {
        retryTimer = setTimeout(tryAttach, ANCHOR_RETRY_MS);
        return;
      }

      overlayRef.current?.measureInWindow((ox, oy) => {
        measureNode.call(node, (x, y, width, height) => {
          applyMeasure(ox || 0, oy || 0, x, y, width, height);
        });
      });
    };

    layoutTimer = setTimeout(() => {
      frame = requestAnimationFrame(tryAttach);
    }, ANCHOR_LAYOUT_DELAY_MS);

    return () => {
      cancelled = true;
      if (frame != null) cancelAnimationFrame(frame);
      if (retryTimer != null) clearTimeout(retryTimer);
      if (layoutTimer != null) clearTimeout(layoutTimer);
    };
  }, [currentIndex, currentStep, getAnchorRef, isActive, screenHeight, screenWidth]);

  const tooltipPosition = useMemo(
    () =>
      computeTooltipPosition(
        targetRect,
        tooltipSize,
        currentStep?.placement ?? 'auto',
        { width: screenWidth, height: screenHeight },
      ),
    [currentStep?.placement, screenHeight, screenWidth, targetRect, tooltipSize],
  );

  if (!isActive || !currentStep) {
    return null;
  }

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalSteps - 1;
  const scrimColor = isDark ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0.55)';

  return (
    <View
      ref={overlayRef}
      pointerEvents={pointerEventsProp('box-none')}
      style={[styles.root, pointerEventsStyle('box-none')]}
      collapsable={false}
    >
      {targetRect ? (
        <>
          <ScrimCutout
            targetRect={targetRect}
            screenWidth={screenWidth}
            screenHeight={screenHeight}
            scrimColor={scrimColor}
            isDark={isDark}
            onDismiss={skip}
          />

          <View
            style={[
              styles.tooltipWrap,
              {
                top: tooltipPosition.top,
                left: tooltipPosition.left,
                width: Math.min(DEFAULT_TOOLTIP_WIDTH, screenWidth - 24),
              },
            ]}
          >
            {tooltipPosition.placement ? (
              <TourTooltipArrow
                placement={tooltipPosition.placement}
                offset={tooltipPosition.arrowOffset ?? 16}
              />
            ) : null}

            <View
              style={styles.tooltipCard}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                if (width > 0 && height > 0) {
                  setTooltipSize((prev) =>
                    prev.width === width && prev.height === height
                      ? prev
                      : { width, height },
                  );
                }
              }}
            >
              <Text style={styles.title}>{currentStep.title}</Text>
              {currentStep.body ? (
                <Text style={styles.body}>{formatTourBody(currentStep.body)}</Text>
              ) : null}

              <View style={styles.actions}>
                {!isFirst ? (
                  <Pressable onPress={prev} hitSlop={8} style={styles.backButton}>
                    <ChevronLeft size={12} color="#71717A" />
                    <Text style={styles.backText}>Back</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={next} style={styles.nextButton}>
                  <Text style={styles.nextText}>{isLast ? 'Done' : 'Next'}</Text>
                  {!isLast ? <ChevronRight size={12} color="#FFFFFF" /> : null}
                </Pressable>
              </View>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 24,
    overflow: 'visible',
  },
  scrim: {
    position: 'absolute',
  },
  spotlightRing: {
    position: 'absolute',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  tooltipWrap: {
    position: 'absolute',
    overflow: 'visible',
    zIndex: 2,
  },
  tooltipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E4E7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 12px 40px -8px rgba(0, 0, 0, 0.55)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
        elevation: 12,
      },
    }),
  },
  arrow: {
    position: 'absolute',
    width: 9,
    height: 9,
    zIndex: 3,
    transform: [{ rotate: '45deg' }],
  },
  arrowFill: {
    backgroundColor: '#FFFFFF',
  },
  arrowBottom: {
    top: -4,
  },
  arrowTop: {
    bottom: -4,
  },
  arrowRight: {
    left: -4,
  },
  arrowLeft: {
    right: -4,
  },
  title: {
    fontSize: 13,
    fontFamily: Fonts.ui.medium,
    color: '#18181B',
    lineHeight: 18,
  },
  body: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: Fonts.ui.regular,
    color: '#71717A',
  },
  bodyEmphasis: {
    fontFamily: Fonts.ui.semiBold,
    color: '#3F3F46',
  },
  actions: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 11,
    fontFamily: Fonts.ui.medium,
    color: '#71717A',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#18181B',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  nextText: {
    fontSize: 11,
    fontFamily: Fonts.ui.semiBold,
    color: '#FFFFFF',
  },
});
