import React, { useMemo } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { ChevronRight, Play, Reel } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { BRAND_COLORS } from '@/config/brand';
import { Fonts } from '@/config/fonts';
import { useAppTheme } from '@/store/appThemeStore';
import { SkeletonBase } from '@/components/ui/skeleton/SkeletonBase';
import FeatureNewTag from '@/components/ui/feature-tour/FeatureNewTag';
import { CARD_DECK_REEL_NEW_TAG_IDS } from '@/components/ui/feature-tour';
import type { ReelFeedPayload } from '@/api/schemas/cardDecksV2';

type HomeStudyFeedCardProps = {
  feed: ReelFeedPayload | null | undefined;
  isLoading: boolean;
  onOpen: () => void;
};

export const HomeStudyFeedCard: React.FC<HomeStudyFeedCardProps> = ({ feed, isLoading, onOpen }) => {
  const isDark = useAppTheme() === 'dark';

  const queueCount = feed?.study_queue_count || 0;
  const dueCount = feed?.due_count || 0;
  const newCount = feed?.new_count || 0;
  const setsCount = feed?.feed_count || 0;

  const ctaLabel = useMemo(() => {
    if (queueCount > 0) {
      return `Study now · ${queueCount} card${queueCount === 1 ? '' : 's'}`;
    }
    if (setsCount === 0) {
      return 'Choose sets for your feed';
    }
    return 'Nothing due. Open feed';
  }, [queueCount, setsCount]);

  const surface = isDark ? '#111113' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)';
  const muted = isDark ? '#A1A1AA' : '#52525B';
  const titleColor = isDark ? '#FAFAFA' : '#18181B';

  if (isLoading) {
    return (
      <View style={[styles.card, { backgroundColor: surface, borderColor: border }]}>
        <View style={styles.headRow}>
          <SkeletonBase style={styles.skelIcon} />
          <View style={styles.headCopy}>
            <SkeletonBase style={styles.skelTitle} />
            <SkeletonBase style={styles.skelSub} />
          </View>
        </View>
        <View style={styles.statsRow}>
          <SkeletonBase style={styles.skelStat} />
          <SkeletonBase style={styles.skelStat} />
          <SkeletonBase style={styles.skelStat} />
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: surface,
          borderColor: border,
          opacity: pressed ? 0.94 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Study feed. ${queueCount} cards ready to review.`}
    >
      <View style={styles.headRow}>
        <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(63,107,79,0.2)' : 'rgba(63,107,79,0.12)' }]}>
          <Reel size={18} strokeWidth={ICON_STROKE} color={isDark ? '#7A9E86' : BRAND_COLORS.growth} />
        </View>
        <View style={styles.headCopy}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: titleColor }]}>Study feed</Text>
            <FeatureNewTag featureId={CARD_DECK_REEL_NEW_TAG_IDS.SIDEBAR_NAV} tourId="card-deck-reel" />
          </View>
          <Text style={[styles.sub, { color: muted }]}>Due cards from your decks, in one queue.</Text>
        </View>
        <ChevronRight size={18} strokeWidth={ICON_STROKE} color={muted} />
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: isDark ? 'rgba(63,107,79,0.16)' : 'rgba(63,107,79,0.08)' }]}>
          <Text style={[styles.statValue, { color: titleColor }]}>{queueCount}</Text>
          <Text style={[styles.statLabel, { color: isDark ? '#9BB8A6' : BRAND_COLORS.growth }]}>Ready</Text>
          {queueCount > 0 && newCount > 0 ? (
            <Text style={[styles.statHint, { color: muted }]}>{newCount} new</Text>
          ) : null}
        </View>
        <View style={[styles.statBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F4F4F5' }]}>
          <Text style={[styles.statValue, { color: titleColor }]}>{dueCount}</Text>
          <Text style={[styles.statLabel, { color: muted }]}>Due today</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F4F4F5' }]}>
          <Text style={[styles.statValue, { color: titleColor }]}>{setsCount}</Text>
          <Text style={[styles.statLabel, { color: muted }]}>Sets</Text>
        </View>
      </View>

      <View
        style={[
          styles.cta,
          {
            backgroundColor: queueCount > 0 ? BRAND_COLORS.ink : isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F5',
          },
        ]}
      >
        {queueCount > 0 ? <Play size={14} strokeWidth={ICON_STROKE} color="#FAFAFA" /> : null}
        <Text
          style={[
            styles.ctaText,
            { color: queueCount > 0 ? '#FAFAFA' : titleColor },
          ]}
          numberOfLines={1}
        >
          {ctaLabel}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
    gap: 12,
    ...Platform.select({
      web: { boxShadow: '0 1px 2px rgba(26,47,35,0.04)' },
      default: {
        shadowColor: BRAND_COLORS.ink,
        shadowOpacity: 0.04,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      },
    }),
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headCopy: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  sub: {
    fontFamily: Fonts.ui.regular,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 20,
    letterSpacing: -0.4,
  },
  statLabel: {
    fontFamily: Fonts.ui.medium,
    fontSize: 11,
    marginTop: 2,
  },
  statHint: {
    fontFamily: Fonts.ui.regular,
    fontSize: 10,
    marginTop: 2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  ctaText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 13,
  },
  skelIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    flexGrow: 0,
    flexShrink: 0,
  },
  skelTitle: {
    height: 14,
    width: 110,
    borderRadius: 6,
    marginBottom: 6,
    flexGrow: 0,
  },
  skelSub: {
    height: 10,
    width: 180,
    borderRadius: 5,
    flexGrow: 0,
  },
  skelStat: {
    flex: 1,
    height: 56,
    borderRadius: 12,
  },
});
