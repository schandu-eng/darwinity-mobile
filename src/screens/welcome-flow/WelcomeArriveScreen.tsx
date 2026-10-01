import React, { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useOnboardingStore, useAuthStore } from '@/store';
import { WelcomeFlowShell } from '@/components/welcome-flow/WelcomeFlowShell';
import { ONBOARDING_LIGHT } from '@/components/welcome-flow/welcomeFlowTheme';
import { Fonts } from '@/config/fonts';
import type { OnboardingStackParamList } from '@/types/navigation';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'Arrive'>;

const c = ONBOARDING_LIGHT;

const WelcomeArriveScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const completeOnboarding = useOnboardingStore((state) => state.completeOnboarding);

  const handleJoin = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    analytics.track(EVENTS.ONBOARDING_COMPLETED);
    const user = useAuthStore.getState().user;
    if (user?.id) {
      analytics.identify(String(user.id), {
        ...(user.email ? { email: user.email, $email: user.email } : {}),
      });
    }
    await completeOnboarding();
  }, [completeOnboarding]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  return (
    <WelcomeFlowShell
      step="Arrive"
      onBack={handleBack}
      hideSkip
      centered
      footer={
        <TouchableOpacity
          style={styles.cta}
          onPress={handleJoin}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Continue"
        >
          <Text style={styles.ctaText}>Continue</Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.stack}>
        <View style={styles.flag}>
          <MaterialCommunityIcons name="flag-checkered" size={28} color={c.growth} />
        </View>
        <Text style={styles.title}>You’re ready.</Text>
        <Text style={styles.body}>Sign in and start remembering.</Text>
      </View>
    </WelcomeFlowShell>
  );
};

const styles = StyleSheet.create({
  stack: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 12,
  },
  flag: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: c.growthSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: Fonts.display.bold,
    fontSize: 32,
    letterSpacing: -0.9,
    lineHeight: 38,
    textAlign: 'center',
    color: c.ink,
  },
  body: {
    fontFamily: Fonts.body.regular,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: c.mute,
    maxWidth: 280,
  },
  cta: {
    borderRadius: 14,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.ink,
  },
  ctaText: {
    fontFamily: Fonts.body.bold,
    fontSize: 17,
    color: c.white,
  },
});

export default WelcomeArriveScreen;
