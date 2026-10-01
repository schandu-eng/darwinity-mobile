import React from 'react';
import { View, StyleSheet, Pressable, Image, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import {
  ArrowRight,
  FlipHorizontal2,
  Gamepad2,
  GitBranch,
  Headphones,
  MessageCircle,
  NotebookPen,
  Sparkles,
  Timer,
  type LucideIcon,
} from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { BRAND_COLORS } from '@/config/brand';
import { useAppTheme } from '@/store/appThemeStore';

const DARWIN_FACE = require('../../../assets/onboarding-darwin.png');

type ToolkitItem = {
  icon: LucideIcon;
  title: string;
  toneBg: string;
  toneBgDark: string;
  toneFg: string;
  toneFgDark: string;
};

const TOOLKIT: ToolkitItem[] = [
  {
    icon: NotebookPen,
    title: 'Notes',
    toneBg: '#E8F0EB',
    toneBgDark: 'rgba(63,107,79,0.25)',
    toneFg: BRAND_COLORS.ink,
    toneFgDark: '#9BB8A6',
  },
  {
    icon: GitBranch,
    title: 'Mind map',
    toneBg: '#F5F3FF',
    toneBgDark: 'rgba(76,29,149,0.35)',
    toneFg: '#4C1D95',
    toneFgDark: '#DDD6FE',
  },
  {
    icon: FlipHorizontal2,
    title: 'Flashcards',
    toneBg: '#ECFDF5',
    toneBgDark: 'rgba(6,78,59,0.35)',
    toneFg: '#064E3B',
    toneFgDark: '#A7F3D0',
  },
  {
    icon: Sparkles,
    title: 'Quizzes',
    toneBg: '#FFFBEB',
    toneBgDark: 'rgba(120,53,15,0.35)',
    toneFg: '#78350F',
    toneFgDark: '#FDE68A',
  },
  {
    icon: Gamepad2,
    title: 'Games',
    toneBg: '#FFF1F2',
    toneBgDark: 'rgba(136,19,55,0.35)',
    toneFg: '#881337',
    toneFgDark: '#FECDD3',
  },
  {
    icon: Headphones,
    title: 'Podcast',
    toneBg: '#F0F9FF',
    toneBgDark: 'rgba(12,74,110,0.35)',
    toneFg: '#0C4A6E',
    toneFgDark: '#BAE6FD',
  },
  {
    icon: MessageCircle,
    title: 'Ask AI',
    toneBg: '#F0FDFA',
    toneBgDark: 'rgba(19,78,74,0.35)',
    toneFg: '#134E4A',
    toneFgDark: '#99F6E4',
  },
  {
    icon: Timer,
    title: 'Focus',
    toneBg: '#FFF7ED',
    toneBgDark: 'rgba(154,52,18,0.35)',
    toneFg: '#9A3412',
    toneFgDark: '#FED7AA',
  },
];

const STEPS = [
  { n: '1', t: 'Feed it' },
  { n: '2', t: 'Evolve it' },
  { n: '3', t: 'Remember it' },
];

type HubNotesEmptyProps = {
  onUpload: () => void;
};

/** Phone-web first-run empty trail (`HubNotesEmpty.jsx`). */
export const HubNotesEmpty: React.FC<HubNotesEmptyProps> = ({ onUpload }) => {
  const isDark = useAppTheme() === 'dark';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#111113' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(228,228,231,0.9)',
        },
      ]}
      accessibilityLabel="Start studying"
    >
      <View style={styles.pitch}>
        <Image source={DARWIN_FACE} style={styles.face} accessibilityIgnoresInvertColors />
        <View style={styles.pitchCopy}>
          <Text style={[styles.eyebrow, { color: isDark ? '#9BB8A6' : BRAND_COLORS.ink }]}>
            Your trail starts empty
          </Text>
          <Text style={[styles.title, { color: isDark ? '#FAFAFA' : '#18181B' }]}>
            Feed once. Unlock the whole toolkit.
          </Text>
        </View>
      </View>

      <View style={styles.steps} accessibilityLabel="How it works">
        {STEPS.map((step) => (
          <View
            key={step.n}
            style={[
              styles.stepChip,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FAFAFA' },
            ]}
          >
            <View style={[styles.stepNum, { backgroundColor: BRAND_COLORS.ink }]}>
              <Text style={styles.stepNumText}>{step.n}</Text>
            </View>
            <Text
              numberOfLines={1}
              style={[styles.stepLabel, { color: isDark ? '#F4F4F5' : '#27272A' }]}
            >
              {step.t}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[styles.unlockLabel, { color: isDark ? '#71717A' : '#A1A1AA' }]}>
        What you unlock
      </Text>
      <View style={styles.toolkit} accessibilityLabel="Study tools included with every upload">
        {TOOLKIT.map(({ icon: Icon, title, toneBg, toneBgDark, toneFg, toneFgDark }) => (
          <View
            key={title}
            style={[
              styles.toolCell,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(250,250,250,0.8)',
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F5',
              },
            ]}
          >
            <View
              style={[
                styles.toolIcon,
                {
                  backgroundColor: isDark ? toneBgDark : toneBg,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)',
                },
              ]}
            >
              <Icon size={14} strokeWidth={1.75} color={isDark ? toneFgDark : toneFg} />
            </View>
            <Text
              numberOfLines={1}
              style={[styles.toolTitle, { color: isDark ? '#D4D4D8' : '#52525B' }]}
            >
              {title}
            </Text>
          </View>
        ))}
      </View>

      <Pressable
        onPress={onUpload}
        style={({ pressed }) => [
          styles.cta,
          {
            backgroundColor: isDark ? BRAND_COLORS.growth : BRAND_COLORS.growth,
            opacity: pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Upload something"
      >
        <Text style={styles.ctaText}>Upload something</Text>
        <ArrowRight size={16} strokeWidth={ICON_STROKE} color="#FAFAFA" />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 16,
    marginTop: 4,
  },
  pitch: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  face: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(26,47,35,0.15)',
  },
  pitchCopy: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 2,
    fontFamily: Fonts.ui.semiBold,
    fontSize: 16,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  steps: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 6,
  },
  stepChip: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  stepNum: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    fontFamily: Fonts.ui.bold,
    fontSize: 9,
    color: '#FAFAFA',
  },
  stepLabel: {
    flex: 1,
    fontFamily: Fonts.ui.semiBold,
    fontSize: 11,
  },
  unlockLabel: {
    marginTop: 12,
    fontFamily: Fonts.ui.semiBold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  toolkit: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  toolCell: {
    width: '23%',
    flexGrow: 1,
    aspectRatio: 1,
    maxWidth: '24.5%',
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  toolIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolTitle: {
    fontFamily: Fonts.ui.medium,
    fontSize: 10,
    lineHeight: 12,
    textAlign: 'center',
  },
  cta: {
    marginTop: 12,
    height: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: BRAND_COLORS.growth,
        shadowOpacity: 0.28,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 4 },
    }),
  },
  ctaText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
    color: '#FAFAFA',
  },
});
