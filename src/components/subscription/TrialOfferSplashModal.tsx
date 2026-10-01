import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useAuthStore, useBillingPlanStore, useOnboardingStore } from '@/store';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import { navigateToUpgradePlans } from '@/navigation/navigationRef';
import { Fonts } from '@/config/fonts';
import {
  hasSeenTrialOfferSplash,
  markTrialOfferSplashSeen,
  shouldOfferTrialSplash,
  trialDaysFromStatus,
} from '@/utils/trialOfferSplash';
import { formatTrialDuration } from '@/utils/trialAvailability';

/**
 * Post-signup splash: try unlimited free trial, or skip.
 * Shown once after welcome onboarding when trial is still available.
 */
const TrialOfferSplashModal: React.FC = () => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);
  const country = useAuthStore((s) => s.user?.country);
  const hasSeenOnboarding = useOnboardingStore((s) => s.hasSeenOnboarding);
  const status = useBillingPlanStore((s) => s.status);
  const isLoadingBilling = useBillingPlanStore((s) => s.isLoading);
  const [open, setOpen] = useState(false);
  const finishedRef = useRef(false);

  const finish = useCallback(
    async (via: string) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      await markTrialOfferSplashSeen(userId);
      analytics.track(EVENTS.PAYWALL_DISMISSED, {
        via,
        surface: 'trial_offer_splash',
      });
      setOpen(false);
    },
    [userId]
  );

  useEffect(() => {
    finishedRef.current = false;
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isAuthenticated || !userId || !hasSeenOnboarding) return;
      if (isLoadingBilling && !status) return;
      if (!(await hasSeenTrialOfferSplash(userId))) {
        if (!shouldOfferTrialSplash(status, country)) {
          await markTrialOfferSplashSeen(userId);
          return;
        }
        if (cancelled) return;
        setOpen(true);
        analytics.track(EVENTS.PAYWALL_HIT, { surface: 'trial_offer_splash' });
      }
    };
    const t = setTimeout(() => {
      void run();
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isAuthenticated, userId, hasSeenOnboarding, status, isLoadingBilling, country]);

  const handleTry = async () => {
    finishedRef.current = true;
    await markTrialOfferSplashSeen(userId);
    analytics.track(EVENTS.UPGRADE_CLICKED, {
      source: 'trial_offer_splash',
      mode: 'trial',
    });
    setOpen(false);
    navigateToUpgradePlans();
  };

  if (!open) return null;

  const trialDays = trialDaysFromStatus(status, country);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => finish('dismiss')}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name="star-four-points" size={22} color={theme.colors.primary} />
          </View>

          <Text style={[styles.title, { color: theme.colors.onSurface }]}>
            Try unlimited access free
          </Text>
          <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
            Unlock unlimited uploads, AI chat, podcasts, and study games for {formatTrialDuration(trialDays)}.
            Cancel anytime before the trial ends.
          </Text>

          <TouchableOpacity
            onPress={() => {
              void handleTry();
            }}
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Try unlimited access for free"
          >
            <Text style={[styles.primaryButtonText, { color: theme.colors.onPrimary }]}>
              Try unlimited access for free
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              void finish('skip');
            }}
            style={styles.skipButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Skip"
          >
            <Text style={[styles.skipText, { color: theme.colors.onSurfaceVariant }]}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: Fonts.display.bold,
    fontSize: 22,
    letterSpacing: -0.4,
    marginBottom: 10,
  },
  message: {
    fontFamily: Fonts.body.regular,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22,
  },
  primaryButton: {
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontFamily: Fonts.body.bold,
    fontSize: 16,
  },
  skipButton: {
    marginTop: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  skipText: {
    fontFamily: Fonts.body.medium,
    fontSize: 13,
  },
});

export default TrialOfferSplashModal;
