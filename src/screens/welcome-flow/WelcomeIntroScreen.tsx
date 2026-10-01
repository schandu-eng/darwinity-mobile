import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, Pressable, Platform, Image } from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  WelcomeFlowShell,
  OnboardingPrimaryButton,
} from '@/components/welcome-flow/WelcomeFlowShell';
import { ONBOARDING_LIGHT } from '@/components/welcome-flow/welcomeFlowTheme';
import {
  BRAND_CTA,
  BRAND_EYEBROW,
  BRAND_NAME,
  BRAND_SUPPORT,
  BRAND_TAGLINE,
} from '@/config/brand';
import { Fonts } from '@/config/fonts';
import { useOnboardingStore } from '@/store';
import { ONBOARDING_FINAL_STEP, onboardingStepIndex } from '@/utils/welcomeFlowSteps';
import type { OnboardingStackParamList } from '@/types/navigation';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'Welcome'>;
type PressState = {
  pressed: boolean;
  hovered?: boolean;
};

const c = ONBOARDING_LIGHT;
const DARWIN_FACE = require('../../../assets/onboarding-darwin.png');
const PORTRAIT = 128;

const WelcomeIntroScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const setCurrentStep = useOnboardingStore((s) => s.setCurrentStep);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);

  const markOpacity = useSharedValue(0);
  const markScale = useSharedValue(0.9);
  const textOpacity = useSharedValue(0);
  const textY = useSharedValue(16);
  const ctaOpacity = useSharedValue(0);

  useEffect(() => {
    const ease = Easing.out(Easing.cubic);
    markOpacity.value = withTiming(1, { duration: 560, easing: ease });
    markScale.value = withTiming(1, { duration: 600, easing: ease });
    textOpacity.value = withDelay(200, withTiming(1, { duration: 480, easing: ease }));
    textY.value = withDelay(200, withTiming(0, { duration: 480, easing: ease }));
    ctaOpacity.value = withDelay(380, withTiming(1, { duration: 420, easing: ease }));
  }, [markOpacity, markScale, textOpacity, textY, ctaOpacity]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textY.value }],
  }));
  const ctaStyle = useAnimatedStyle(() => ({ opacity: ctaOpacity.value }));

  const handleStart = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setCurrentStep(onboardingStepIndex('Trail'));
    navigation.navigate('Trail');
  }, [navigation, setCurrentStep]);

  const handleHaveAccount = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    analytics.track(EVENTS.ONBOARDING_COMPLETED, { via: 'have_account' });
    await completeOnboarding();
  }, [completeOnboarding]);

  const handleSkipTour = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setCurrentStep(ONBOARDING_FINAL_STEP);
    navigation.navigate('Arrive');
  }, [navigation, setCurrentStep]);

  return (
    <WelcomeFlowShell
      step="Welcome"
      hideBack
      hideProgress
      onSkip={handleSkipTour}
      centered
      footer={
        <Animated.View style={ctaStyle}>
          <OnboardingPrimaryButton label={BRAND_CTA} onPress={handleStart} />
          <Pressable
            onPress={handleHaveAccount}
            hitSlop={8}
            accessibilityRole="link"
            accessibilityLabel="I already have an account"
            style={({ pressed }: PressState) => [
              styles.secondaryLink,
              pressed && styles.secondaryPressed,
            ]}
          >
            {({ hovered }: PressState) => (
              <Text style={[styles.secondaryText, hovered && styles.secondaryHovered]}>
                I already have an account
              </Text>
            )}
          </Pressable>
        </Animated.View>
      }
    >
      <View style={styles.hero}>
        <Animated.View style={[styles.portraitWrap, markStyle]}>
          <View style={styles.portraitInner}>
            <Image
              source={DARWIN_FACE}
              style={styles.portrait}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
              accessibilityLabel="Charles Darwin"
            />
          </View>
        </Animated.View>
        <Animated.View style={[styles.copy, textStyle]}>
          <Text style={styles.eyebrow}>{BRAND_EYEBROW}</Text>
          <Text style={styles.brand}>{BRAND_NAME}</Text>
          <Text style={styles.line}>{BRAND_TAGLINE}</Text>
          <Text style={styles.tagline}>{BRAND_SUPPORT}</Text>
        </Animated.View>
      </View>
    </WelcomeFlowShell>
  );
};

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: 24,
    paddingBottom: 8,
  },
  portraitWrap: {
    width: PORTRAIT,
    height: PORTRAIT,
    borderRadius: PORTRAIT / 2,
    padding: 5,
    backgroundColor: '#D8E5DC',
    borderWidth: 1.5,
    borderTopColor: '#F4FAF6',
    borderLeftColor: '#EEF6F1',
    borderRightColor: '#A8C4B0',
    borderBottomColor: '#8FB59A',
    ...Platform.select({
      web: {
        boxShadow: '0 16px 36px rgba(26, 47, 35, 0.14)',
      },
      default: {
        shadowColor: c.ink,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 18,
        elevation: 5,
      },
    }),
  },
  portraitInner: {
    flex: 1,
    borderRadius: PORTRAIT / 2,
    overflow: 'hidden',
    backgroundColor: '#E8E4DB',
    borderWidth: 1,
    borderColor: 'rgba(26, 47, 35, 0.12)',
  },
  portrait: {
    width: '100%',
    height: '100%',
  },
  copy: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  eyebrow: {
    fontFamily: Fonts.ui.medium,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: c.growth,
  },
  brand: {
    fontFamily: Fonts.display.extraBold,
    fontSize: 40,
    letterSpacing: -1.6,
    lineHeight: 44,
    textAlign: 'center',
    color: c.ink,
  },
  line: {
    fontFamily: Fonts.display.semiBold,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    color: c.growth,
    letterSpacing: -0.3,
  },
  tagline: {
    fontFamily: Fonts.body.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: c.mute,
    maxWidth: 340,
    marginTop: 4,
  },
  secondaryLink: {
    alignItems: 'center',
    paddingVertical: 16,
    ...Platform.select({
      web: { cursor: 'pointer' },
      default: {},
    }),
  },
  secondaryPressed: {
    opacity: 0.7,
  },
  secondaryText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
    color: c.ink,
  },
  secondaryHovered: {
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(26, 47, 35, 0.35)',
  },
});

export default WelcomeIntroScreen;
