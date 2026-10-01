import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { Podcast } from '@/icons';
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

export function usePodcastAccess() {
  return useProFeatureAccess();
}

type Props = {
  children?: React.ReactNode;
};

const PodcastProGate: React.FC<Props> = ({ children }) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const { allowed, isLoading, status } = usePodcastAccess();
  const trialAvailable = isTrialAvailableFromStatus(status);
  const trialDays = trialDaysFromStatus(status);
  const copy = getUpgradeCtaCopy({ trialAvailable, trialDays });

  if (!allowed) {
    if (isLoading && !status) {
      return null;
    }
    return (
      <View style={[styles.card, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }]}>
        <View style={[styles.icon, { backgroundColor: theme.colors.primaryContainer }]}>
          <Podcast size={22} strokeWidth={ICON_STROKE} color={theme.colors.primary} />
        </View>
        <Text style={[styles.title, { color: theme.colors.onSurface }]}>Podcasts are a Pro feature</Text>
        <Text style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>
          Turn your notes into audio lessons you can review on the go. Included with Pro.
        </Text>
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

export default PodcastProGate;
