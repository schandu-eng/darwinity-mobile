import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '@/components/brand/BrandMark';
import { ConcentrationChip } from '@/features/concentration/FocusChip';
import SupportFeedbackModal from '@/components/feedback/SupportFeedbackModal';
import {
  INTAKE_FAILURE_SUPPORT_HINT_COPY,
  useIntakeFailureSupportHintStore,
} from '@/store/intakeFailureSupportHintStore';
import { BRAND_COLORS, BRAND_NAME } from '@/config/brand';
import { useAppTheme } from '@/store/appThemeStore';
import { CircleHelp, Reel, User } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { FeatureNewTag, CARD_DECK_REEL_NEW_TAG_IDS } from '@/components/ui/feature-tour';
import { openAccountModal } from '@/navigation/navigationRef';
import {
  TOOLBAR_SHADOW,
  boxShadow,
  pointerEventsProp,
  pointerEventsStyle,
} from '@/theme/webCompat';

type HubHomeHeaderProps = {
  studyFeedCount?: number;
  onOpenStudyFeed?: () => void;
  showFeedback?: boolean;
};

export const HubHomeHeader: React.FC<HubHomeHeaderProps> = ({
  studyFeedCount = 0,
  onOpenStudyFeed,
  showFeedback = true,
}) => {
  const insets = useSafeAreaInsets();
  const isDark = useAppTheme() === 'dark';
  const showBadge = studyFeedCount > 0;
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const hintVisible = useIntakeFailureSupportHintStore((s) => s.hintVisible);
  const hideIntakeFailureSupportHint = useIntakeFailureSupportHintStore(
    (s) => s.hideIntakeFailureSupportHint,
  );

  useEffect(() => {
    if (!hintVisible) return undefined;
    const timeoutId = setTimeout(() => hideIntakeFailureSupportHint(), 14000);
    return () => clearTimeout(timeoutId);
  }, [hintVisible, hideIntakeFailureSupportHint]);

  const chromeBg = isDark ? '#111113' : '#FFFFFF';
  const chromeBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(26,47,35,0.12)';
  const chromeFg = isDark ? '#D4D4D8' : '#3F3F46';

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: Math.max(insets.top, 8),
          backgroundColor: isDark ? '#09090B' : BRAND_COLORS.paper,
        },
      ]}
    >
      <View
        style={styles.brand}
        accessibilityRole="header"
        accessibilityLabel={BRAND_NAME}
      >
        <BrandMark size={22} color={isDark ? '#7A9E86' : BRAND_COLORS.ink} />
        <Text
          style={[
            styles.brandName,
            { color: isDark ? '#FAFAFA' : BRAND_COLORS.ink },
          ]}
          numberOfLines={1}
        >
          {BRAND_NAME}
        </Text>
      </View>

      <View style={styles.spacer} />

      {onOpenStudyFeed ? (
        <View style={styles.feedWrap}>
          <Pressable
            onPress={onOpenStudyFeed}
            style={({ pressed }) => [
              styles.chromeBtn,
              {
                backgroundColor: chromeBg,
                borderColor: chromeBorder,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              showBadge ? `Study feed, ${studyFeedCount} cards to review` : 'Study feed'
            }
          >
            <Reel size={16} strokeWidth={ICON_STROKE} color={isDark ? '#E4E4E7' : BRAND_COLORS.ink} />
            <Text style={[styles.chromeLabel, { color: isDark ? '#E4E4E7' : BRAND_COLORS.ink }]}>
              Feed
            </Text>
            {showBadge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{studyFeedCount > 99 ? '99+' : studyFeedCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <FeatureNewTag
            featureId={CARD_DECK_REEL_NEW_TAG_IDS.SIDEBAR_NAV}
            tourId="card-deck-reel"
            variant="icon"
          />
        </View>
      ) : null}

      {showFeedback ? (
      <View style={styles.supportWrap}>
        <Pressable
          onPress={() => {
            hideIntakeFailureSupportHint();
            setSupportModalVisible(true);
          }}
          style={({ pressed }) => [
            styles.chromeBtn,
            {
              backgroundColor: chromeBg,
              borderColor: hintVisible
                ? BRAND_COLORS.ink
                : chromeBorder,
              opacity: pressed ? 0.85 : 1,
            },
            hintVisible ? { borderWidth: 2 } : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Support"
        >
          <CircleHelp size={16} strokeWidth={ICON_STROKE} color={chromeFg} />
          <Text style={[styles.chromeLabel, { color: chromeFg }]}>Support</Text>
        </Pressable>
        {hintVisible ? (
          <View
            style={[
              styles.hintBubble,
              pointerEventsStyle('none'),
              { backgroundColor: isDark ? '#FAFAFA' : '#18181B' },
            ]}
            pointerEvents={pointerEventsProp('none')}
          >
            <Text style={[styles.hintText, { color: isDark ? '#18181B' : '#FAFAFA' }]}>
              {INTAKE_FAILURE_SUPPORT_HINT_COPY}
            </Text>
          </View>
        ) : null}
      </View>
      ) : null}

      <SupportFeedbackModal
        visible={supportModalVisible}
        onClose={() => setSupportModalVisible(false)}
        source="home_header_mobile"
      />
      <ConcentrationChip variant="header" />
      <Pressable
        onPress={() => openAccountModal()}
        style={({ pressed }) => [
          styles.iconBtn,
          { opacity: pressed ? 0.7 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Account"
      >
        <User size={20} strokeWidth={ICON_STROKE} color={chromeFg} />
      </Pressable>
    </View>
  );
};

const chromeShadow = boxShadow(TOOLBAR_SHADOW, {
  shadowColor: BRAND_COLORS.ink,
  shadowOpacity: 0.04,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
});

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 6,
    gap: 6,
    zIndex: 20,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    flexShrink: 1,
    paddingLeft: 6,
  },
  brandName: {
    fontFamily: Fonts.display.bold,
    fontSize: 18,
    letterSpacing: -0.7,
  },
  spacer: { flex: 1 },
  feedWrap: {
    position: 'relative',
  },
  chromeBtn: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...chromeShadow,
  },
  chromeLabel: {
    fontFamily: Fonts.ui.medium,
    fontSize: 12,
  },
  supportWrap: {
    position: 'relative',
    zIndex: 20,
  },
  hintBubble: {
    position: 'absolute',
    top: 42,
    right: 0,
    maxWidth: 200,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...boxShadow('0 8px 24px rgba(0,0,0,0.18)', {
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    }),
  },
  hintText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: BRAND_COLORS.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FAFAFA',
    fontFamily: Fonts.ui.semiBold,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
  },
});
