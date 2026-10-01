import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildTypingRaceText,
  charsMatch,
  formatTypingTime,
  highlightSetFingerprint,
  loadTypingBestMs,
  saveTypingBestMs,
  typingRushStorageKey,
} from '@shared/study-games/index.js';
import { Fonts } from '@/config/fonts';
import { playGameHit, playGameTypingError } from '@/study-hub/gameFeedback';
import { GameOverOverlay, StudyGameShell } from './StudyGameShell';

type GameItem = {
  id: string;
  prompt: string;
  answer: string;
  choices: string[];
};

type TypingRushGameProps = {
  items: GameItem[];
  contentId?: number | string | null;
  onExit: () => void;
};

class MemoryStorage {
  private cache = new Map<string, string>();

  getItem(key: string) {
    return this.cache.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.cache.set(key, value);
    void AsyncStorage.setItem(key, value);
  }

  hydrate(key: string, value: string | null) {
    if (value) this.cache.set(key, value);
  }
}

export const TypingRushGame: React.FC<TypingRushGameProps> = ({ items, contentId, onExit }) => {
  const fingerprint = useMemo(() => highlightSetFingerprint(items), [items]);
  const raceText = useMemo(() => buildTypingRaceText(items), [items]);
  const storageRef = useRef(new MemoryStorage());

  const [bestMs, setBestMs] = useState(0);
  const [typed, setTyped] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [status, setStatus] = useState<'ready' | 'running' | 'done'>('ready');
  const [lastMs, setLastMs] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const startedAtRef = useRef<number | null>(null);
  const typedRef = useRef('');

  useEffect(() => {
    const key = typingRushStorageKey(contentId, fingerprint);
    let cancelled = false;
    AsyncStorage.getItem(key).then((raw) => {
      if (cancelled) return;
      storageRef.current.hydrate(key, raw);
      setBestMs(loadTypingBestMs(contentId, fingerprint, storageRef.current));
    });
    setTyped('');
    typedRef.current = '';
    setStartedAt(null);
    startedAtRef.current = null;
    setElapsedMs(0);
    setStatus(raceText ? 'ready' : 'done');
    setLastMs(0);
    setIsNewBest(false);
    return () => {
      cancelled = true;
    };
  }, [contentId, fingerprint, raceText]);

  useEffect(() => {
    if (status !== 'running' || !startedAt) return undefined;
    let raf = 0;
    const tick = () => {
      setElapsedMs(Math.max(0, performance.now() - startedAt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, startedAt]);

  const finish = (finalTyped: string) => {
    const start = startedAtRef.current;
    if (!start) return;
    const ms = Math.max(1, Math.round(performance.now() - start));
    setElapsedMs(ms);
    setLastMs(ms);
    setStatus('done');
    const prev = loadTypingBestMs(contentId, fingerprint, storageRef.current);
    const next = saveTypingBestMs(contentId, fingerprint, ms, storageRef.current);
    setBestMs(next);
    setIsNewBest(prev <= 0 || ms < prev);
    setTyped(finalTyped);
    typedRef.current = finalTyped;
  };

  const onChange = (value: string) => {
    if (!raceText || status === 'done') return;
    if (!startedAtRef.current) {
      const now = performance.now();
      startedAtRef.current = now;
      setStartedAt(now);
      setStatus('running');
    }
    let next = value;
    if (next.length > raceText.length) next = next.slice(0, raceText.length);
    typedRef.current = next;
    setTyped(next);
    const last = next[next.length - 1];
    const expected = raceText[next.length - 1];
    if (last != null && expected != null && !charsMatch(last, expected)) {
      playGameTypingError();
    }
    if (charsMatch(next, raceText) && next.length === raceText.length) {
      playGameHit(true);
      finish(next);
    }
  };

  const restart = () => {
    setTyped('');
    typedRef.current = '';
    setStartedAt(null);
    startedAtRef.current = null;
    setElapsedMs(0);
    setLastMs(0);
    setIsNewBest(false);
    setStatus(raceText ? 'ready' : 'done');
    setBestMs(loadTypingBestMs(contentId, fingerprint, storageRef.current));
    setTimeout(() => inputRef.current?.focus(), 40);
  };

  const caret = typed.length;
  const chars = raceText.split('');
  const hasError = typed.split('').some((ch, i) => !charsMatch(ch, raceText[i]));
  const live = formatTypingTime(status === 'done' ? lastMs : elapsedMs);

  return (
    <StudyGameShell
      title="Typing Rush"
      subtitle="Type your study phrases as fast as you can"
      onExit={onExit}
      theme="orbit"
      footer={
        <View style={styles.footerRow}>
          <Text style={styles.footerStat}>Live {live}</Text>
          <Text style={styles.footerStat}>Best {formatTypingTime(bestMs)}</Text>
          <TouchableOpacity onPress={restart}>
            <Text style={styles.restart}>Restart</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <View style={styles.scene}>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Time</Text>
            <Text style={styles.statValue}>{live}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Best</Text>
            <Text style={styles.statValue}>{formatTypingTime(bestMs)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Progress</Text>
            <Text style={styles.statValue}>
              {raceText ? Math.min(100, Math.round((caret / raceText.length) * 100)) : 0}%
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.board, hasError && styles.boardError]}
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}
        >
          <ScrollView
            style={styles.boardScroll}
            contentContainerStyle={styles.boardScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
          >
            {!raceText ? (
              <Text style={styles.empty}>Nothing to type yet. Pick notes or a flashcard set.</Text>
            ) : (
              <View style={styles.raceWrap}>
                {chars.map((ch, i) => {
                  let color = '#9aa8a4';
                  if (i < typed.length) color = charsMatch(typed[i], ch) ? '#1f4f4a' : '#9f3d3d';
                  else if (i === caret) color = '#3d8a80';
                  return (
                    <Text key={`${ch}-${i}`} style={[styles.ch, { color }, i === caret && styles.caret]}>
                      {ch}
                    </Text>
                  );
                })}
              </View>
            )}
          </ScrollView>
          <TextInput
            ref={inputRef}
            value={typed}
            onChangeText={onChange}
            autoCapitalize="none"
            autoCorrect={false}
            caretHidden
            style={styles.hiddenInput}
            autoFocus
          />
        </TouchableOpacity>
      </View>

      {status === 'done' && raceText ? (
        <GameOverOverlay
          won
          score={formatTypingTime(lastMs)}
          onRetry={restart}
          onExit={onExit}
          title={isNewBest ? 'New best time' : 'Race complete'}
          brand="#3d8a80"
        />
      ) : null}
    </StudyGameShell>
  );
};

const styles = StyleSheet.create({
  scene: { flex: 1, paddingHorizontal: 12, paddingTop: 64, paddingBottom: 6 },
  stats: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  stat: {
    flex: 1,
    backgroundColor: '#d4ebe7',
    borderRadius: 12,
    padding: 10,
  },
  statLabel: {
    fontFamily: Fonts.ui.bold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#1f4f4a',
  },
  statValue: { fontFamily: Fonts.ui.semiBold, fontSize: 15, color: '#14241a', marginTop: 2 },
  board: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(61, 138, 128, 0.22)',
    overflow: 'hidden',
  },
  boardError: { borderColor: '#9f3d3d' },
  boardScroll: { flex: 1 },
  boardScrollContent: { padding: 14, paddingBottom: 64 },
  empty: { fontFamily: Fonts.ui.regular, fontSize: 15, color: '#71717a' },
  raceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  ch: { fontFamily: Fonts.ui.medium, fontSize: 16, lineHeight: 24 },
  caret: {
    textDecorationLine: 'underline',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0.02,
    height: 40,
    left: 0,
    right: 0,
    bottom: 8,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerStat: { fontFamily: Fonts.ui.medium, fontSize: 13, color: '#1f4f4a' },
  restart: { fontFamily: Fonts.ui.semiBold, fontSize: 13, color: '#3d8a80' },
});

export default TypingRushGame;
