import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Image, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Check } from '@/icons';
import { Fonts } from '@/config/fonts';
import { useAppTheme } from '@/store/appThemeStore';
import { pointerEventsProp, pointerEventsStyle } from '@/theme/webCompat';
import { STUDY_GROWTH, STUDY_INK } from './studyPanelTokens';
import { trailParamForProgress } from '@shared/generationProgress.js';

const DARWIN_SRC = require('../../../assets/onboarding-darwin.png');

export type TrailStage = {
  label: string;
  status: 'done' | 'active' | 'pending';
};

type Point = { x: number; y: number };

const PATH_STROKE = 8;
const TRAVEL_MS = 900;
const LABEL_H = 16;
const LABEL_GAP = 10;
const BOB_PAD = 4;

function buildTrailPath(positions: Point[]): string {
  if (!positions.length) return '';
  if (positions.length === 1) return `M ${positions[0].x} ${positions[0].y}`;
  let d = `M ${positions[0].x} ${positions[0].y}`;
  for (let i = 1; i < positions.length; i += 1) {
    const prev = positions[i - 1];
    const curr = positions[i];
    const midX = (prev.x + curr.x) / 2;
    d += ` C ${midX} ${prev.y}, ${midX} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function pointOnSegment(from: Point, to: Point, t: number): Point {
  const midX = (from.x + to.x) / 2;
  const p0 = from;
  const p1 = { x: midX, y: from.y };
  const p2 = { x: midX, y: to.y };
  const p3 = to;
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function activeIndexFromStages(stages: TrailStage[]): number {
  if (!stages.length) return 0;
  const active = stages.findIndex((s) => s.status === 'active');
  if (active >= 0) return active;
  const pending = stages.findIndex((s) => s.status !== 'done');
  if (pending >= 0) return pending;
  return stages.length - 1;
}

function estimateTrailLength(positions: Point[], samplesPerSegment = 24): number {
  if (positions.length < 2) return 0;
  const maxT = positions.length - 1;
  const steps = maxT * samplesPerSegment;
  let len = 0;
  let prev = positions[0];
  for (let s = 1; s <= steps; s += 1) {
    const pt = pointAtTrailT(positions, (s / steps) * maxT);
    len += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    prev = pt;
  }
  return len;
}

function trailRevealRatio(trailT: number, stageCount: number): number {
  const n = Math.max(1, Number(stageCount) || 1);
  if (n <= 1) return 1;
  return Math.min(1, Math.max(0, Number(trailT) / (n - 1)));
}

function pointAtTrailT(positions: Point[], t: number): Point {
  if (!positions.length) return { x: 0, y: 0 };
  if (positions.length === 1 || t <= 0) return positions[0];
  const maxT = positions.length - 1;
  if (t >= maxT) return positions[maxT];
  const i = Math.min(Math.floor(t), positions.length - 2);
  return pointOnSegment(positions[i], positions[i + 1], t - i);
}

type StudyGenerationTrailMapProps = {
  stages?: TrailStage[];
  progress?: number | null;
  thresholds?: number[];
};

/** Compact Memory-Trail map — same layout as web `GenerationTrailMap`. */
export const StudyGenerationTrailMap: React.FC<StudyGenerationTrailMapProps> = ({
  stages = [],
  progress = null,
  thresholds,
}) => {
  const isDark = useAppTheme() === 'dark';
  const { width: windowW } = useWindowDimensions();
  const [containerW, setContainerW] = useState(Math.min(windowW - 48, 360));

  const list: TrailStage[] =
    Array.isArray(stages) && stages.length > 0
      ? stages
      : [{ label: 'Working', status: 'active' }];

  const stageIndex = activeIndexFromStages(list);
  const stageCount = Math.max(list.length, 1);
  const hasProgress = progress != null && Number.isFinite(Number(progress));
  const trailT = hasProgress
    ? trailParamForProgress(progress, stageCount, thresholds)
    : stageIndex;
  const progressIndex = Math.min(stageCount - 1, Math.floor(trailT + 1e-6));
  const targetIndex = hasProgress ? progressIndex : stageIndex;
  const compact = containerW < 420;
  const node = compact ? 28 : 36;
  const darwinSize = compact ? 36 : 48;
  const zig = compact ? 12 : 20;
  const sidePad = compact ? 22 : 40;
  const topPad = darwinSize / 2 + BOB_PAD;
  const midY = topPad + zig;
  const labelTop = midY + zig + darwinSize / 2 + LABEL_GAP;
  const mapH = Math.ceil(labelTop + LABEL_H + 2);
  const mapW = Math.max(containerW, sidePad * 2 + node);
  const colW =
    stageCount > 1 ? Math.max(1, (mapW - sidePad * 2 - node) / (stageCount - 1)) : 0;

  const positions = useMemo(
    () =>
      list.map((_, i) => {
        const baseX = sidePad + i * colW + node / 2;
        // Gentle zig-zag. Labels sit in one row under the path so Darwin never covers them.
        const offset = i % 2 === 0 ? -zig : zig;
        return { x: baseX, y: midY + offset };
      }),
    [list.length, colW, node, sidePad, midY, zig]
  );

  const pathD = useMemo(() => buildTrailPath(positions), [positions]);

  const [displayIndex, setDisplayIndex] = useState(targetIndex);
  const [darwin, setDarwin] = useState<Point>(() => positions[0] || { x: 0, y: 0 });
  const [reveal, setReveal] = useState(1);
  const [traveling, setTraveling] = useState(false);
  const displayIndexRef = useRef(displayIndex);
  displayIndexRef.current = displayIndex;
  const pathIndex = hasProgress ? progressIndex : displayIndex;
  const darwinPos = hasProgress ? pointAtTrailT(positions, trailT) : darwin;
  const progressPathLen = useMemo(
    () => (hasProgress ? estimateTrailLength(positions) : 0),
    [hasProgress, positions]
  );
  const progressReveal = hasProgress ? trailRevealRatio(trailT, stageCount) : 1;

  const settledGreenD = useMemo(
    () => buildTrailPath(positions.slice(0, Math.max(pathIndex + 1, 1))),
    [positions, pathIndex]
  );

  const travelSegmentD = useMemo(() => {
    if (!traveling || targetIndex <= displayIndex) return '';
    return buildTrailPath(positions.slice(displayIndex, targetIndex + 1));
  }, [traveling, targetIndex, displayIndex, positions]);

  const segmentLen = useMemo(() => {
    if (!traveling) return 160;
    const from = positions[displayIndex];
    const to = positions[targetIndex];
    if (!from || !to) return 160;
    return Math.hypot(to.x - from.x, to.y - from.y) * 1.35;
  }, [traveling, positions, displayIndex, targetIndex]);

  useEffect(() => {
    if (hasProgress) {
      setDisplayIndex(progressIndex);
      setTraveling(false);
      setReveal(1);
      setDarwin(pointAtTrailT(positions, trailT));
      return undefined;
    }
    if (traveling) return;
    const p = positions[displayIndex];
    if (!p) return;
    setDarwin(p);
    setReveal(1);
  }, [displayIndex, positions, traveling, hasProgress, trailT, progressIndex]);

  useEffect(() => {
    if (hasProgress) return undefined;
    const fromIdx = displayIndexRef.current;
    if (targetIndex === fromIdx) return undefined;
    if (targetIndex < fromIdx) {
      setDisplayIndex(targetIndex);
      setTraveling(false);
      const p = positions[targetIndex];
      if (p) setDarwin(p);
      return undefined;
    }

    const from = positions[fromIdx];
    const to = positions[targetIndex];
    if (!from || !to) {
      setDisplayIndex(targetIndex);
      return undefined;
    }

    let raf = 0;
    let alive = true;
    const start = Date.now();
    setTraveling(true);
    setReveal(0);
    setDarwin(from);

    const tick = () => {
      if (!alive) return;
      const raw = Math.min(1, (Date.now() - start) / TRAVEL_MS);
      const eased = easeInOutCubic(raw);
      setDarwin(pointOnSegment(from, to, eased));
      setReveal(eased);
      if (raw < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setDisplayIndex(targetIndex);
        setTraveling(false);
        setReveal(1);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [targetIndex, positions, hasProgress]);

  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-1.5, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [bob]);

  const darwinStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: traveling ? 0 : bob.value }],
  }));

  const pathBase = isDark ? 'rgba(255,255,255,0.12)' : '#E4E6E8';
  const pathDone = isDark ? 'rgba(122,158,134,0.55)' : 'rgba(63,107,79,0.45)';
  const ink = isDark ? '#E8EFE9' : STUDY_INK;
  const mute = isDark ? '#8A9A90' : '#5C6B62';
  const growth = isDark ? '#9BB8A6' : STUDY_GROWTH;

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - containerW) > 1) setContainerW(w);
      }}
    >
      <View style={[styles.map, { height: mapH, width: mapW }]}>
        <Svg width={mapW} height={mapH} style={StyleSheet.absoluteFill}>
          {pathD ? (
            <Path
              d={pathD}
              stroke={pathBase}
              strokeWidth={PATH_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {hasProgress && pathD ? (
            <Path
              d={pathD}
              stroke={pathDone}
              strokeWidth={PATH_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${progressPathLen || 1}`}
              strokeDashoffset={(progressPathLen || 1) * (1 - progressReveal)}
            />
          ) : null}
          {!hasProgress && settledGreenD ? (
            <Path
              d={settledGreenD}
              stroke={pathDone}
              strokeWidth={PATH_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {!hasProgress && traveling && travelSegmentD ? (
            <Path
              d={travelSegmentD}
              stroke={pathDone}
              strokeWidth={PATH_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${segmentLen}`}
              strokeDashoffset={segmentLen * (1 - reveal)}
            />
          ) : null}
        </Svg>

        {list.map((stage, i) => {
          const pos = positions[i];
          if (!pos) return null;
          const isDone = stage.status === 'done' || i < pathIndex;
          const isCurrent = (i === pathIndex && !traveling) || (traveling && i === targetIndex);
          const muted = !isDone && !isCurrent;
          const labelW = Math.min(96, Math.max(56, colW - 6));
          const labelLeft = Math.min(
            Math.max(0, pos.x - labelW / 2),
            Math.max(0, mapW - labelW)
          );

          return (
            <View
              key={`${stage.label}-${i}`}
              pointerEvents={pointerEventsProp('none')}
              style={[StyleSheet.absoluteFill, pointerEventsStyle('none')]}
            >
              <View
                style={[
                  styles.label,
                  {
                    left: labelLeft,
                    top: labelTop,
                    width: labelW,
                    height: LABEL_H,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.title,
                    {
                      color: muted ? mute : isCurrent ? growth : ink,
                      opacity: muted ? 0.72 : 1,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {stage.label}
                </Text>
              </View>
              <View
                style={[
                  styles.node,
                  {
                    left: pos.x - node / 2,
                    top: pos.y - node / 2,
                    width: node,
                    height: node,
                    backgroundColor: isDone
                      ? isDark
                        ? 'rgba(122,158,134,0.18)'
                        : 'rgba(63,107,79,0.12)'
                      : isDark
                        ? '#1C2E24'
                        : '#FFFFFF',
                    borderColor: isCurrent
                      ? isDark
                        ? 'rgba(155,184,166,0.55)'
                        : 'rgba(63,107,79,0.45)'
                      : isDone
                        ? isDark
                          ? 'rgba(122,158,134,0.4)'
                          : 'rgba(63,107,79,0.32)'
                        : isDark
                          ? 'rgba(122,158,134,0.28)'
                          : 'rgba(63,107,79,0.14)',
                  },
                ]}
              >
                {isDone && !isCurrent ? (
                  <Check size={16} strokeWidth={2.25} color={growth} />
                ) : (
                  <View style={[styles.dot, { backgroundColor: growth }]} />
                )}
              </View>
            </View>
          );
        })}

        <Animated.View
          style={[
            styles.darwin,
            {
              left: darwinPos.x - darwinSize / 2,
              top: darwinPos.y - darwinSize / 2,
              width: darwinSize,
              height: darwinSize,
              backgroundColor: isDark ? '#24362C' : '#F4F7F5',
              borderColor: isDark ? 'rgba(122,158,134,0.45)' : 'rgba(63,107,79,0.35)',
            },
            darwinStyle,
          ]}
        >
          <Image source={DARWIN_SRC} style={styles.darwinImg} resizeMode="cover" />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 4,
  },
  map: {
    position: 'relative',
    alignSelf: 'center',
    overflow: 'visible',
  },
  label: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  title: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  node: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    opacity: 0.55,
  },
  darwin: {
    position: 'absolute',
    zIndex: 5,
    borderRadius: 999,
    padding: 3,
    borderWidth: 2,
    overflow: 'hidden',
  },
  darwinImg: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
});
