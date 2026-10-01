import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, Text, TouchableOpacity } from 'react-native';
import { Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';

import { Fonts } from '@/config/fonts';

interface BillingPlanLimitBannerProps {
  message: string;
  onUpgrade: () => void;
  onDismiss?: () => void;
  variant?: 'inline' | 'compact';
}

const BillingPlanLimitBanner: React.FC<BillingPlanLimitBannerProps> = ({
  message,
  onUpgrade,
  onDismiss,
  variant = 'inline',
}) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  useEffect(() => {
    analytics.track(EVENTS.PAYWALL_HIT, { message });
  }, []);

  const isCompact = variant === 'compact';
  const iconSize = isCompact ? 16 : 20;
  const fontSize = isCompact ? 12 : 14;
  const paddingVertical = isCompact ? 12 : 16;
  const paddingHorizontal = isCompact ? 12 : 20;
  const marginBottom = isCompact ? 0 : 16;

  return (
    <Surface
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.primaryContainer,
          borderLeftWidth: 4,
          borderLeftColor: theme.colors.primary,
          marginBottom,
        },
        Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
          },
          android: {
            elevation: 4,
          },
        }),
      ]}
    >
      <View style={[styles.content, { paddingHorizontal, paddingVertical }]}>
        <MaterialCommunityIcons name="information" size={iconSize} color={theme.colors.primary} />
        <View style={styles.messageContainer}>
          <Text style={[styles.message, { color: theme.colors.onPrimaryContainer, fontSize }]}>
            {message}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            analytics.track(EVENTS.UPGRADE_CLICKED, { source: 'paywall_banner', message });
            onUpgrade();
          }}
          style={[styles.upgradeButton, { backgroundColor: theme.colors.primary }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.upgradeButtonText, { color: theme.colors.onPrimary }]}>
            Upgrade to Pro
          </Text>
        </TouchableOpacity>
        {onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.dismissButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="close"
              size={isCompact ? 18 : 20}
              color={theme.colors.onPrimaryContainer}
            />
          </TouchableOpacity>
        )}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  messageContainer: {
    flex: 1,
  },
  message: {
    fontFamily: Fonts.ui.regular,
    lineHeight: 20,
  },
  upgradeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  upgradeButtonText: {
    fontSize: 13,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.2,
  },
  dismissButton: {
    padding: 4,
    marginLeft: -4,
  },
});

export default BillingPlanLimitBanner;
