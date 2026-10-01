import React from 'react';
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BRAND_COLORS } from '@/config/brand';
import { pointerEventsProp, pointerEventsStyle } from '@/theme/webCompat';

/** Matches web `.dw-auth__panel` linear gradient (155deg inkHover → ink → inkDeep). */
export const INK_PANEL_GRADIENT = {
  colors: [BRAND_COLORS.inkHover, BRAND_COLORS.ink, BRAND_COLORS.inkDeep] as const,
  locations: [0, 0.48, 1] as const,
  start: { x: 0.15, y: 0 },
  end: { x: 0.9, y: 1 },
};

type InkPanelGradientProps = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Soft radial washes from the web login brand panel. Off for small controls. */
  glow?: boolean;
};

export const InkPanelGradient: React.FC<InkPanelGradientProps> = ({
  children,
  style,
  contentStyle,
  glow = true,
}) => (
  <View style={[styles.root, style]}>
    <LinearGradient
      colors={INK_PANEL_GRADIENT.colors}
      locations={INK_PANEL_GRADIENT.locations}
      start={INK_PANEL_GRADIENT.start}
      end={INK_PANEL_GRADIENT.end}
      style={[StyleSheet.absoluteFill, pointerEventsStyle('none')]}
      pointerEvents={pointerEventsProp('none')}
    />
    {/* Radial washes rely on CSS blur; skip on native to avoid hard oval blobs. */}
    {glow && Platform.OS === 'web' ? (
      <>
        <View
          style={[styles.glowA, pointerEventsStyle('none')]}
          pointerEvents={pointerEventsProp('none')}
        />
        <View
          style={[styles.glowB, pointerEventsStyle('none')]}
          pointerEvents={pointerEventsProp('none')}
        />
      </>
    ) : null}
    <View style={[styles.content, contentStyle]}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
  glowA: {
    position: 'absolute',
    width: 220,
    height: 180,
    borderRadius: 110,
    backgroundColor: 'rgba(63, 107, 79, 0.55)',
    top: -72,
    left: -48,
    ...Platform.select({
      web: { filter: 'blur(28px)' },
      default: { opacity: 0.7 },
    }),
  },
  glowB: {
    position: 'absolute',
    width: 180,
    height: 150,
    borderRadius: 90,
    backgroundColor: 'rgba(9, 9, 11, 0.35)',
    bottom: -64,
    right: -40,
    ...Platform.select({
      web: { filter: 'blur(24px)' },
      default: { opacity: 0.65 },
    }),
  },
});

export default InkPanelGradient;
