import React from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { AlertCircle } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { BRAND_COLORS } from '@/config/brand';
import { useAppTheme } from '@/store/appThemeStore';
import { toUserFacingError, USER_FACING_ERROR } from '@/utils/userFacingError';

type PanelLoadErrorProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onRetry?: () => void;
  retrying?: boolean;
  /** Stretch and center in the remaining viewport (full-page errors). */
  fill?: boolean;
};

/** Desk-card load error — matches hub empty / notes paper, not Material alert. */
export const PanelLoadError: React.FC<PanelLoadErrorProps> = ({
  title,
  description = USER_FACING_ERROR.generic,
  actionLabel = 'Try again',
  onRetry,
  retrying = false,
  fill = false,
}) => {
  const isDark = useAppTheme() === 'dark';

  return (
    <View style={[styles.wrap, fill && styles.wrapFill]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? '#111113' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)',
          },
        ]}
        accessibilityRole="alert"
      >
        <View
          style={[
            styles.iconWell,
            { backgroundColor: isDark ? 'rgba(220,38,38,0.16)' : '#FEF2F2' },
          ]}
        >
          <AlertCircle size={22} strokeWidth={ICON_STROKE} color={BRAND_COLORS.danger} />
        </View>
        <Text style={[styles.title, { color: isDark ? '#FAFAFA' : '#18181B' }]}>{title}</Text>
        {description ? (
          <Text style={[styles.body, { color: isDark ? '#A1A1AA' : BRAND_COLORS.mute }]}>
            {toUserFacingError(description)}
          </Text>
        ) : null}
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            disabled={retrying}
            style={({ pressed }) => [
              styles.cta,
              {
                backgroundColor: BRAND_COLORS.ink,
                opacity: retrying ? 0.7 : pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            accessibilityState={{ busy: retrying, disabled: retrying }}
          >
            {retrying ? (
              <ActivityIndicator size="small" color="#FAFAFA" />
            ) : (
              <Text style={styles.ctaText}>{actionLabel}</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  wrapFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 16,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  body: {
    marginTop: 6,
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  cta: {
    marginTop: 20,
    height: 44,
    minWidth: 140,
    paddingHorizontal: 20,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
    color: '#FAFAFA',
  },
});
