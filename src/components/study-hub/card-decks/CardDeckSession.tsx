import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import type { FlashcardV2 } from '@/api/schemas/cardDecksV2';
import { cardDeckV2Service } from '@/services/cardDeckV2Service';
import { PanelSkeleton } from '@/components/ui/skeleton';
import CardDeckFlipCard from './CardDeckFlipCard';
import {
  ratingHintsFromPreviews,
  isDueRevisionCard,
  isNewStudyCard,
} from './cardDeckAnkiHints';
import {
  applyOptimisticGrade,
  previewSuggestsRequeue,
  reconcileOptimisticGrade,
} from './flashcardOptimisticGrade';
import { useConcentrationSessionOptional } from '@/features/concentration/ConcentrationSessionProvider';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import { playCardDeckGradeFeedback } from '@/study-hub/quizAnswerFeedback';

import { Fonts } from '@/config/fonts';

const RATINGS = [
  { value: 1, label: 'Again', hint: "Didn't know", bg: '#FEE2E2', text: '#991B1B' },
  { value: 2, label: 'Hard', hint: 'Struggled', bg: '#FFEDD5', text: '#9A3412' },
  { value: 3, label: 'Good', hint: 'Got it', bg: '#DBEAFE', text: '#1E40AF' },
  { value: 4, label: 'Easy', hint: 'Too easy', bg: '#DCFCE7', text: '#166534' },
];

const sameSessionCard = (a: FlashcardV2 | null | undefined, b: FlashcardV2 | null | undefined) =>
  a?.id === b?.id;

type Props = {
  contentId: number;
  userId: number;
  deckId?: number | null;
  topicIds: number[];
  starredOnly: boolean;
  filterLabel?: string | null;
  onBack: () => void;
  onDeckRefresh?: () => void;
  onStarChange?: (cardId: number, isStarred: boolean) => void;
};

