import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import type { FlashcardV2 } from '@/api/schemas/cardDecksV2';
import CardDeckFlipCard from './CardDeckFlipCard';
import CardDeckPager from './CardDeckPager';
import CardDeckSwipeArea from './CardDeckSwipeArea';
import CardDeckFilterSheet from './CardDeckFilterSheet';
import {
  buildCardDeckFilterLabel,
  filterFlashcards,
  flashcardKey,
  getTopicFilterableTopics,
  type TopicItem,
} from './cardDeckUtils';
import { orderCardsByIds, shuffleIds, shuffleIdsKeepingFirst } from './flashcardShuffle';

import { Fonts } from '@/config/fonts';

const resolveCardKey = (card: FlashcardV2 | undefined, cards: FlashcardV2[]) => {
  if (!card) return null;
  if (card.id != null) return String(card.id);
  const idx = cards.findIndex((c) => c === card);
  return flashcardKey(card, idx >= 0 ? idx : 0);
};

type Props = {
  flashcards: FlashcardV2[];
  topics?: TopicItem[];
  topicIds?: number[];
  starredOnly?: boolean;
  shuffle?: boolean;
  onToggleStar?: (cardId: number) => void;
  onBack: () => void;
};

const CardDeckQuickReview: React.FC<Props> = ({
  flashcards,
  topics = [],
  topicIds: initialTopicIds = [],
  starredOnly: initialStarredOnly = false,
  shuffle: initialShuffle = false,
  onToggleStar,
  onBack,
}) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const [topicIds, setTopicIds] = useState(initialTopicIds);
  const [starredOnly, setStarredOnly] = useState(initialStarredOnly);
  const [isShuffled, setIsShuffled] = useState(initialShuffle);
  const [shuffledKeys, setShuffledKeys] = useState<string[]>([]);
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const filterableTopics = useMemo(
    () => getTopicFilterableTopics(topics, flashcards),
    [topics, flashcards]
  );
  const topicFilterAvailable = filterableTopics.length > 0;

  const filteredCards = useMemo(
    () => filterFlashcards(flashcards, { topicIds, starredOnly }),
    [flashcards, topicIds, starredOnly]
  );

  const sequentialKeys = useMemo(
    () => filteredCards.map((c, i) => flashcardKey(c, i)),
    [filteredCards]
  );

  useEffect(() => {
    if (!isShuffled) {
      setShuffledKeys([]);
      return;
    }
    setShuffledKeys((prev) => {
      if (prev.length === 0) return shuffleIds(sequentialKeys);
      const sameSet =
        prev.length === sequentialKeys.length && sequentialKeys.every((k) => prev.includes(k));
      return sameSet ? prev : shuffleIds(sequentialKeys);
    });
  }, [isShuffled, sequentialKeys]);

  const displayCards = useMemo(() => {
    if (!isShuffled || shuffledKeys.length === 0) return filteredCards;
    return orderCardsByIds(filteredCards, shuffledKeys, flashcardKey);
  }, [filteredCards, isShuffled, shuffledKeys]);

  const total = displayCards.length;
  const safePosition = total > 0 ? Math.min(position, total - 1) : 0;
  const card = displayCards[safePosition];
  const filterLabel = buildCardDeckFilterLabel({
    starredOnly,
    topicIds: topicFilterAvailable ? topicIds : [],
    topics: filterableTopics,
  });
  const filterActive = starredOnly || (topicFilterAvailable && topicIds.length > 0);

  useEffect(() => {
    if (!topicFilterAvailable && topicIds.length > 0) setTopicIds([]);
  }, [topicFilterAvailable, topicIds.length]);

  useEffect(() => {
    setPosition(0);
    setRevealed(false);
    setCompleted(false);
    if (isShuffled && sequentialKeys.length > 0) {
      setShuffledKeys(shuffleIds(sequentialKeys));
    } else {
      setShuffledKeys([]);
    }
  }, [topicIds, starredOnly, flashcards.length]);

  useEffect(() => {
    setRevealed(false);
  }, [safePosition, card?.id]);

  const goPrev = useCallback(() => {
    setCompleted(false);
    setPosition((p) => (p <= 0 ? Math.max(total - 1, 0) : p - 1));
  }, [total]);

  const goNext = useCallback(() => {
    setPosition((p) => {
      if (total <= 0) return p;
      if (p >= total - 1) {
        setCompleted(true);
        setRevealed(false);
        return p;
      }
      return p + 1;
    });
  }, [total]);

  const toggleShuffle = useCallback(() => {
    const currentKey = resolveCardKey(card, filteredCards);
    if (isShuffled) {
      setIsShuffled(false);
      setShuffledKeys([]);
      if (currentKey != null) {
        const seqIndex = sequentialKeys.indexOf(currentKey);
        if (seqIndex >= 0) setPosition(seqIndex);
      }
      setRevealed(false);
      return;
    }
    setShuffledKeys(shuffleIdsKeepingFirst(sequentialKeys, currentKey));
    setIsShuffled(true);
    setPosition(0);
    setRevealed(false);
  }, [isShuffled, card, filteredCards, sequentialKeys]);

  const handleStar = () => {
    if (card?.id && onToggleStar) onToggleStar(card.id);
  };

  if (total === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text variant="titleMedium" style={{ color: theme.colors.onSurface, marginBottom: 8 }}>
          No cards to review
        </Text>
        <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 20 }}>
          No cards match your filters.
        </Text>
        <TouchableOpacity onPress={onBack} style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.primaryButtonText}>Back to deck</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (completed) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={{ fontSize: 40, marginBottom: 8 }}>✓</Text>
        <Text variant="titleLarge" style={{ color: theme.colors.onSurface, fontFamily: Fonts.ui.bold }}>
          Quick review complete
        </Text>
        <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginVertical: 16 }}>
          You went through {total} card{total === 1 ? '' : 's'}
          {filterLabel ? ` (${filterLabel})` : ''}.
        </Text>
        <TouchableOpacity
          onPress={() => {
            setPosition(0);
            setRevealed(false);
            setCompleted(false);
          }}
          style={[styles.outlineButton, { borderColor: theme.colors.outline }]}
        >
          <Text style={{ color: theme.colors.onSurface, fontFamily: Fonts.ui.semiBold }}>Review again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onBack} style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.primaryButtonText}>Back to deck</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <CardDeckFilterSheet
        visible={filterOpen}
        onDismiss={() => setFilterOpen(false)}
        topics={filterableTopics}
        selectedTopicIds={topicIds}
        onSelectedTopicIdsChange={setTopicIds}
        starredOnly={starredOnly}
        onStarredOnlyChange={setStarredOnly}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.exitButton}>
          <MaterialCommunityIcons name="chevron-left" size={20} color={theme.colors.onSurfaceVariant} />
          <Text style={{ color: theme.colors.onSurfaceVariant, fontFamily: Fonts.ui.semiBold }}>Exit</Text>
        </TouchableOpacity>
        <Text style={{ color: theme.colors.onSurface, fontFamily: Fonts.ui.bold }}>Quick review</Text>
        <Text style={{ color: theme.colors.onSurface, fontFamily: Fonts.ui.bold }}>
          {safePosition + 1}/{total}
        </Text>
      </View>

      <View style={styles.toolbar}>
        <TouchableOpacity
          onPress={() => setFilterOpen(true)}
          style={[
            styles.toolButton,
            {
              borderColor: filterActive ? theme.colors.primary : theme.colors.outline,
              backgroundColor: filterActive
                ? themeMode === 'dark'
                  ? 'rgba(37, 99, 235, 0.15)'
                  : '#EFF6FF'
                : theme.colors.surface,
            },
          ]}
        >
          <MaterialCommunityIcons name="filter-variant" size={16} color={theme.colors.onSurface} />
          <Text style={{ color: theme.colors.onSurface, fontFamily: Fonts.ui.semiBold }}>Filter</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={toggleShuffle}
          disabled={total <= 1}
          style={[
            styles.toolButton,
            {
              borderColor: isShuffled ? theme.colors.primary : theme.colors.outline,
              backgroundColor: isShuffled
                ? themeMode === 'dark'
                  ? 'rgba(37, 99, 235, 0.15)'
                  : '#EFF6FF'
                : theme.colors.surface,
              opacity: total <= 1 ? 0.5 : 1,
            },
          ]}
        >
          <MaterialCommunityIcons name="shuffle" size={16} color={theme.colors.onSurface} />
          <Text style={{ color: theme.colors.onSurface, fontFamily: Fonts.ui.semiBold }}>Shuffle</Text>
        </TouchableOpacity>
      </View>

      {filterLabel ? (
        <Text style={{ color: theme.colors.primary, textAlign: 'center', fontSize: 12, marginBottom: 8 }} numberOfLines={1}>
          {filterLabel}
        </Text>
      ) : null}

      <View style={styles.cardWrap}>
        <CardDeckSwipeArea onPrev={goPrev} onNext={goNext} enabled={total > 1}>
          <CardDeckFlipCard
            front={card?.front || ''}
            back={card?.back || ''}
            hint={card?.hint}
            isFlipped={revealed}
            onFlip={() => setRevealed((r) => !r)}
            isStarred={!!card?.is_starred}
            onToggleStar={card?.id ? handleStar : null}
            showTapHint
          />
        </CardDeckSwipeArea>
      </View>

      <CardDeckPager index={safePosition} total={total} onPrev={goPrev} onNext={goNext} />

      {!revealed ? (
        <TouchableOpacity
          onPress={() => setRevealed(true)}
          style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={styles.primaryButtonText}>Show answer</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={goNext}
          style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={styles.primaryButtonText}>
            {safePosition >= total - 1 ? 'Finish review' : 'Next card'}
          </Text>
        </TouchableOpacity>
      )}

      <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', fontSize: 12, marginTop: 8 }}>
        {revealed
          ? 'Swipe for prev/next · No grades in quick review'
          : 'Tap card to reveal · Swipe left/right to change cards'}
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  exitButton: { flexDirection: 'row', alignItems: 'center' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  toolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cardWrap: { width: '100%', marginVertical: 12 },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
  outlineButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: Fonts.ui.bold,
    fontSize: 15,
  },
});

export default CardDeckQuickReview;
