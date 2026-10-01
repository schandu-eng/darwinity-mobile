import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ONBOARDING_STEP_COUNT,
  onboardingStepIndex,
  type OnboardingStepName,
} from '@/utils/welcomeFlowSteps';
import { ONBOARDING_GRADIENT, ONBOARDING_LIGHT } from './welcomeFlowTheme';
import { Fonts } from '@/config/fonts';

type PressState = {
  pressed: boolean;
  hovered?: boolean;
};

type WelcomeFlowShellProps = {
  step: OnboardingStepName;
  progressOverride?: number;
  onBack?: () => void;
  onSkip?: () => void;
  hideBack?: boolean;
  hideSkip?: boolean;
  hideProgress?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  centered?: boolean;
};

export const WelcomeFlowShell: React.FC<WelcomeFlowShellProps> = ({
  step,
  onBack,
  onSkip,
  hideBack = false,
  hideSkip = false,
  hideProgress = false,
  footer,
  children,
  contentStyle,
  centered = true,
}) => {
  const insets = useSafeAreaInsets();
  const activeIndex = onboardingStepIndex(step);
  const c = ONBOARDING_LIGHT;

  return (
    <View style={[styles.root, { backgroundColor: c.paper }]}>
      <LinearGradient colors={ONBOARDING_GRADIENT} style={StyleSheet.absoluteFill} />
      {/* CSS blur only works on web; solid ovals look like hard blobs on native. */}
      {Platform.OS === 'web' ? (
        <>
          <View style={styles.glowTop} />
          <View style={styles.glowBottom} />
        </>
      ) : null}

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View
          style={[
            styles.header,
            { paddingTop: Platform.OS === 'ios' ? 8 : Math.max(insets.top * 0, 8) },
          ]}
        >
          {hideBack ? (
            <View style={styles.headerSide} />
          ) : (
            <Pressable
              onPress={onBack}
              style={({ pressed }: PressState) => [
                styles.headerSide,
                pressed && styles.headerPressed,
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <MaterialCommunityIcons name="arrow-left" size={22} color={c.ink} />
            </Pressable>
          )}

          {!hideProgress ? (
            <View
              style={styles.dots}
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 1,
                max: ONBOARDING_STEP_COUNT,
                now: activeIndex + 1,
              }}
            >
              {Array.from({ length: ONBOARDING_STEP_COUNT }).map((_, i) => {
                const filled = i <= activeIndex;
                return (
                  <View
                    key={`dot-${i}`}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: filled ? c.growth : 'rgba(26,47,35,0.14)',
                        width: filled ? 18 : 7,
                      },
                    ]}
                  />
                );
              })}
            </View>
          ) : (
            <View style={styles.dots} />
          )}

          {hideSkip || !onSkip ? (
            <View style={styles.headerSide} />
          ) : (
            <Pressable
              onPress={onSkip}
              style={({ pressed, hovered }: PressState) => [
                styles.headerSide,
                styles.skipHit,
                hovered && styles.skipHitHover,
                pressed && styles.headerPressed,
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Skip tour"
            >
              {({ hovered }: PressState) => (
                <Text style={[styles.skipText, hovered && styles.skipTextHover]}>Skip</Text>
              )}
            </Pressable>
          )}
        </View>

        <View style={[styles.body, centered && styles.bodyCentered, contentStyle]}>
          {children}
        </View>

        {footer ? (
          <View
            style={[
              styles.footer,
              { paddingBottom: Platform.OS === 'ios' ? 16 : Math.max(insets.bottom, 16) },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
};

type OnboardingCopyProps = {
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
  eyebrow?: string;
};

export const OnboardingCopy: React.FC<OnboardingCopyProps> = ({
  title,
  subtitle,
  align = 'center',
  eyebrow,
}) => {
  const c = ONBOARDING_LIGHT;
  const textAlign = align;

  return (
    <View style={[styles.copy, align === 'left' && styles.copyLeft]}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, { color: c.growth, textAlign }]}>{eyebrow}</Text>
      ) : null}
      <Text style={[styles.title, { color: c.ink, textAlign }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: c.mute, textAlign }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
};

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export const OnboardingPrimaryButton: React.FC<PrimaryButtonProps> = ({
  label,
  onPress,
  disabled = false,
}) => (
  <Pressable
    style={({ pressed, hovered }: PressState) => [
      styles.primaryButton,
      hovered && !disabled && styles.primaryButtonHover,
      pressed && !disabled && styles.primaryButtonPressed,
      disabled && styles.primaryButtonDisabled,
    ]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled }}
  >
    <Text style={styles.primaryButtonText}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  glowTop: {
    position: 'absolute',
    pointerEvents: 'none',
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: 'rgba(24, 24, 27, 0.04)',
    top: -120,
    left: -90,
    ...Platform.select({
      web: { filter: 'blur(48px)' },
      default: { opacity: 0.85 },
    }),
  },
  glowBottom: {
    position: 'absolute',
    pointerEvents: 'none',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(24, 24, 27, 0.04)',
    bottom: -80,
    right: -70,
    ...Platform.select({
      web: { filter: 'blur(44px)' },
      default: { opacity: 0.7 },
    }),
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 8,
  },
  headerSide: {
    minWidth: 64,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  skipHit: {
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    borderRadius: 999,
    ...Platform.select({
      web: { cursor: 'pointer' },
      default: {},
    }),
  },
  skipHitHover: {
    backgroundColor: 'rgba(26, 47, 35, 0.06)',
  },
  headerPressed: {
    opacity: 0.7,
  },
  dots: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  skipText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
    color: ONBOARDING_LIGHT.ink,
    opacity: 0.72,
  },
  skipTextHover: {
    opacity: 1,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
  },
  bodyCentered: {
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 8,
  },
  copy: {
    alignItems: 'center',
    marginBottom: 22,
    gap: 8,
  },
  copyLeft: {
    alignItems: 'flex-start',
  },
  eyebrow: {
    fontFamily: Fonts.body.semiBold,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontFamily: Fonts.display.bold,
    fontSize: 28,
    letterSpacing: -0.7,
    lineHeight: 34,
  },
  subtitle: {
    fontFamily: Fonts.body.regular,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
  },
  primaryButton: {
    backgroundColor: ONBOARDING_LIGHT.ink,
    borderRadius: 14,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    ...Platform.select({
      web: {
        cursor: 'pointer',
        boxShadow: '0 10px 24px rgba(26, 47, 35, 0.18)',
        transitionDuration: '200ms',
        transitionProperty: 'transform, box-shadow, background-color',
      },
      default: {
        shadowColor: ONBOARDING_LIGHT.ink,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
        elevation: 4,
      },
    }),
  },
  primaryButtonHover: {
    backgroundColor: ONBOARDING_LIGHT.inkHover,
    ...Platform.select({
      web: {
        transform: [{ translateY: -1 }],
        boxShadow: '0 14px 28px rgba(26, 47, 35, 0.22)',
      },
      default: {},
    }),
  },
  primaryButtonPressed: {
    ...Platform.select({
      web: {
        transform: [{ translateY: 0 }],
        boxShadow: '0 6px 16px rgba(26, 47, 35, 0.16)',
      },
      default: {
        opacity: 0.92,
      },
    }),
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: ONBOARDING_LIGHT.white,
    fontFamily: Fonts.ui.semiBold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
});

export default WelcomeFlowShell;
