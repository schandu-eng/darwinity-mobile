import { pickRoundItems } from './groups.js';

export const CITY_LANES = [-1, 0, 1];
export const CITY_LANE_BADGES = ['Left', 'Middle', 'Right'];
export const CITY_LANE_SPREAD_PCT = 26;
export const CITY_FAR_LANE_SPREAD_PCT = 17;
export const CITY_HIT_AT = 0.9;
export const CITY_GATE_REVEAL_AT = 0;
export const CITY_TRAVEL = 0.5;
export const CITY_ROUND_SIZE = 14;
export const CITY_START_LIVES = 3;
export const CITY_HIT_SCORE = 100;
export const CITY_OBSTACLE_KIND = 'train';
export const CITY_OBSTACLE_KINDS = [CITY_OBSTACLE_KIND];

export const PHANTOM_ROUND_SIZE = 12;
export const PHANTOM_START_LIVES = 3;
export const PHANTOM_HIT_SCORE = 110;
export const PHANTOM_FIELD_SIZE = 6;

export function padCityGates(question) {
  const choices = [...(question?.choices || [])];
  const labels = [...(question?.choiceLabels || choices)];
  while (choices.length < 3) {
    choices.push(choices[choices.length - 1] || '…');
    labels.push(labels[labels.length - 1] || '…');
  }
  return {
    choices: choices.slice(0, 3),
    labels: labels.slice(0, 3),
  };
}

export function cityApproachSpeed(qIndex) {
  return 0.16 + Math.min(0.05, Number(qIndex) * 0.004);
}

export function cityGatesVisible() {
  return true;
}

export function cityPhase() {
  return 'answer';
}

/**
 * Behind-the-runner camera: t=0 is down-track, t=1 is at the runner's feet.
 * Far lanes stay wide so hazards sit on the road instead of popping from a point.
 */
export function cityDepthLayout(t) {
  const p = Math.max(0, Math.min(1.1, Number(t) || 0));
  const u = Math.min(1, p);
  const eased = u * 0.62 + u * u * 0.38;
  return {
    gateTop: 14 + eased * 72,
    gateScale: 0.52 + u * 0.68,
    gateOpacity: u < 0.03 ? u / 0.03 : p > 1 ? Math.max(0, 1 - (p - 1) * 12) : 1,
    laneSpread: CITY_FAR_LANE_SPREAD_PCT + u * (CITY_LANE_SPREAD_PCT - CITY_FAR_LANE_SPREAD_PCT),
  };
}

export function cityLaneOffsetPct(lane, spread = CITY_LANE_SPREAD_PCT) {
  return 50 + Number(lane) * Number(spread);
}

export const CITY_TRACK_PX = 900;
export const CITY_NEAR_Y = 12000;
export const CITY_CAM_FOLLOW = 0.07;
export const CITY_LANE_X_PCT = 22;
/** World units mapped onto the visible road. Trains and answers share this. */
export const CITY_VIEW_FAR = 1.15;

export function cityTrackPx(dist) {
  return Number(dist) * CITY_TRACK_PX;
}

/** Y on the long 3D strip: smaller as you run, toward the horizon. */
export function cityStripY(dist) {
  return CITY_NEAR_Y - cityTrackPx(dist);
}

export function cityCamFollow(runDist, camDist, dt) {
  const target = Number(runDist) - CITY_CAM_FOLLOW;
  return Number(camDist) + (target - Number(camDist)) * Math.min(1, Math.max(0, dt) * 2.7);
}

export function placeCityObstacles(qIndex, segmentStart) {
  const start = Number(segmentStart) || 0;
  return spawnCityObstacles(qIndex).map((obs) => ({
    ...obs,
    worldAt: start + obs.hitAt,
  }));
}

export function cityGateWorldAt(segmentStart) {
  return Number(segmentStart) + CITY_HIT_AT;
}

/**
 * 2D billboard placement over the 3D road.
 * Linear in world distance so trains and answers move at the same speed.
 * Scale shrinks with distance so cards sit on the track instead of filling the screen.
 */
export function cityFollowLayout(worldDist, camDist) {
  const ahead = Number(worldDist) - Number(camDist);
  const far = CITY_VIEW_FAR;
  const t = ahead / far;
  const u = Math.max(0, Math.min(1, 1 - t));
  return {
    topPct: 14 + u * 68,
    scale: 0.28 + u * 0.8,
    laneSpread: CITY_FAR_LANE_SPREAD_PCT + u * (CITY_LANE_SPREAD_PCT - CITY_FAR_LANE_SPREAD_PCT),
    opacity: t < -0.05 ? 0 : t > 1.08 ? Math.max(0, 1 - (t - 1) * 8) : 1,
  };
}

export function cityGateLayout(approach) {
  if (!cityGatesVisible(approach)) {
    return { gateTop: 14, gateScale: 0.5, gateOpacity: 0, laneSpread: CITY_FAR_LANE_SPREAD_PCT };
  }
  const span = Math.max(0.01, CITY_HIT_AT - CITY_GATE_REVEAL_AT);
  return cityDepthLayout((Number(approach) - CITY_GATE_REVEAL_AT) / span);
}

