import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Fonts } from '@/config/fonts';
import { FlipHorizontal2, Sparkles } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { BRAND_COLORS } from '@/config/brand';
import { STUDY_INK } from './studyPanelTokens';
import { boxShadow, pointerEventsProp, pointerEventsStyle } from '@/theme/webCompat';

/** Stacked-card empty preview from phone-web `EmptyDeckPreview`. */
export const EmptyDeckPreview: React.FC = () => (
  <View style={[styles.wrap, pointerEventsStyle('none')]} pointerEvents={pointerEventsProp('none')}>
    <View style={[styles.plane, styles.back]} />
    <View style={[styles.plane, styles.mid]} />
    <View style={styles.front}>
      <View style={styles.topRow}>
        <View style={styles.frontBadge}>
          <Text style={styles.frontBadgeText}>Front</Text>
        </View>
        <View style={styles.sparkle}>
          <Sparkles size={12} strokeWidth={ICON_STROKE} color={STUDY_INK} />
        </View>
      </View>
      <View style={styles.lines}>
        <View style={[styles.line, { width: '90%' }]} />
        <View style={[styles.line, { width: '68%' }]} />
        <View style={[styles.line, { width: '78%', backgroundColor: BRAND_COLORS.paper }]} />
      </View>
      <View style={styles.bottomRow}>
        <Text style={styles.hint}>Tap to flip</Text>
        <View style={styles.flip}>
          <FlipHorizontal2 size={14} strokeWidth={ICON_STROKE} color="#fff" />
        </View>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    height: 216,
    width: '100%',
    maxWidth: 288,
    alignSelf: 'center',
    marginBottom: 8,
  },
  plane: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 144,
    borderRadius: 16,
  },
  back: {
    top: 28,
    left: 28,
    right: 28,
    backgroundColor: STUDY_INK,
    transform: [{ rotate: '-10deg' }],
  },
  mid: {
    top: 14,
    left: 14,
    right: 14,
    backgroundColor: BRAND_COLORS.paper,
    borderWidth: 1,
    borderColor: BRAND_COLORS.paperDeep,
    transform: [{ rotate: '5deg' }],
  },
  front: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 164,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND_COLORS.paperDeep,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    ...boxShadow('0 12px 32px rgba(26,47,35,0.12)', {
      shadowColor: '#1A2F23',
      shadowOpacity: 0.12,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 5,
    }),
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  frontBadge: {
    backgroundColor: STUDY_INK,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  frontBadgeText: {
    fontFamily: Fonts.ui.bold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#fff',
  },
  sparkle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lines: { marginTop: 16, gap: 10 },
  line: { height: 10, borderRadius: 999, backgroundColor: BRAND_COLORS.paperDeep },
  bottomRow: {
    marginTop: 'auto',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
  },
  hint: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 10,
    letterSpacing: 0.4,
    color: '#A1A1AA',
  },
  flip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: STUDY_INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
