import React, { useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import type { FlashcardV2 } from '@/api/schemas/cardDecksV2';
import {
  OnboardingTourProvider,
  TourAnchor,
  CARD_DECK_DECK_TOUR_ID,
  CARD_DECK_DECK_TOUR_STEPS,
  LEARNING_CONTENT_TOUR_ID,
  useTourCompleted,
  type TourStep,
} from '@/components/ui/feature-tour';
import CardDeckFlipCard from './CardDeckFlipCard';
import CardDeckPager from './CardDeckPager';
import CardDeckSwipeArea from './CardDeckSwipeArea';
import { getFlashcardListStatus, partitionDeckHomeCards } from './cardDeckAnkiHints';
import { flashcardAnswerPreviewText, flashcardQuestionPreviewText } from './cardDeckContentUtils';

import { Fonts } from '@/config/fonts';

const DECK_TOUR_STEPS = CARD_DECK_DECK_TOUR_STEPS as TourStep[];

type Props = {
  flashcards: FlashcardV2[];
  studyQueueCount?: number | null;
  deckTitle?: string | null;
  isStarredCollection?: boolean;
  onStartStudying: (filters: { topicIds: number[]; starredOnly: boolean }) => void;
  onGenerateMore?: () => void;
  onToggleStar?: (cardId: number) => void;
};

const statusToneStyle = (tone: 'due' | 'short' | 'long', isDark: boolean) => {
  if (tone === 'due') {
    return {
      bg: isDark ? 'rgba(234, 88, 12, 0.15)' : '#FFEDD5',
      text: isDark ? '#FDBA74' : '#C2410C',
    };
  }
  if (tone === 'short') {
    return {
      bg: isDark ? 'rgba(14, 165, 233, 0.15)' : '#E0F2FE',
      text: isDark ? '#7DD3FC' : '#0369A1',
    };
  }
  return {
    bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7',
    text: isDark ? '#FCD34D' : '#B45309',
  };
};

const CardDeckHome: React.FC<Props> = ({
  flashcards,
  studyQueueCount,
  deckTitle,
  isStarredCollection = false,
  onStartStudying,
  onGenerateMore,
  onToggleStar,
}) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const isDark = themeMode === 'dark';
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewFlipped, setPreviewFlipped] = useState(false);
  const [listNow, setListNow] = useState(() => Date.now());
  const learningTourReady = useTourCompleted(LEARNING_CONTENT_TOUR_ID);

  const total = flashcards.length;
  const safeIndex = total > 0 ? Math.min(previewIndex, total - 1) : 0;
  const current = flashcards[safeIndex];
  const starredCards = flashcards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.is_starred);

  const listNowDate = useMemo(() => new Date(listNow), [listNow]);
  const { dueCards, newCards } = useMemo(
    () => partitionDeckHomeCards(flashcards, listNowDate),
    [flashcards, listNowDate]
  );

  useEffect(() => {
    const tick = setInterval(() => setListNow(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    setPreviewIndex(0);
    setPreviewFlipped(false);
  }, [flashcards.length]);

  useEffect(() => {
    setPreviewFlipped(false);
  }, [safeIndex]);

  const goPrev = () => setPreviewIndex((i) => (i <= 0 ? total - 1 : i - 1));
  const goNext = () => setPreviewIndex((i) => (i >= total - 1 ? 0 : i + 1));

  const handleStar = () => {
    if (current?.id && onToggleStar) onToggleStar(current.id);
  };

  return (
    <OnboardingTourProvider
      tourId={CARD_DECK_DECK_TOUR_ID}
      steps={DECK_TOUR_STEPS}
      autoStart={total > 0 && learningTourReady}
    >
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.headerSection, { borderBottomColor: theme.colors.outlineVariant }]}>
        <View style={styles.headerTop}>
          <View>
            <Text variant="titleLarge" style={[styles.title, { color: theme.colors.onSurface }]}>
              {deckTitle || 'Flashcards'}
            </Text>
            <Text style={{ color: theme.colors.onSurfaceVariant, fontFamily: Fonts.ui.regular }}>
              {flashcards.length} card{flashcards.length === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {onGenerateMore ? (
              <TourAnchor stepId="add-more">
                <TouchableOpacity
                  onPress={onGenerateMore}
                  style={[styles.secondaryButton, { borderColor: theme.colors.primary }]}
                >
                  <MaterialCommunityIcons name="plus" size={16} color={theme.colors.primary} />
                  <Text style={[styles.secondaryButtonText, { color: theme.colors.primary }]}>Add more</Text>
                </TouchableOpacity>
              </TourAnchor>
            ) : null}
          </View>
        </View>

        {total > 0 ? (
          <>
            <TourAnchor stepId="preview" style={styles.previewCard}>
              <CardDeckSwipeArea onPrev={goPrev} onNext={goNext} enabled={total > 1}>
                <CardDeckFlipCard
                  front={current?.front || ''}
                  back={current?.back || ''}
                  hint={current?.hint}
                  isFlipped={previewFlipped}
                  onFlip={() => setPreviewFlipped((f) => !f)}
                  isStarred={!!current?.is_starred}
                  onToggleStar={current?.id && onToggleStar ? handleStar : null}
                  showTapHint
                />
              </CardDeckSwipeArea>
            </TourAnchor>
            <CardDeckPager index={safeIndex} total={total} onPrev={goPrev} onNext={goNext} />
          </>
        ) : (
          <Text style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', paddingVertical: 32 }}>
            No cards in this deck yet.
          </Text>
        )}

        <View style={styles.actionRow}>
          <TourAnchor stepId="study">
            <TouchableOpacity
              onPress={() =>
                onStartStudying({ topicIds: [], starredOnly: isStarredCollection })
              }
              disabled={flashcards.length === 0}
              style={[
                styles.primaryButton,
                { backgroundColor: theme.colors.primary, opacity: flashcards.length === 0 ? 0.5 : 1 },
              ]}
            >
              <MaterialCommunityIcons name="play" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>
                Start studying
                {studyQueueCount != null && studyQueueCount > 0 ? ` · ${studyQueueCount}` : ''}
              </Text>
            </TouchableOpacity>
          </TourAnchor>
          {!isStarredCollection && starredCards.length > 0 ? (
            <TouchableOpacity
              onPress={() => onStartStudying({ topicIds: [], starredOnly: true })}
              style={[styles.outlineButton, { borderColor: '#F59E0B' }]}
            >
              <MaterialCommunityIcons name="star" size={18} color="#F59E0B" />
              <Text style={[styles.outlineButtonText, { color: theme.colors.onSurface }]}>
                Study starred · {starredCards.length}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.listSection}>
        {!isStarredCollection && starredCards.length > 0 ? (
          <>
            <Text style={[styles.listTitle, { color: theme.colors.onSurface }]}>
              Starred · {starredCards.length}
            </Text>
            {starredCards.map(({ card, index }) => {
              const selected = index === safeIndex;
              return (
                <TouchableOpacity
                  key={`starred-${card.id ?? index}`}
                  onPress={() => {
                    setPreviewIndex(index);
                    setPreviewFlipped(false);
                  }}
                  style={[
                    styles.listItem,
                    {
                      borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                      backgroundColor: selected
                        ? isDark
                          ? 'rgba(37, 99, 235, 0.12)'
                          : '#EFF6FF'
                        : theme.colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.listIndex, { color: theme.colors.primary }]}>{index + 1}</Text>
                  <View style={styles.listText}>
                    <Text numberOfLines={2} style={[styles.listFront, { color: theme.colors.onSurface }]}>
                      {flashcardQuestionPreviewText(card.front)}
                    </Text>
                    <Text numberOfLines={2} style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                      {flashcardAnswerPreviewText(card.front, card.back)}
                    </Text>
                  </View>
                  {card.id && onToggleStar ? (
                    <TouchableOpacity onPress={() => onToggleStar(card.id!)} hitSlop={8}>
                      <MaterialCommunityIcons name="star" size={18} color="#F59E0B" />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </>
        ) : null}

        {dueCards.length === 0 && newCards.length === 0 ? (
          <Text style={[styles.emptyQueue, { color: theme.colors.onSurfaceVariant }]}>
            You&apos;re all caught up. No due or new cards right now.
          </Text>
        ) : null}

        {dueCards.length > 0 ? (
          <>
            <Text style={[styles.listTitle, { color: theme.colors.onSurface }]}>
              Due · {dueCards.length}
            </Text>
            {dueCards.map(({ card, index }) => {
              const status = getFlashcardListStatus(card, listNowDate);
              const tone = status ? statusToneStyle(status.tone, isDark) : null;
              const selected = index === safeIndex;
              return (
                <TouchableOpacity
                  key={`due-${card.id ?? index}`}
                  onPress={() => {
                    setPreviewIndex(index);
                    setPreviewFlipped(false);
                  }}
                  style={[
                    styles.listItem,
                    {
                      borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                      backgroundColor: selected
                        ? isDark
                          ? 'rgba(37, 99, 235, 0.12)'
                          : '#EFF6FF'
                        : theme.colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.listIndex, { color: theme.colors.primary }]}>{index + 1}</Text>
                  <View style={styles.listText}>
                    <Text numberOfLines={2} style={[styles.listFront, { color: theme.colors.onSurface }]}>
                      {flashcardQuestionPreviewText(card.front)}
                    </Text>
                    <Text numberOfLines={2} style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                      {flashcardAnswerPreviewText(card.front, card.back)}
                    </Text>
                  </View>
                  {tone ? (
                    <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
                      <Text style={{ color: tone.text, fontSize: 10, fontFamily: Fonts.ui.semiBold }}>
                        {status?.label}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.statusBadge, { backgroundColor: isDark ? 'rgba(234, 88, 12, 0.15)' : '#FFEDD5' }]}>
                      <Text style={{ color: isDark ? '#FDBA74' : '#C2410C', fontSize: 10, fontFamily: Fonts.ui.semiBold }}>
                        Due
                      </Text>
                    </View>
                  )}
                  {card.id && onToggleStar ? (
                    <TouchableOpacity onPress={() => onToggleStar(card.id!)} hitSlop={8}>
                      <MaterialCommunityIcons
                        name={card.is_starred ? 'star' : 'star-outline'}
                        size={18}
                        color={card.is_starred ? '#F59E0B' : theme.colors.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </>
        ) : null}

        {newCards.length > 0 ? (
          <>
            <Text style={[styles.listTitle, { color: theme.colors.onSurface }]}>
              New · {newCards.length}
            </Text>
            {newCards.map(({ card, index }) => {
              const selected = index === safeIndex;
              return (
                <TouchableOpacity
                  key={`new-${card.id ?? index}`}
                  onPress={() => {
                    setPreviewIndex(index);
                    setPreviewFlipped(false);
                  }}
                  style={[
                    styles.listItem,
                    {
                      borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                      backgroundColor: selected
                        ? isDark
                          ? 'rgba(37, 99, 235, 0.12)'
                          : '#EFF6FF'
                        : theme.colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.listIndex, { color: theme.colors.primary }]}>{index + 1}</Text>
                  <View style={styles.listText}>
                    <Text numberOfLines={2} style={[styles.listFront, { color: theme.colors.onSurface }]}>
                      {flashcardQuestionPreviewText(card.front)}
                    </Text>
                    <Text numberOfLines={2} style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                      {flashcardAnswerPreviewText(card.front, card.back)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F4F4F5' }]}>
                    <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 10, fontFamily: Fonts.ui.semiBold }}>
                      New
                    </Text>
                  </View>
                  {card.id && onToggleStar ? (
                    <TouchableOpacity onPress={() => onToggleStar(card.id!)} hitSlop={8}>
                      <MaterialCommunityIcons
                        name={card.is_starred ? 'star' : 'star-outline'}
                        size={18}
                        color={card.is_starred ? '#F59E0B' : theme.colors.onSurfaceVariant}
                      />
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </>
        ) : null}
      </View>
    </ScrollView>
    </OnboardingTourProvider>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  headerSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTop: {
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontFamily: Fonts.ui.bold,
  },
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontFamily: Fonts.ui.semiBold,
  },
  previewCard: {
    width: '100%',
    marginBottom: 12,
  },
  actionRow: {
    marginTop: 16,
    gap: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: Fonts.ui.bold,
    fontSize: 15,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
  },
  outlineButtonText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 15,
  },
  listSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  listTitle: {
    fontSize: 14,
    fontFamily: Fonts.ui.bold,
    marginBottom: 4,
  },
  emptyQueue: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  listIndex: {
    fontSize: 12,
    fontFamily: Fonts.ui.bold,
    width: 18,
  },
  listText: {
    flex: 1,
    minWidth: 0,
  },
  listFront: {
    fontSize: 14,
    fontFamily: Fonts.ui.semiBold,
  },
  listMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});

export default CardDeckHome;
