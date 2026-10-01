import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { ICON_STROKE } from '@/config/icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import {
  getUpgradeCtaCopy,
  isTrialAvailableFromStatus,
  trialDaysFromStatus,
} from '@/utils/trialAvailability';
import { navigateToUpgradePlans } from '@/navigation/navigationRef';
import { Fonts } from '@/config/fonts';
import { useProFeatureAccess } from '@/hooks/useProFeatureAccess';

type Props = {
  children?: React.ReactNode;
  title: string;
  body: string;
  compact?: boolean;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
};

const ProFeatureGateCard: React.FC<Props> = ({ children, title, body, compact = false, icon: Icon }) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const { allowed, status } = useProFeatureAccess();
  const trialAvailable = isTrialAvailableFromStatus(status);
  const trialDays = trialDaysFromStatus(status);
  const copy = getUpgradeCtaCopy({ trialAvailable, trialDays });

  if (!allowed) {
    return (
      <View style={[
        styles.card,
        compact ? styles.cardCompact : null,
        { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface },
      ]}>
        <View style={[styles.icon, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon size={22} strokeWidth={ICON_STROKE} color={theme.colors.primary} />
        </View>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
        <Text style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>{body}</Text>
        <TouchableOpacity
          style={[styles.cta, { backgroundColor: theme.colors.primary }]}
          onPress={() => navigateToUpgradePlans()}
          activeOpacity={0.85}
        >
          <Text style={[styles.ctaText, { color: theme.colors.onPrimary }]}>{copy.label}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: 'center',
  },
  cardCompact: {
    marginTop: 12,
    marginHorizontal: 0,
    paddingVertical: 20,
    width: '100%',
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: Fonts.display.semiBold,
    fontSize: 20,
    textAlign: 'center',
  },
  body: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  cta: {
    marginTop: 20,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  ctaText: {
    fontFamily: Fonts.display.semiBold,
    fontSize: 14,
  },
});

export default ProFeatureGateCard;