/**
 * One train per question so the checkpoint is reachable, then the next prompt.
 */
export function spawnCityObstacles(qIndex) {
  const idx = Math.max(0, Number(qIndex) || 0);
  const lane = CITY_LANES[idx % CITY_LANES.length];
  return [{
    id: `obs-${idx}-0`,
    kind: CITY_OBSTACLE_KIND,
    lanes: [lane],
    hitAt: 0.48,
  }];
}

export function cityObstacleLayout(approach, hitAt) {
  const start = Number(hitAt) - CITY_TRAVEL;
  const t = (Number(approach) - start) / CITY_TRAVEL;
  if (t < 0) {
    return { gateTop: 14, gateScale: 0.5, gateOpacity: 0, laneSpread: CITY_FAR_LANE_SPREAD_PCT };
  }
  return cityDepthLayout(t);
}

export function cityObstacleCoversLane(obstacle, lane) {
  return (obstacle?.lanes || []).includes(lane);
}

/** Life loss that does not advance the question (dodging trains). */
export function applyArcadeLifeLoss({ lives, combo }) {
  const nextLives = Math.max(0, lives - 1);
  return {
    lives: nextLives,
    combo: 1,
    status: nextLives <= 0 ? 'over' : 'running',
  };
}

/**
 * Lives/score after a City Run or Phantom hit.
 * Dying always wins over finishing the round.
 */
export function applyArcadeHit({
  lives,
  combo,
  score,
  correctCount,
  qIndex,
  roundLength,
  wasCorrect,
  pointsPerHit,
}) {
  let nextLives = lives;
  let nextCombo = combo;
  let nextScore = score;
  let nextCorrect = correctCount;
  let status = 'running';

  if (wasCorrect) {
    nextCorrect += 1;
    nextScore += pointsPerHit * combo;
    nextCombo += 1;
  } else {
    nextCombo = 1;
    nextLives = Math.max(0, lives - 1);
    if (nextLives <= 0) status = 'over';
  }

  const nextIdx = qIndex + 1;
  if (status !== 'over' && nextIdx >= roundLength) {
    return {
      lives: nextLives,
      combo: nextCombo,
      score: nextScore,
      correctCount: nextCorrect,
      qIndex,
      status: 'won',
    };
  }

  return {
    lives: nextLives,
    combo: nextCombo,
    score: nextScore,
    correctCount: nextCorrect,
    qIndex: status === 'running' ? nextIdx : qIndex,
    status,
  };
}

export function padPhantomChoices(question, allAnswers) {
  const base = [...(question?.choices || [])];
  const labels = [...(question?.choiceLabels || base.map((t) => t))];
  const need = PHANTOM_FIELD_SIZE - base.length;
  if (need > 0) {
    const extras = (allAnswers || []).filter(
      (a) => !base.some((b) => String(b).toLowerCase() === String(a).toLowerCase()),
    );
    extras.slice(0, need).forEach((text) => {
      base.push(text);
      labels.push(text.length > 72 ? `${text.slice(0, 71).trimEnd()}…` : text);
    });
  }
  return base.slice(0, PHANTOM_FIELD_SIZE).map((text, i) => ({
    text,
    label: labels[i] || text,
  }));
}

/** Token positions are % of the playfield below the prompt — never the question band. */
export const PHANTOM_FIELD_BOUNDS = {
  minX: 16,
  maxX: 84,
  minY: 20,
  maxY: 84,
};

export function phantomFieldFromChoices(choices, qIndex) {
  const colXs = [20, 50, 80];
  const rowYs = [30, 70];
  return (choices || []).slice(0, PHANTOM_FIELD_SIZE).map((entry, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3) % 2;
    const jitterX = (((Number(qIndex) + i * 5) % 5) - 2) * 1.2;
    const jitterY = (((Number(qIndex) * 3 + i) % 5) - 2) * 1.1;
    return {
      id: `${qIndex}-${i}-${entry.text}`,
      text: entry.text,
      label: entry.label,
      x: colXs[col] + jitterX,
      y: rowYs[row] + jitterY,
      drift: (i % 2 === 0 ? 1 : -1) * (0.2 + (i % 3) * 0.07),
    };
  });
}

export function stepPhantomNode(node, dt, now) {
  return {
    ...node,
    x: Math.max(
      PHANTOM_FIELD_BOUNDS.minX,
      Math.min(PHANTOM_FIELD_BOUNDS.maxX, node.x + node.drift * dt * 10),
    ),
    y: Math.max(
      PHANTOM_FIELD_BOUNDS.minY,
      Math.min(
        PHANTOM_FIELD_BOUNDS.maxY,
        node.y + Math.sin(now / 520 + node.x) * dt * 5,
      ),
    ),
  };
}

export function phantomTimerLimit(qIndex) {
  return Math.max(3.8, 6.5 - qIndex * 0.15);
}

export function pickCityRound(items) {
  return pickRoundItems(items, CITY_ROUND_SIZE);
}

export function pickPhantomRound(items) {
  return pickRoundItems(items, PHANTOM_ROUND_SIZE);
}
