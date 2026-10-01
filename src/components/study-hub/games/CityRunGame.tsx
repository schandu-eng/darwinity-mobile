import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, PanResponder, type LayoutChangeEvent } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient as SvgGradient, Line, Path, Rect, Stop } from 'react-native-svg';
import {
  applyArcadeHit,
  applyArcadeLifeLoss,
  cityApproachSpeed,
  cityCamFollow,
  cityFollowLayout,
  cityGateWorldAt,
  cityLaneOffsetPct,
  cityObstacleCoversLane,
  cityTrackPx,
  CITY_CAM_FOLLOW,
  CITY_HIT_AT,
  CITY_HIT_SCORE,
  CITY_LANE_BADGES,
  CITY_LANE_SPREAD_PCT,
  CITY_LANES,
  CITY_START_LIVES,
  padCityGates,
  pickCityRound,
  placeCityObstacles,
} from '@shared/study-games/index.js';
import { Fonts } from '@/config/fonts';
import { playGameHit, playGameLaneChange, playGameLifeLost, playGameOver } from '@/study-hub/gameFeedback';
import { GameOverOverlay, StudyGameShell } from './StudyGameShell';

type GameItem = {
  id: string;
  prompt: string;
  answer: string;
  choices: string[];
  choiceLabels?: string[];
};

type CityObstacle = {
  id: string;
  kind: 'train';
  lanes: number[];
  hitAt: number;
  worldAt: number;
};

type CityRunGameProps = {
  items: GameItem[];
  onExit: () => void;
};

const RUNG_GAP = 36;
const CITY_INVULN_MS = 900;
const CITY_FLASH_MS = 280;
const OBSTACLE_COPY: Record<CityObstacle['kind'], string> = {
  train: 'Hit a train!',
};

function CityWorld({
  width,
  height,
  camDist,
}: {
  width: number;
  height: number;
  camDist: number;
}) {
  if (width < 8 || height < 8) return null;
  const horizon = height * 0.24;
  const topL = width * 0.36;
  const topR = width * 0.64;
  const roadH = height - horizon;
  const offset = ((cityTrackPx(camDist) % RUNG_GAP) + RUNG_GAP) % RUNG_GAP;
  const rungs: Array<{ y: number; x1: number; x2: number; width: number }> = [];
  for (let y = offset; y < roadH; y += RUNG_GAP) {
    const t = y / roadH;
    const x1 = topL + (0 - topL) * t;
    const x2 = topR + (width - topR) * t;
    rungs.push({ y: horizon + y, x1, x2, width: Math.max(1.5, 1 + t * 2.4) });
  }
  const laneAt = (frac: number) => {
    const xTop = topL + (topR - topL) * frac;
    const xBot = width * frac;
    return { x1: xTop, y1: horizon, x2: xBot, y2: height };
  };
  const leftLane = laneAt(0.333);
  const rightLane = laneAt(0.667);
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgGradient id="citySky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3b9fd4" />
          <Stop offset="0.7" stopColor="#8fd4f0" />
          <Stop offset="1" stopColor="#e7f3c8" />
        </SvgGradient>
        <SvgGradient id="cityRoad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4a4a4a" />
          <Stop offset="1" stopColor="#5c5c5c" />
        </SvgGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={horizon + 8} fill="url(#citySky)" />
      {Array.from({ length: 7 }).map((_, i) => {
        const bw = 10 + (i % 3) * 5;
        return (
          <Rect
            key={`sky-${i}`}
            x={8 + i * (width / 7.2)}
            y={horizon - (18 + (i % 4) * 10)}
            width={bw}
            height={18 + (i % 4) * 10}
            fill={i % 2 ? '#5d7a62' : '#4a6552'}
            opacity={0.7}
          />
        );
      })}
      <Path
        d={`M 0 ${horizon} L ${topL} ${horizon} L 0 ${height} Z`}
        fill="#d24a3c"
      />
      <Path
        d={`M ${width} ${horizon} L ${topR} ${horizon} L ${width} ${height} Z`}
        fill="#d24a3c"
      />
      <Path
        d={`M ${topL} ${horizon} L ${topR} ${horizon} L ${width} ${height} L 0 ${height} Z`}
        fill="url(#cityRoad)"
      />
      {rungs.map((rung, i) => (
        <Line
          key={`rung-${i}`}
          x1={rung.x1}
          y1={rung.y}
          x2={rung.x2}
          y2={rung.y}
          stroke="rgba(255, 214, 80, 0.55)"
          strokeWidth={rung.width}
        />
      ))}
      <Line
        x1={leftLane.x1}
        y1={leftLane.y1}
        x2={leftLane.x2}
        y2={leftLane.y2}
        stroke="rgba(255,220,90,0.85)"
        strokeWidth={2}
      />
      <Line
        x1={rightLane.x1}
        y1={rightLane.y1}
        x2={rightLane.x2}
        y2={rightLane.y2}
        stroke="rgba(255,220,90,0.85)"
        strokeWidth={2}
      />
    </Svg>
  );
}