const CardDeckSession: React.FC<Props> = ({
  contentId,
  userId,
  deckId = null,
  topicIds,
  starredOnly,
  filterLabel,
  onBack,
  onDeckRefresh,
  onStarChange,
}) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const [queue, setQueue] = useState<FlashcardV2[]>([]);
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionStartTotal, setSessionStartTotal] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [gradeCounts, setGradeCounts] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const [completed, setCompleted] = useState(false);
  const [sessionNow, setSessionNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const queueRef = useRef<FlashcardV2[]>([]);
  const focus = useConcentrationSessionOptional();
  const sessionEndedRef = useRef(false);
  const reviewCountRef = useRef(0);
  const doneCountRef = useRef(0);
  const gradeCountsRef = useRef<Record<number, number>>({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const gradeInFlightRef = useRef<Set<number>>(new Set());
  const pendingGradesRef = useRef(0);

  const applyQueuePayload = useCallback(
    (data: { queue?: FlashcardV2[] }, gradeResult: { requeue_now?: boolean; card?: FlashcardV2 } | null = null, prevQueue: FlashcardV2[] = []) => {
      let items = data.queue || [];
      const sessionRequeues = prevQueue.filter(
        (c) => c._inSessionRequeue && !items.some((x) => x.id === c.id)
      );
      items = [...items, ...sessionRequeues];

      if (gradeResult?.requeue_now && gradeResult.card) {
        const requeued: FlashcardV2 = { ...gradeResult.card, _inSessionRequeue: true };
        if (!items.some((c) => c.id === requeued.id)) {
          items = [...items, requeued];
        } else {
          items = items.map((c) =>
            c.id === requeued.id ? { ...c, ...requeued, _inSessionRequeue: true } : c
          );
        }
      }

      setQueue(items);
      queueRef.current = items;
      return items;
    },
    []
  );

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await cardDeckV2Service.getStudyQueue(contentId, userId, {
        chapterIds: topicIds,
        starredOnly,
        deckId,
      });
      if (!result.success || !result.data) throw new Error(result.message);
      const items = applyQueuePayload(result.data, null, []);
      setPosition(0);
      setRevealed(false);
      setSessionStartTotal(items.length);
      setDoneCount(0);
      setReviewCount(0);
      setGradeCounts({ 1: 0, 2: 0, 3: 0, 4: 0 });
      setCompleted(items.length === 0);
      if (items.length === 0) sessionEndedRef.current = true;
      analytics.track(EVENTS.CARD_DECK_SESSION_STARTED, {
        content_id: contentId,
        deck_id: deckId ?? undefined,
        queue_size: items.length,
        starred_only: starredOnly,
      });
    } catch (err: any) {
      setError(err.message || 'Could not load study queue');
      setQueue([]);
      setCompleted(true);
      sessionEndedRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [contentId, userId, topicIds, starredOnly, deckId, applyQueuePayload]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    reviewCountRef.current = reviewCount;
  }, [reviewCount]);

  useEffect(() => {
    doneCountRef.current = doneCount;
  }, [doneCount]);

  useEffect(() => {
    gradeCountsRef.current = gradeCounts;
  }, [gradeCounts]);

  useEffect(() => {
    sessionEndedRef.current = false;
    return () => {
      if (!sessionEndedRef.current) {
        analytics.track(EVENTS.CARD_DECK_SESSION_ENDED, {
          content_id: contentId,
          deck_id: deckId ?? undefined,
          reviews: reviewCountRef.current,
          abandoned: true,
        });
      }
    };
  }, [contentId, deckId]);

  const card = queue[position];
  const total = queue.length;
  const nowDate = useMemo(() => new Date(sessionNow), [sessionNow]);
  const ratingHints = useMemo(
    () => ratingHintsFromPreviews(card?.rating_previews),
    [card?.rating_previews]
  );
  const cardIsDueRevision = isDueRevisionCard(card, nowDate);

  const sessionCardTotal = sessionStartTotal || total;
  const sessionCardIndex =
    sessionCardTotal <= 0 ? 0 : Math.min(sessionCardTotal, Math.max(1, reviewCount + 1));
  const progressPercent =
    sessionStartTotal <= 0 ? 0 : Math.min(100, Math.round((reviewCount / sessionStartTotal) * 100));

  const cardStatusLabel = useMemo(() => {
    if (!card) return null;
    if (card._inSessionRequeue) return 'Coming back again';
    if (isNewStudyCard(card)) return 'First look';
    if (cardIsDueRevision) return 'Due today';
    return null;
  }, [card, cardIsDueRevision]);

  useEffect(() => {
    if (completed || loading) return undefined;
    const tick = setInterval(() => setSessionNow(Date.now()), 10000);
    return () => clearInterval(tick);
  }, [completed, loading]);

  useEffect(() => {
    setRevealed(false);
  }, [position, card?.id]);

  const handleGrade = useCallback(
    (rating: number) => {
      if (!card?.id || gradeInFlightRef.current.has(card.id)) return;

      const gradedCard = card;
      const gradedAtPosition = position;
      const snapshotQueue = queueRef.current;
      const snapshotDone = doneCountRef.current;
      const snapshotReview = reviewCountRef.current;
      const snapshotGradeCounts = { ...gradeCountsRef.current };
      const guessedRequeue = previewSuggestsRequeue(gradedCard.rating_previews, rating);

      gradeInFlightRef.current.add(gradedCard.id);
      pendingGradesRef.current += 1;
      setError('');
      playCardDeckGradeFeedback(rating);

      const nextQueue = applyOptimisticGrade({
        queue: snapshotQueue,
        index: gradedAtPosition,
        gradedCard,
        guessedRequeue,
        sameCard: sameSessionCard,
        buildOptimisticRequeue: (c) => ({ ...c, _inSessionRequeue: true }),
      });
      queueRef.current = nextQueue;
      setQueue(nextQueue);
      setRevealed(false);
      setReviewCount((c) => c + 1);
      setGradeCounts((prev) => ({ ...prev, [rating]: (prev[rating] || 0) + 1 }));
      if (!guessedRequeue) {
        setDoneCount((c) => c + 1);
      }
      setSessionNow(Date.now());
      setPosition(Math.min(gradedAtPosition, Math.max(0, nextQueue.length - 1)));
      if (nextQueue.length === 0) {
        if (pendingGradesRef.current <= 1 && !guessedRequeue) {
          setCompleted(true);
        }
      } else {
        setCompleted(false);
      }

      void (async () => {
        try {
          const result = await cardDeckV2Service.reviewCard(
            contentId,
            gradedCard.id,
            userId,
            rating,
            deckId
          );
          if (!result.success || !result.data) throw new Error(result.message);

          focus?.attachCardDeckReview(gradedCard.id, rating);
          analytics.track(EVENTS.CARD_DECK_GRADED, {
            content_id: contentId,
            card_id: gradedCard.id,
            rating,
            deck_id: deckId ?? undefined,
            requeue_now: Boolean(result.data.requeue_now),
          });

          const { queue: reconciled, doneDelta } = reconcileOptimisticGrade({
            queue: queueRef.current,
            gradedCard,
            result: result.data,
            guessedRequeue,
            sameCard: sameSessionCard,
            buildRequeued: (serverCard) => ({ ...serverCard, _inSessionRequeue: true }),
          });
          queueRef.current = reconciled;
          setQueue(reconciled);
          if (doneDelta) {
            setDoneCount((c) => Math.max(0, c + doneDelta));
          }
          setPosition((pos) => Math.min(pos, Math.max(0, reconciled.length - 1)));
          if (reconciled.length === 0 && pendingGradesRef.current <= 1) {
            setCompleted(true);
          } else if (reconciled.length > 0) {
            setCompleted(false);
          }
        } catch {
          queueRef.current = snapshotQueue;
          setQueue(snapshotQueue);
          setPosition(gradedAtPosition);
          setDoneCount(snapshotDone);
          setReviewCount(snapshotReview);
          setGradeCounts(snapshotGradeCounts);
          setRevealed(true);
          setCompleted(false);
          setError('Could not save your review');
        } finally {
          gradeInFlightRef.current.delete(gradedCard.id);
          pendingGradesRef.current = Math.max(0, pendingGradesRef.current - 1);
          if (queueRef.current.length === 0 && pendingGradesRef.current === 0) {
            setCompleted(true);
            if (!sessionEndedRef.current) {
              sessionEndedRef.current = true;
              analytics.track(EVENTS.CARD_DECK_SESSION_ENDED, {
                content_id: contentId,
                deck_id: deckId ?? undefined,
                reviews: reviewCountRef.current,
              });
            }
          }
        }
      })();
    },
    [card, contentId, userId, deckId, position, focus]
  );

  const handleExit = useCallback(async () => {
    try {
      await onDeckRefresh?.();
    } catch {
      /* still return to deck home */
    }
    onBack();
  }, [onDeckRefresh, onBack]);

  const handleStar = async () => {
    if (!card?.id) return;
    const previous = !!card.is_starred;
    const optimistic = !previous;
    setQueue((prev) => {
      const next = prev.map((c, i) => (i === position ? { ...c, is_starred: optimistic } : c));
      queueRef.current = next;
      return next;
    });
    onStarChange?.(card.id, optimistic);
    const result = await cardDeckV2Service.toggleStar(contentId, card.id, userId, deckId);
    if (!result.success || !result.data) {
      setQueue((prev) => {
        const next = prev.map((c, i) => (i === position ? { ...c, is_starred: previous } : c));
        queueRef.current = next;
        return next;
      });
      onStarChange?.(card.id, previous);
      return;
    }
    setQueue((prev) => {
      const next = prev.map((c, i) => (i === position ? { ...c, is_starred: result.data!.is_starred } : c));
      queueRef.current = next;
      return next;
    });
    onStarChange?.(card.id, result.data.is_starred);
  };

  if (loading) {
    return <PanelSkeleton label="Preparing your cards" rows={4} />;
  }

  if (completed) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.completedContent}
      >
        <Text style={styles.completedEmoji}>{reviewCount > 0 ? '🎉' : '✓'}</Text>
        <Text variant="titleLarge" style={[styles.completedTitle, { color: theme.colors.onSurface }]}>
          {reviewCount > 0 ? 'Session complete' : 'Nothing to study right now'}
        </Text>
        <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20 }}>
          {reviewCount > 0
            ? sessionStartTotal > 0
              ? `You finished ${doneCount} of ${sessionStartTotal} card${sessionStartTotal === 1 ? '' : 's'} in this session.`
              : `You made ${reviewCount} review${reviewCount === 1 ? '' : 's'} in this session.`
            : 'No cards are due right now. Come back later.'}
        </Text>

        {reviewCount > 0 ? (
          <View style={styles.gradeGrid}>
            {RATINGS.map((r) => (
              <View key={r.value} style={[styles.gradeCell, { backgroundColor: r.bg }]}>
                <Text style={{ color: r.text, fontSize: 18, fontWeight: '700' }}>{gradeCounts[r.value] || 0}</Text>
                <Text style={{ color: r.text, fontSize: 11 }}>{r.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <TouchableOpacity onPress={handleExit} style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.primaryButtonText}>Back to deck</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.sessionContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sessionHeader}>
        <TouchableOpacity onPress={handleExit} style={styles.exitButton}>
          <MaterialCommunityIcons name="chevron-left" size={20} color={theme.colors.onSurfaceVariant} />
          <Text style={{ color: theme.colors.onSurfaceVariant, fontFamily: Fonts.ui.semiBold }}>Exit</Text>
        </TouchableOpacity>
        <Text style={{ color: theme.colors.onSurfaceVariant, fontFamily: Fonts.ui.semiBold, fontSize: 12 }}>
          REVIEW
        </Text>
        <Text style={{ color: theme.colors.onSurface, fontFamily: Fonts.ui.bold }}>
          {sessionCardIndex}/{sessionCardTotal}
        </Text>
      </View>

      <View style={styles.progressRow}>
        <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
          <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: theme.colors.primary }]} />
        </View>
        <Text style={{ color: theme.colors.primary, fontWeight: '700', width: 40, textAlign: 'right' }}>
          {progressPercent}%
        </Text>
      </View>

      {filterLabel ? (
        <Text style={[styles.filterLabel, { color: theme.colors.primary }]} numberOfLines={1}>
          {filterLabel}
        </Text>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {cardStatusLabel ? (
        <View style={[styles.statusPill, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Text style={{ color: theme.colors.onSurface, fontSize: 12, fontWeight: '600' }}>{cardStatusLabel}</Text>
        </View>
      ) : null}

      <View style={styles.cardWrap}>
        <CardDeckFlipCard
          front={card?.front || ''}
          back={card?.back || ''}
          hint={card?.hint}
          isFlipped={revealed}
          onFlip={() => setRevealed((r) => !r)}
          isDueRevision={cardIsDueRevision}
          isStarred={!!card?.is_starred}
          onToggleStar={card?.id ? handleStar : null}
          showTapHint
        />
      </View>

      {!revealed ? (
        <TouchableOpacity
          onPress={() => setRevealed(true)}
          style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={styles.primaryButtonText}>Reveal answer</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.gradeSection}>
          <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 8 }}>
            How well did you know it?
          </Text>
          <View style={styles.gradeGrid}>
            {RATINGS.map((r) => (
              <TouchableOpacity
                key={r.value}
                onPress={() => handleGrade(r.value)}
                style={[styles.gradeButton, { backgroundColor: r.bg }]}
              >
                <Text style={{ color: r.text, fontWeight: '700' }}>{r.label}</Text>
                <Text style={{ color: r.text, fontSize: 11, opacity: 0.8 }}>{ratingHints[r.value]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  sessionContent: { padding: 16, paddingBottom: 32 },
  completedContent: { padding: 24, alignItems: 'center' },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  exitButton: { flexDirection: 'row', alignItems: 'center' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  statsRow: { alignItems: 'center', marginBottom: 8 },
  filterLabel: {
    textAlign: 'center',
    fontSize: 12,
    marginBottom: 8,
    fontFamily: Fonts.ui.semiBold,
  },
  statusPill: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 8,
  },
  cardWrap: { width: '100%', marginVertical: 12 },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: Fonts.ui.bold,
    fontSize: 15,
  },
  gradeSection: { marginTop: 8 },
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  gradeButton: {
    width: '47%',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  gradeCell: {
    width: '22%',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  completedEmoji: { fontSize: 40, marginBottom: 8 },
  completedTitle: { fontFamily: Fonts.ui.bold, marginBottom: 8, textAlign: 'center' },
  errorText: { color: '#DC2626', textAlign: 'center', marginBottom: 8 },
});

export default CardDeckSession;
