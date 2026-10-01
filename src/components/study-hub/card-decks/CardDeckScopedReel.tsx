import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import type { ReelCardDeckV2 } from '@/api/schemas/cardDecksV2';
import { cardDeckV2Service } from '@/services/cardDeckV2Service';
import { PanelSkeleton } from '@/components/ui/skeleton';
import CardDeckFlipCard from './CardDeckFlipCard';
import {
  countSessionQueueTypes,
  ratingHintsFromPreviews,
  isDueRevisionCard,
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
  { value: 1, label: 'Again', bg: '#FEE2E2', text: '#991B1B' },
  { value: 2, label: 'Hard', bg: '#FFEDD5', text: '#9A3412' },
  { value: 3, label: 'Good', bg: '#DBEAFE', text: '#1E40AF' },
  { value: 4, label: 'Easy', bg: '#DCFCE7', text: '#166534' },
];

const sameReelCard = (a: ReelCardDeckV2 | null | undefined, b: ReelCardDeckV2 | null | undefined) =>
  a?.id === b?.id && a?.content_id === b?.content_id;

type Props = {
  userId: number;
  onBack: () => void;
};

const CardDeckScopedReel: React.FC<Props> = ({ userId, onBack }) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const [queue, setQueue] = useState<ReelCardDeckV2[]>([]);
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionStartTotal, setSessionStartTotal] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [sessionNow, setSessionNow] = useState(() => Date.now());
  const [error, setError] = useState('');
  const queueRef = useRef<ReelCardDeckV2[]>([]);
  const focus = useConcentrationSessionOptional();
  const sessionEndedRef = useRef(false);
  const reviewCountRef = useRef(0);
  const doneCountRef = useRef(0);
  const gradeInFlightRef = useRef<Set<string>>(new Set());
  const pendingGradesRef = useRef(0);

  const applyQueuePayload = useCallback(
    (
      data: { queue?: ReelCardDeckV2[] },
      gradeResult: { requeue_now?: boolean; card?: ReelCardDeckV2 } | null = null,
      prevQueue: ReelCardDeckV2[] = []
    ) => {
      let items = data.queue || [];

      const sessionRequeues = prevQueue.filter(
        (c) =>
          c._inSessionRequeue &&
          !items.some((x) => x.id === c.id && x.content_id === c.content_id)
      );
      items = [...items, ...sessionRequeues];

      if (gradeResult?.requeue_now && gradeResult.card) {
        const source = prevQueue.find((c) => c.id === gradeResult.card!.id);
        const requeued: ReelCardDeckV2 = {
          ...gradeResult.card,
          content_id: source?.content_id ?? gradeResult.card.content_id,
          content_title: source?.content_title ?? gradeResult.card.content_title,
          _inSessionRequeue: true,
        };
        const exists = items.some(
          (c) => c.id === requeued.id && c.content_id === requeued.content_id
        );
        if (!exists) {
          items = [...items, requeued];
        } else {
          items = items.map((c) =>
            c.id === requeued.id && c.content_id === requeued.content_id
              ? { ...c, ...requeued, _inSessionRequeue: true }
              : c
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
      const result = await cardDeckV2Service.getReelQueue(userId);
      if (!result.success || !result.data) throw new Error(result.message);
      const items = applyQueuePayload(result.data, null, []);
      setPosition(0);
      setRevealed(false);
      setSessionStartTotal(items.length);
      setDoneCount(0);
      setReviewCount(0);
      setCompleted(items.length === 0);
      if (items.length === 0) sessionEndedRef.current = true;
      analytics.track(EVENTS.CARD_DECK_REEL_SESSION_STARTED, {
        queue_size: items.length,
      });
    } catch (err: any) {
      setError(err.message || 'Could not load flashcards');
      setQueue([]);
      setCompleted(true);
      sessionEndedRef.current = true;
    } finally {
      setLoading(false);
    }
  }, [userId, applyQueuePayload]);

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
    sessionEndedRef.current = false;
    return () => {
      if (!sessionEndedRef.current) {
        analytics.track(EVENTS.CARD_DECK_REEL_SESSION_ENDED, {
          reviews: reviewCountRef.current,
          abandoned: true,
        });
      }
    };
  }, [userId]);

  const card = queue[position];
  const total = queue.length;
  const nowDate = useMemo(() => new Date(sessionNow), [sessionNow]);
  const ratingHints = useMemo(
    () => ratingHintsFromPreviews(card?.rating_previews),
    [card?.rating_previews]
  );
  const cardIsDueRevision = isDueRevisionCard(card, nowDate);

  const sessionBreakdown = useMemo(() => {
    const remaining = queue.slice(position);
    const counts = countSessionQueueTypes(remaining, nowDate);
    return { ...counts, done: doneCount };
  }, [queue, position, doneCount, nowDate]);

  const progressPercent =
    sessionStartTotal <= 0 ? 0 : Math.min(100, Math.round((reviewCount / sessionStartTotal) * 100));
  const sessionCardIndex =
    (sessionStartTotal || total) <= 0
      ? 0
      : Math.min(sessionStartTotal || total, Math.max(1, reviewCount + 1));

  useEffect(() => {
    setRevealed(false);
  }, [position, card?.id, card?.content_id]);

  const handleGrade = useCallback(
    (rating: number) => {
      if (!card?.id || !card?.content_id) return;
      const flightKey = `${card.content_id}:${card.id}`;
      if (gradeInFlightRef.current.has(flightKey)) return;

      const gradedCard = card;
      const gradedAtPosition = position;
      const snapshotQueue = queueRef.current;
      const snapshotDone = doneCountRef.current;
      const snapshotReview = reviewCountRef.current;
      const guessedRequeue = previewSuggestsRequeue(gradedCard.rating_previews, rating);

      gradeInFlightRef.current.add(flightKey);
      pendingGradesRef.current += 1;
      setError('');
      playCardDeckGradeFeedback(rating);

      const nextQueue = applyOptimisticGrade({
        queue: snapshotQueue,
        index: gradedAtPosition,
        gradedCard,
        guessedRequeue,
        sameCard: sameReelCard,
        buildOptimisticRequeue: (c) => ({ ...c, _inSessionRequeue: true }),
      });
      queueRef.current = nextQueue;
      setQueue(nextQueue);
      setRevealed(false);
      setReviewCount((c) => c + 1);
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
            gradedCard.content_id,
            gradedCard.id,
            userId,
            rating,
            gradedCard.deck_id ?? null
          );
          if (!result.success || !result.data) throw new Error(result.message);

          focus?.attachCardDeckReview(gradedCard.id, rating);
          analytics.track(EVENTS.CARD_DECK_GRADED, {
            content_id: gradedCard.content_id,
            card_id: gradedCard.id,
            rating,
            surface: 'reel',
            requeue_now: Boolean(result.data.requeue_now),
          });

          const { queue: reconciled, doneDelta } = reconcileOptimisticGrade({
            queue: queueRef.current,
            gradedCard,
            result: {
              requeue_now: result.data.requeue_now,
              card: result.data.card
                ? {
                    ...result.data.card,
                    content_id: gradedCard.content_id,
                    content_title: gradedCard.content_title,
                    deck_id: gradedCard.deck_id,
                    deck_title: gradedCard.deck_title,
                  }
                : null,
            },
            guessedRequeue,
            sameCard: sameReelCard,
            buildRequeued: (serverCard, source) => ({
              ...serverCard,
              content_id: source.content_id,
              content_title: source.content_title,
              deck_id: source.deck_id,
              deck_title: source.deck_title,
              _inSessionRequeue: true,
            }),
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
          setRevealed(true);
          setCompleted(false);
          setError('Could not save your review');
        } finally {
          gradeInFlightRef.current.delete(flightKey);
          pendingGradesRef.current = Math.max(0, pendingGradesRef.current - 1);
          if (queueRef.current.length === 0 && pendingGradesRef.current === 0) {
            setCompleted(true);
            if (!sessionEndedRef.current) {
              sessionEndedRef.current = true;
              analytics.track(EVENTS.CARD_DECK_REEL_SESSION_ENDED, {
                reviews: reviewCountRef.current,
              });
            }
          }
        }
      })();
    },
    [card, userId, position, focus]
  );

  const handleStar = async () => {
    if (!card?.id || !card?.content_id) return;
    const result = await cardDeckV2Service.toggleStar(
      card.content_id,
      card.id,
      userId,
      card.deck_id ?? null
    );
    if (!result.success || !result.data) return;
    setQueue((prev) => {
      const next = prev.map((c, i) =>
        i === position ? { ...c, is_starred: result.data!.is_starred } : c
      );
      queueRef.current = next;
      return next;
    });
  };

  if (loading) {
    return <PanelSkeleton label="Loading flashcards" rows={4} />;
  }

  if (completed) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        contentContainerStyle={styles.completedContent}
      >
        <Text style={styles.completedEmoji}>{reviewCount > 0 ? '🎉' : '✓'}</Text>
        <Text variant="titleLarge" style={[styles.completedTitle, { color: theme.colors.onSurface }]}>
          {reviewCount > 0 ? 'Session complete' : 'Nothing to review'}
        </Text>
        <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20 }}>
          {reviewCount > 0
            ? `You reviewed ${reviewCount} card${reviewCount === 1 ? '' : 's'} from your feed.`
            : 'Your feed has no cards to review right now. Add sets or come back later.'}
        </Text>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={styles.primaryButtonText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const sourceLabel = card?.content_title || '';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.sessionContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sessionHeader}>
        <TouchableOpacity onPress={onBack} style={styles.exitButton}>
          <MaterialCommunityIcons name="chevron-left" size={20} color={theme.colors.onSurfaceVariant} />
          <Text style={{ color: theme.colors.onSurfaceVariant, fontFamily: Fonts.ui.semiBold }}>
            Exit
          </Text>
        </TouchableOpacity>
        <Text style={{ color: theme.colors.onSurface, fontFamily: Fonts.ui.bold }}>
          Study session
        </Text>
        <Text style={{ color: theme.colors.onSurface, fontFamily: Fonts.ui.bold }}>
          {sessionCardIndex}
          <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '500' }}>
            /{sessionStartTotal || total}
          </Text>
        </Text>
      </View>

      <View style={styles.progressRow}>
        <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
          <View
            style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: theme.colors.primary }]}
          />
        </View>
      </View>

      {sourceLabel ? (
        <View style={[styles.sourcePill, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }]}>
          <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
            {sourceLabel}
          </Text>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

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
          <Text style={styles.primaryButtonText}>Show answer</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.gradeSection}>
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

      <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', fontSize: 11, marginTop: 8 }}>
        {sessionBreakdown.revise > 0
          ? `${sessionBreakdown.revise} due · ${sessionBreakdown.new} new remaining`
          : revealed
            ? 'Tap a button to grade'
            : 'Tap card to reveal'}
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  sessionContent: { padding: 16, paddingBottom: 32 },
  completedContent: { padding: 24, alignItems: 'center', flexGrow: 1, justifyContent: 'center' },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  exitButton: { flexDirection: 'row', alignItems: 'center' },
  progressRow: { marginBottom: 12 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  sourcePill: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 8,
    maxWidth: '90%',
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
  completedEmoji: { fontSize: 40, marginBottom: 8 },
  completedTitle: { fontFamily: Fonts.ui.bold, marginBottom: 8, textAlign: 'center' },
  errorText: { color: '#DC2626', textAlign: 'center', marginBottom: 8 },
});

export default CardDeckScopedReel;