function ObstacleBody() {
  return (
    <View style={styles.train}>
      <View style={styles.trainRoof} />
      <View style={styles.trainCab} />
      <View style={styles.trainWindows}>
        <View style={styles.trainWindow} />
        <View style={styles.trainWindow} />
        <View style={styles.trainWindow} />
      </View>
      <View style={styles.trainBumper} />
    </View>
  );
}

export const CityRunGame: React.FC<CityRunGameProps> = ({ items, onExit }) => {
  const insets = useSafeAreaInsets();
  const round = useMemo(() => pickCityRound(items) as GameItem[], [items]);
  const [lane, setLane] = useState(0);
  const [qIndex, setQIndex] = useState(0);
  const [lives, setLives] = useState(CITY_START_LIVES);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [correct, setCorrect] = useState(0);
  const [camDist, setCamDist] = useState(-CITY_CAM_FOLLOW);
  const [sceneSize, setSceneSize] = useState({ w: 0, h: 0 });
  const [gateChoices, setGateChoices] = useState<string[]>([]);
  const [gateLabels, setGateLabels] = useState<string[]>([]);
  const [obstacles, setObstacles] = useState<CityObstacle[]>([]);
  const [status, setStatus] = useState<'running' | 'over' | 'won'>('running');
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null);
  const [hitCopy, setHitCopy] = useState('');
  const [invuln, setInvuln] = useState(false);

  const laneRef = useRef(0);
  const approachRef = useRef(0);
  const runDistRef = useRef(0);
  const camDistRef = useRef(-CITY_CAM_FOLLOW);
  const segmentStartRef = useRef(0);
  const resolvingRef = useRef(false);
  const speedRef = useRef(cityApproachSpeed(0));
  const gateChoicesRef = useRef<string[]>([]);
  const gateLabelsRef = useRef<string[]>([]);
  const obstaclesRef = useRef<CityObstacle[]>([]);
  const resolvedObstaclesRef = useRef(new Set<string>());
  const livesRef = useRef(CITY_START_LIVES);
  const comboRef = useRef(1);
  const scoreRef = useRef(0);
  const correctRef = useRef(0);
  const qIndexRef = useRef(0);
  const questionRef = useRef<GameItem | undefined>(undefined);
  const invulnUntilRef = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  const question = round[qIndex];
  questionRef.current = question;

  const resetGatesFor = useCallback(
    (idx: number) => {
      const padded = padCityGates(round[idx]);
      gateChoicesRef.current = padded.choices;
      gateLabelsRef.current = padded.labels;
      setGateChoices(padded.choices);
      setGateLabels(padded.labels);
      const start = runDistRef.current;
      segmentStartRef.current = start;
      const nextObstacles = placeCityObstacles(idx, start) as CityObstacle[];
      obstaclesRef.current = nextObstacles;
      resolvedObstaclesRef.current = new Set();
      setObstacles(nextObstacles);
      approachRef.current = 0;
      resolvingRef.current = false;
      speedRef.current = cityApproachSpeed(idx);
    },
    [round],
  );

  useEffect(() => {
    resetGatesFor(0);
  }, [resetGatesFor]);

  const advance = useCallback(
    (wasCorrect: boolean) => {
      const next = applyArcadeHit({
        lives: livesRef.current,
        combo: comboRef.current,
        score: scoreRef.current,
        correctCount: correctRef.current,
        qIndex: qIndexRef.current,
        roundLength: round.length,
        wasCorrect,
        pointsPerHit: CITY_HIT_SCORE,
      });
      livesRef.current = next.lives;
      comboRef.current = next.combo;
      scoreRef.current = next.score;
      correctRef.current = next.correctCount;
      setLives(next.lives);
      setCombo(next.combo);
      setScore(next.score);
      setCorrect(next.correctCount);
      return next;
    },
    [round.length],
  );

  const finishHit = useCallback(
    (next: ReturnType<typeof applyArcadeHit>) => {
      setFlash(null);
      setHitCopy('');
      if (next.status === 'running') {
        qIndexRef.current = next.qIndex;
        setQIndex(next.qIndex);
        resetGatesFor(next.qIndex);
        return;
      }
      if (next.status === 'over') playGameOver();
      setStatus(next.status === 'won' ? 'won' : 'over');
    },
    [resetGatesFor],
  );

  const resolveObstacleHit = useCallback((kind: CityObstacle['kind']) => {
    if (statusRef.current !== 'running') return;
    const now = performance.now();
    if (now < invulnUntilRef.current) return;
    invulnUntilRef.current = now + CITY_INVULN_MS;
    setInvuln(true);
    setTimeout(() => setInvuln(false), CITY_INVULN_MS);
    setFlash('bad');
    setHitCopy(OBSTACLE_COPY[kind]);
    playGameLifeLost();
    const next = applyArcadeLifeLoss({ lives: livesRef.current, combo: comboRef.current });
    livesRef.current = next.lives;
    comboRef.current = next.combo;
    setLives(next.lives);
    setCombo(next.combo);
    setTimeout(() => {
      setFlash(null);
      setHitCopy('');
    }, CITY_FLASH_MS);
    if (next.status === 'over') {
      playGameOver();
      setStatus('over');
    }
  }, []);

  const resolveHit = useCallback(() => {
    const q = questionRef.current;
    if (resolvingRef.current || statusRef.current !== 'running' || !q) return;
    resolvingRef.current = true;
    const choiceLane = CITY_LANES.indexOf(laneRef.current);
    const choices = gateChoicesRef.current;
    const picked = choices[choiceLane] ?? choices[1];
    const ok = picked === q.answer;
    const label = gateLabelsRef.current[choiceLane] || picked;
    setFlash(ok ? 'good' : 'bad');
    setHitCopy(ok ? `Ran into ${label}` : `Wrong — ${label}`);
    playGameHit(ok);
    const next = advance(ok);
    setTimeout(() => finishHit(next), CITY_FLASH_MS);
  }, [advance, finishHit]);

  const resolveHitRef = useRef(resolveHit);
  const resolveObstacleHitRef = useRef(resolveObstacleHit);
  resolveHitRef.current = resolveHit;
  resolveObstacleHitRef.current = resolveObstacleHit;

  useEffect(() => {
    if (status !== 'running') return undefined;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (statusRef.current !== 'running') return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      runDistRef.current += speedRef.current * dt;
      camDistRef.current = cityCamFollow(runDistRef.current, camDistRef.current, dt);
      approachRef.current = runDistRef.current - segmentStartRef.current;
      setCamDist(camDistRef.current);

      for (const obs of obstaclesRef.current) {
        if (resolvedObstaclesRef.current.has(obs.id)) continue;
        if (runDistRef.current < obs.worldAt) continue;
        resolvedObstaclesRef.current.add(obs.id);
        if (now >= invulnUntilRef.current && cityObstacleCoversLane(obs, laneRef.current)) {
          resolveObstacleHitRef.current(obs.kind);
          break;
        }
      }

      if (approachRef.current >= CITY_HIT_AT) {
        resolveHitRef.current();
      }

      if (statusRef.current === 'running') {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status]);

  const pickLane = useCallback((nextLane: number) => {
    if (statusRef.current === 'over' || statusRef.current === 'won') return;
    if (nextLane !== laneRef.current) playGameLaneChange();
    laneRef.current = nextLane;
    setLane(nextLane);
  }, []);

  const moveLane = useCallback((dir: number) => {
    pickLane(Math.max(-1, Math.min(1, laneRef.current + dir)));
  }, [pickLane]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 22,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 28) return;
        moveLane(g.dx < 0 ? -1 : 1);
      },
    }),
  ).current;

  const restart = () => {
    setLane(0);
    laneRef.current = 0;
    qIndexRef.current = 0;
    setQIndex(0);
    livesRef.current = CITY_START_LIVES;
    comboRef.current = 1;
    scoreRef.current = 0;
    correctRef.current = 0;
    setLives(CITY_START_LIVES);
    setScore(0);
    setCombo(1);
    setCorrect(0);
    setStatus('running');
    setFlash(null);
    setHitCopy('');
    setInvuln(false);
    invulnUntilRef.current = 0;
    runDistRef.current = 0;
    camDistRef.current = -CITY_CAM_FOLLOW;
    setCamDist(-CITY_CAM_FOLLOW);
    resetGatesFor(0);
  };

  const onSceneLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSceneSize({ w: width, h: height });
  };

  const gateWidth = Math.min(sceneSize.w * 0.3, 168) || 118;
  const hudTop = Math.max(insets.top, 10) + 56;
  const gateLayout = cityFollowLayout(cityGateWorldAt(segmentStartRef.current), camDist);
  const showGates = gateLayout.opacity > 0.04;

  if (!question && status === 'running') return null;

  return (
    <StudyGameShell
      title="City Run"
      subtitle="Run into the answer in your lane"
      lives={lives}
      score={score}
      combo={combo}
      onExit={onExit}
      theme="city"
    >
      <View
        style={[
          styles.scene,
          flash === 'good' && styles.sceneGood,
          flash === 'bad' && styles.sceneBad,
        ]}
        onLayout={onSceneLayout}
        {...pan.panHandlers}
      >
        <LinearGradient
          colors={['#3d9fd0', '#8fd0ee', '#d7ecc4', '#b7c98a']}
          locations={[0, 0.28, 0.36, 1]}
          style={StyleSheet.absoluteFill}
        />
        <CityWorld width={sceneSize.w} height={sceneSize.h} camDist={camDist} />

        <View style={[styles.hud, { top: hudTop }]} pointerEvents="none">
          <View style={styles.cloze}>
            <Text style={styles.clozeText}>{question?.prompt || ''}</Text>
          </View>
          <Text style={styles.hint}>Run into the correct lane</Text>
        </View>

        <View style={styles.roadLayer} pointerEvents="box-none">
          {obstacles.map((obs) => {
            const layout = cityFollowLayout(obs.worldAt, camDist);
            if (layout.opacity <= 0.03) return null;
            const mid = obs.lanes[0] ?? 0;
            const width = Math.max(44, gateWidth * layout.scale);
            return (
              <View
                key={obs.id}
                pointerEvents="none"
                style={[
                  styles.obstacle,
                  {
                    top: `${layout.topPct}%`,
                    left: `${cityLaneOffsetPct(mid, layout.laneSpread)}%`,
                    width,
                    marginLeft: -width / 2,
                    opacity: layout.opacity,
                    transform: [{ scale: layout.scale }],
                    zIndex: Math.round(12 + layout.topPct),
                  },
                ]}
              >
                <ObstacleBody />
              </View>
            );
          })}

          {showGates
            ? gateChoices.map((choice, i) => {
                const on = CITY_LANES[i] === lane;
                const width = Math.max(58, gateWidth * gateLayout.scale);
                return (
                  <Pressable
                    key={`${qIndex}-${i}-${choice.slice(0, 24)}`}
                    style={[
                      styles.gate,
                      on && styles.gateTarget,
                      {
                        top: `${gateLayout.topPct}%`,
                        left: `${cityLaneOffsetPct(CITY_LANES[i], gateLayout.laneSpread)}%`,
                        width,
                        marginLeft: -width / 2,
                        opacity: gateLayout.opacity,
                        transform: [{ scale: gateLayout.scale }],
                        zIndex: Math.round(14 + gateLayout.topPct),
                      },
                    ]}
                    onPress={() => pickLane(CITY_LANES[i])}
                  >
                    <View style={[styles.gateBadge, on && styles.gateBadgeOn]}>
                      <Text style={[styles.gateBadgeText, on && styles.gateBadgeTextOn]}>
                        {CITY_LANE_BADGES[i]}
                      </Text>
                    </View>
                    <Text style={styles.gateText} numberOfLines={4}>
                      {gateLabels[i] || choice}
                    </Text>
                  </Pressable>
                );
              })
            : null}

          <View
            style={[
              styles.runner,
              invuln && styles.runnerInvuln,
              {
                left: `${cityLaneOffsetPct(lane, CITY_LANE_SPREAD_PCT)}%`,
              },
            ]}
          >
            <View style={styles.runnerHead} />
            <LinearGradient colors={['#8fb89a', '#3d5646']} style={styles.runnerTorso} />
            <View style={styles.runnerLegs}>
              <View style={styles.runnerLeg} />
              <View style={styles.runnerLeg} />
            </View>
            <View style={styles.runnerShadow} />
          </View>
        </View>

        {flash ? (
          <View style={[styles.hitMsg, flash === 'good' ? styles.hitGood : styles.hitBad]}>
            <Text style={styles.hitText}>{hitCopy || (flash === 'good' ? 'Clean lane!' : 'Hit an obstacle!')}</Text>
          </View>
        ) : null}
      </View>

      {(status === 'over' || status === 'won') && (
        <GameOverOverlay
          won={status === 'won'}
          score={score}
          correct={correct}
          total={round.length}
          onRetry={restart}
          onExit={onExit}
          title={status === 'won' ? 'City cleared' : 'Wiped out'}
          brand="#5f7f6a"
        />
      )}
    </StudyGameShell>
  );
};

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    overflow: 'hidden',
  },
  sceneGood: { borderColor: '#5f8f6e', borderWidth: 2 },
  sceneBad: { borderColor: '#9f3d3d', borderWidth: 2 },
  hud: {
    position: 'absolute',
    zIndex: 7,
    left: 8,
    right: 8,
    gap: 6,
  },
  cloze: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(95, 127, 106, 0.28)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#1A2F23',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  clozeText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 15,
    lineHeight: 21,
    color: '#14241a',
    textAlign: 'center',
  },
  hint: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: 'rgba(20, 36, 26, 0.62)',
    color: '#fff',
    fontFamily: Fonts.ui.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  roadLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '24%',
    bottom: 0,
    zIndex: 4,
  },
  gate: {
    position: 'absolute',
    minHeight: 52,
    backgroundColor: '#fff',
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#5f7f6a',
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    shadowColor: '#1A2F23',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  gateTarget: {
    backgroundColor: '#e8f0ea',
    borderColor: '#5f7f6a',
    shadowColor: '#5f7f6a',
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  gateBadge: {
    borderRadius: 999,
    backgroundColor: '#eef4f0',
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 4,
    minWidth: 28,
    alignItems: 'center',
  },
  gateBadgeOn: { backgroundColor: '#5f7f6a' },
  gateBadgeText: {
    fontFamily: Fonts.ui.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#3d5646',
  },
  gateBadgeTextOn: { color: '#fff' },
  gateText: {
    fontFamily: Fonts.ui.bold,
    fontSize: 12,
    lineHeight: 16,
    color: '#14241a',
    textAlign: 'center',
  },
  obstacle: {
    position: 'absolute',
    zIndex: 5,
    alignItems: 'center',
    transformOrigin: 'center bottom',
  },
  train: {
    width: '100%',
    height: 86,
    borderRadius: 8,
    backgroundColor: '#3d4a44',
    borderWidth: 2,
    borderColor: '#1a241f',
    overflow: 'hidden',
    shadowColor: '#1A2F23',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  trainRoof: {
    height: 8,
    backgroundColor: '#2a3330',
  },
  trainCab: {
    height: 16,
    backgroundColor: '#c45a3a',
  },
  trainWindows: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 10,
  },
  trainWindow: {
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: '#c5d6cb',
  },
  trainBumper: {
    marginTop: 'auto',
    height: 8,
    backgroundColor: '#1a1a1a',
  },
  runner: {
    position: 'absolute',
    bottom: '7%',
    width: 52,
    marginLeft: -26,
    zIndex: 8,
    alignItems: 'center',
  },
  runnerInvuln: { opacity: 0.45 },
  runnerHead: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#f3e6d4',
    borderWidth: 2,
    borderColor: '#3d5646',
  },
  runnerTorso: {
    width: 24,
    height: 26,
    marginTop: -2,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2a3d32',
  },
  runnerLegs: {
    flexDirection: 'row',
    gap: 4,
    marginTop: -1,
  },
  runnerLeg: {
    width: 6,
    height: 14,
    borderRadius: 2,
    backgroundColor: '#2a3330',
  },
  runnerShadow: {
    marginTop: 4,
    width: 32,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(26, 47, 35, 0.25)',
  },
  hitMsg: {
    position: 'absolute',
    alignSelf: 'center',
    top: '48%',
    zIndex: 12,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 2,
  },
  hitGood: { backgroundColor: '#d7eadc', borderColor: '#5f8f6e' },
  hitBad: { backgroundColor: '#f0d8d8', borderColor: '#9f3d3d' },
  hitText: { fontFamily: Fonts.ui.bold, fontSize: 16, color: '#102418' },
});

export default CityRunGame;
