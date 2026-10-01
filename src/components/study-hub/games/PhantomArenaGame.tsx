import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  applyArcadeHit,
  padPhantomChoices,
  phantomFieldFromChoices,
  phantomTimerLimit,
  PHANTOM_HIT_SCORE,
  PHANTOM_START_LIVES,
  pickPhantomRound,
  stepPhantomNode,
} from '@shared/study-games/index.js';
import { Fonts } from '@/config/fonts';
import { playGameHit, playGameOver } from '@/study-hub/gameFeedback';
import { GameOverOverlay, StudyGameShell } from './StudyGameShell';

type GameItem = {
  id: string;
  prompt: string;
  answer: string;
  choices: string[];
  choiceLabels?: string[];
};

type FieldNode = {
  id: string;
  text: string;
  label: string;
  x: number;
  y: number;
  drift: number;
};

type PhantomArenaGameProps = {
  items: GameItem[];
  onExit: () => void;
};

export const PhantomArenaGame: React.FC<PhantomArenaGameProps> = ({ items, onExit }) => {
  const insets = useSafeAreaInsets();
  const round = useMemo(() => pickPhantomRound(items) as GameItem[], [items]);
  const allAnswers = useMemo(
    () => [...new Set(items.map((item) => item.answer))],
    [items],
  );
  const [qIndex, setQIndex] = useState(0);
  const [lives, setLives] = useState(PHANTOM_START_LIVES);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [correctCount, setCorrectCount] = useState(0);
  const [status, setStatus] = useState<'running' | 'flash' | 'over' | 'won'>('running');
  const [timer, setTimer] = useState(1);
  const [field, setField] = useState<FieldNode[]>([]);
  const [pulse, setPulse] = useState<'good' | 'bad' | null>(null);
  const livesRef = useRef(PHANTOM_START_LIVES);
  const resolvingRef = useRef(false);

  const question = round[qIndex];

  const advanceAfter = useCallback(
    (ok: boolean) => {
      const next = applyArcadeHit({
        lives: livesRef.current,
        combo,
        score,
        correctCount,
        qIndex,
        roundLength: round.length,
        wasCorrect: ok,
        pointsPerHit: PHANTOM_HIT_SCORE,
      });
      livesRef.current = next.lives;
      setLives(next.lives);
      setCombo(next.combo);
      setScore(next.score);
      setCorrectCount(next.correctCount);
      setQIndex(next.qIndex);
      setPulse(null);
      resolvingRef.current = false;
      if (next.status === 'running') {
        setStatus('running');
        return;
      }
      if (next.status === 'over') playGameOver();
      setStatus(next.status === 'won' ? 'won' : 'over');
    },
    [combo, correctCount, qIndex, round.length, score],
  );

  useEffect(() => {
    if (!question) return;
    resolvingRef.current = false;
    const choices = padPhantomChoices(question, allAnswers);
    setField(phantomFieldFromChoices(choices, qIndex) as FieldNode[]);
    setTimer(1);
  }, [question, qIndex, allAnswers]);

  useEffect(() => {
    if (status !== 'running') return undefined;
    let raf = 0;
    let last = performance.now();
    const limit = phantomTimerLimit(qIndex);
    let t = 1;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t -= dt / limit;
      setTimer(Math.max(0, t));
      setField((prev) => prev.map((node) => stepPhantomNode(node, dt, now) as FieldNode));
      if (t <= 0 && !resolvingRef.current) {
        resolvingRef.current = true;
        setPulse('bad');
        setStatus('flash');
        playGameHit(false);
        setTimeout(() => advanceAfter(false), 400);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [advanceAfter, status, qIndex]);

  const onPick = (text: string) => {
    if (status !== 'running' || !question || resolvingRef.current) return;
    resolvingRef.current = true;
    const ok = text === question.answer;
    setPulse(ok ? 'good' : 'bad');
    setStatus('flash');
    playGameHit(ok);
    setTimeout(() => advanceAfter(ok), 420);
  };

  const restart = () => {
    livesRef.current = PHANTOM_START_LIVES;
    resolvingRef.current = false;
    setQIndex(0);
    setLives(PHANTOM_START_LIVES);
    setScore(0);
    setCombo(1);
    setCorrectCount(0);
    setStatus('running');
    setPulse(null);
  };

  const promptTop = Math.max(insets.top, 10) + 52;

  return (
    <StudyGameShell
      title="Phantom Arena"
      subtitle="Tap the phrase that fills the blank"
      lives={lives}
      score={score}
      combo={combo}
      onExit={onExit}
      theme="phantom"
    >
      <View
        style={[
          styles.scene,
          pulse === 'good' && styles.sceneGood,
          pulse === 'bad' && styles.sceneBad,
        ]}
      >
        <View style={[styles.timer, { width: `${Math.max(0, timer) * 100}%` }]} />
        <View style={[styles.promptWrap, { paddingTop: promptTop }]}>
          <View style={styles.core}>
            <Text style={styles.cloze}>{question?.prompt || ''}</Text>
          </View>
        </View>
        <View style={styles.playfield}>
          <View style={styles.boss} pointerEvents="none" />
          <View style={[styles.spark, { top: '18%', left: '12%' }]} pointerEvents="none" />
          <View style={[styles.spark, { top: '42%', right: '16%', width: 8, height: 8 }]} pointerEvents="none" />
          {field.map((node) => (
            <Pressable
              key={node.id}
              disabled={status !== 'running'}
              onPress={() => onPick(node.text)}
              style={[styles.token, { left: `${node.x}%`, top: `${node.y}%` }]}
            >
              <Text style={styles.tokenText} numberOfLines={2}>
                {node.label || node.text}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {(status === 'over' || status === 'won') && (
        <GameOverOverlay
          won={status === 'won'}
          score={score}
          correct={correctCount}
          total={round.length}
          onRetry={restart}
          onExit={onExit}
          title={status === 'won' ? 'Arena cleared' : 'You faded'}
          brand="#b45a5a"
        />
      )}
    </StudyGameShell>
  );
};

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    backgroundColor: '#1a221e',
  },
  sceneGood: { borderColor: '#5f8f6e', borderWidth: 2 },
  sceneBad: { borderColor: '#b45a5a', borderWidth: 2 },
  timer: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 4,
    backgroundColor: '#b45a5a',
    zIndex: 8,
  },
  promptWrap: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    zIndex: 6,
  },
  core: {
    backgroundColor: 'rgba(18, 24, 22, 0.92)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(180, 90, 90, 0.38)',
    padding: 14,
  },
  cloze: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 16,
    lineHeight: 22,
    color: '#f4f0f0',
  },
  playfield: {
    flex: 1,
    position: 'relative',
    minHeight: 180,
  },
  boss: {
    position: 'absolute',
    left: '50%',
    top: '42%',
    marginLeft: -36,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#5a2f2f',
    opacity: 0.35,
  },
  spark: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e8c07a',
  },
  token: {
    position: 'absolute',
    width: 104,
    marginLeft: -52,
    marginTop: -20,
    backgroundColor: '#2a3330',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(232, 192, 122, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    zIndex: 5,
  },
  tokenText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: '#f4f0f0',
    textAlign: 'center',
  },
});

export default PhantomArenaGame;
