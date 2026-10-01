import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Image,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { TRAIL_LEVELS, type TrailLevelId, trailColors as c } from './trailLevels';
import { Fonts } from '@/config/fonts';
import { boxShadow } from '@/theme/webCompat';

const ROW_H = 132;
const NODE = 64;
const DARWIN = 76;
const TOP_PAD = 28;
const BOTTOM_PAD = 100;
const PATH_STROKE = 10;
const LABEL_W = 148;
const TRAVEL_MS = 1100;

const DARWIN_SRC = require('../../../assets/onboarding-darwin.png');

type Point = { x: number; y: number };

type AdventureMapProps = {
  currentId: TrailLevelId;
  completed: Set<TrailLevelId>;
  travelToId: TrailLevelId | null;
  onTravelEnd: (arrivedId: TrailLevelId) => void;
};

function buildPath(positions: Point[]): string {
  if (positions.length === 0) return '';
  if (positions.length === 1) return `M ${positions[0].x} ${positions[0].y}`;
  let d = `M ${positions[0].x} ${positions[0].y}`;
  for (let i = 1; i < positions.length; i++) {
    const prev = positions[i - 1];
    const curr = positions[i];
    const midY = (prev.y + curr.y) / 2;
    d += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function pointOnSegment(from: Point, to: Point, t: number): Point {
  const midY = (from.y + to.y) / 2;
  const p0 = from;
  const p1 = { x: from.x, y: midY };
  const p2 = { x: to.x, y: midY };
  const p3 = to;
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const DarwinFace: React.FC = () => (
  <View style={styles.darwinOuter}>
    <View style={styles.darwinMid}>
      <View style={styles.darwinInner}>
        <Image source={DARWIN_SRC} style={styles.darwinImage} resizeMode="cover" />
      </View>
    </View>
  </View>
);

export const AdventureMap: React.FC<AdventureMapProps> = ({
  currentId,
  completed,
  travelToId,
  onTravelEnd,
}) => {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const mapW = Math.min(width - 24, 420);
  const sidePad = (width - mapW) / 2;
  const traveling = travelToId !== null;
  const onTravelEndRef = useRef(onTravelEnd);
  onTravelEndRef.current = onTravelEnd;

  const positions = useMemo(
    () =>
      TRAIL_LEVELS.map((level, i) => ({
        x: sidePad + 40 + level.x * (mapW - 80),
        y: TOP_PAD + i * ROW_H + NODE / 2,
      })),
    [mapW, sidePad]
  );

  const currentIndex = Math.max(0, TRAIL_LEVELS.findIndex((l) => l.id === currentId));
  const travelToIndex = travelToId
    ? Math.max(0, TRAIL_LEVELS.findIndex((l) => l.id === travelToId))
    : currentIndex;

  const pathD = useMemo(() => buildPath(positions), [positions]);
  const settledGreenD = useMemo(
    () => buildPath(positions.slice(0, Math.max(currentIndex + 1, 1))),
    [positions, currentIndex]
  );
  const travelSegmentD = useMemo(() => {
    if (!traveling || travelToIndex <= currentIndex) return '';
    return buildPath(positions.slice(currentIndex, travelToIndex + 1));
  }, [traveling, travelToIndex, currentIndex, positions]);

  const segmentLen = useMemo(() => {
    if (!traveling) return 200;
    const from = positions[currentIndex];
    const to = positions[travelToIndex];
    if (!from || !to) return 200;
    return Math.hypot(to.x - from.x, to.y - from.y) * 1.4;
  }, [traveling, positions, currentIndex, travelToIndex]);

  const mapH = TOP_PAD + TRAIL_LEVELS.length * ROW_H + BOTTOM_PAD;

  const darwinX = useSharedValue(positions[currentIndex]?.x ?? 0);
  const darwinY = useSharedValue(positions[currentIndex]?.y ?? 0);
  const [reveal, setReveal] = useState(1);

  useEffect(() => {
    if (traveling) return;
    const p = positions[currentIndex];
    if (!p) return;
    darwinX.value = p.x;
    darwinY.value = p.y;
    setReveal(1);
  }, [currentIndex, positions, traveling, darwinX, darwinY]);

  useEffect(() => {
    if (!traveling || !travelToId) return;
    const from = positions[currentIndex];
    const to = positions[travelToIndex];
    if (!from || !to) return;

    let raf = 0;
    let alive = true;
    const start = Date.now();
    const arrivedId = travelToId;
    setReveal(0);
    darwinX.value = from.x;
    darwinY.value = from.y;

    const tick = () => {
      if (!alive) return;
      const raw = Math.min(1, (Date.now() - start) / TRAVEL_MS);
      const eased = easeInOutCubic(raw);
      const pt = pointOnSegment(from, to, eased);
      darwinX.value = pt.x;
      darwinY.value = pt.y;
      setReveal(eased);
      if (raw < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        onTravelEndRef.current(arrivedId);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [traveling, travelToId, currentIndex, travelToIndex, positions, darwinX, darwinY]);

  useEffect(() => {
    const focusIndex = traveling ? travelToIndex : currentIndex;
    const y = Math.max(0, TOP_PAD + focusIndex * ROW_H - 60);
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y, animated: true });
    }, 80);
    return () => clearTimeout(t);
  }, [currentIndex, travelToIndex, traveling]);

  const darwinStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    left: darwinX.value - DARWIN / 2,
    top: darwinY.value - DARWIN / 2,
    width: DARWIN,
    height: DARWIN,
    zIndex: 20,
  }));

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={{ minHeight: mapH, paddingBottom: 16 }}
      showsVerticalScrollIndicator={false}
      scrollEnabled={!traveling}
    >
      <View style={[styles.map, { height: mapH }]}>
        <Svg width={width} height={mapH} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path
            d={pathD}
            stroke="#E4E6E8"
            strokeWidth={PATH_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {settledGreenD ? (
            <Path
              d={settledGreenD}
              stroke="rgba(63,107,79,0.4)"
              strokeWidth={PATH_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {traveling && travelSegmentD ? (
            <Path
              d={travelSegmentD}
              stroke="rgba(63,107,79,0.4)"
              strokeWidth={PATH_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={`${segmentLen}`}
              strokeDashoffset={segmentLen * (1 - reveal)}
            />
          ) : null}
        </Svg>

        {TRAIL_LEVELS.map((level, i) => {
          const pos = positions[i];
          const isDone = completed.has(level.id);
          const isCurrent = level.id === currentId && !traveling;
          const isTravelTarget = traveling && level.id === travelToId;
          const isUpcoming = !isDone && !isCurrent && !(isTravelTarget && !isDone);
          const left = pos.x - NODE / 2;
          const top = pos.y - NODE / 2;
          const labelOnRight = level.labelSide === 'right';

          return (
            <View key={level.id} style={StyleSheet.absoluteFill} pointerEvents="box-none">
              <View
                style={[
                  styles.label,
                  {
                    top: pos.y - 28,
                    width: LABEL_W,
                    ...(labelOnRight
                      ? { left: pos.x + NODE / 2 + 14 }
                      : { right: width - pos.x + NODE / 2 + 14 }),
                  },
                  !labelOnRight && styles.labelAlignRight,
                ]}
                pointerEvents="none"
              >
                <Text
                  style={[
                    styles.sectionEyebrow,
                    (isCurrent || isTravelTarget) && styles.sectionEyebrowActive,
                    !labelOnRight && styles.sectionTitleRight,
                  ]}
                >
                  STAGE {level.number}
                </Text>
                <Text
                  style={[
                    styles.sectionTitle,
                    isUpcoming && !isTravelTarget && styles.sectionTitleMuted,
                    !labelOnRight && styles.sectionTitleRight,
                  ]}
                  numberOfLines={2}
                >
                  {level.title}
                </Text>
              </View>

              <View style={[styles.nodeAnchor, { left, top, width: NODE, height: NODE }]}>
                {isCurrent ? (
                  <View style={styles.startTag}>
                    <Text style={styles.startTagText}>HERE</Text>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.node,
                    isDone && styles.nodeDone,
                    (isCurrent || isTravelTarget) && styles.nodeCurrent,
                    isUpcoming && !isTravelTarget && styles.nodeUpcoming,
                  ]}
                >
                  {isDone ? (
                    <MaterialCommunityIcons name="check-bold" size={26} color={c.growth} />
                  ) : (
                    <MaterialCommunityIcons
                      name={level.icon}
                      size={24}
                      color={isCurrent || isTravelTarget ? c.growth : '#9AA3A0'}
                    />
                  )}
                </View>
              </View>
            </View>
          );
        })}

        <Animated.View style={darwinStyle} pointerEvents="none">
          <DarwinFace />
        </Animated.View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  map: { width: '100%', position: 'relative' },
  nodeAnchor: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startTag: {
    position: 'absolute',
    top: -30,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: 'rgba(63,107,79,0.14)',
    zIndex: 4,
  },
  startTagText: {
    fontFamily: Fonts.display.extraBold,
    fontSize: 11,
    letterSpacing: 0.8,
    color: c.growth,
  },
  darwinOuter: {
    width: DARWIN,
    height: DARWIN,
    borderRadius: DARWIN / 2,
    padding: 3,
    backgroundColor: '#D8E5DC',
    borderWidth: 1.5,
    borderTopColor: '#F4FAF6',
    borderLeftColor: '#EEF6F1',
    borderRightColor: '#A8C4B0',
    borderBottomColor: '#8FB59A',
    ...boxShadow('0 5px 10px rgba(26,47,35,0.22)', {
      shadowColor: '#1A2F23',
      shadowOpacity: 0.22,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 8,
    }),
  },
  darwinMid: {
    flex: 1,
    borderRadius: DARWIN / 2,
    padding: 2.5,
    backgroundColor: '#F7FBF8',
    borderWidth: 1,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#FFFFFF',
    borderRightColor: '#C5D9CB',
    borderBottomColor: '#B4CDBB',
  },
  darwinInner: {
    flex: 1,
    borderRadius: DARWIN / 2,
    overflow: 'hidden',
    backgroundColor: '#E8E4DB',
    borderWidth: 1,
    borderColor: 'rgba(26,47,35,0.12)',
  },
  darwinImage: { width: '100%', height: '100%' },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  nodeDone: {
    backgroundColor: c.growthSoft,
    borderWidth: 1.5,
    borderColor: 'rgba(63,107,79,0.22)',
  },
  nodeCurrent: {
    backgroundColor: 'rgba(63,107,79,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(63,107,79,0.32)',
  },
  nodeUpcoming: {
    backgroundColor: '#F4F5F4',
    borderWidth: 1.5,
    borderColor: '#E2E5E3',
  },
  label: { position: 'absolute', gap: 4 },
  labelAlignRight: { alignItems: 'flex-end' },
  sectionEyebrow: {
    fontFamily: Fonts.body.bold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: 'rgba(63,107,79,0.55)',
  },
  sectionEyebrowActive: { color: c.growth },
  sectionTitle: {
    fontFamily: Fonts.display.bold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
    color: c.ink,
  },
  sectionTitleRight: { textAlign: 'right' },
  sectionTitleMuted: { color: '#6B736F' },
});

export default AdventureMap;
