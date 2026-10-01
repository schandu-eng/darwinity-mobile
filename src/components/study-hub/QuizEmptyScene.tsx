import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Fonts } from '@/config/fonts';
import { boxShadow } from '@/theme/webCompat';

const POINTER_NONE = { pointerEvents: 'none' } as ViewStyle;

/** Decorative empty card (ported from web `.dw-quiz-empty-scene`).
 * Quiz no longer shows this as a start gate; PodcastTab reuses it for generate. */
export const QuizEmptyScene: React.FC = () => (
  <View style={[styles.scene, POINTER_NONE]} pointerEvents="none">
    <View style={[styles.chip, styles.chipQ]}>
      <Text style={styles.chipText}>?</Text>
    </View>
    <View style={[styles.chip, styles.chipOk]}>
      <Text style={styles.chipText}>✓</Text>
    </View>
    <View style={[styles.chip, styles.chipStar]}>
      <Text style={styles.chipText}>★</Text>
    </View>
    <View style={styles.card}>
      <View style={styles.qBar} />
      <View style={[styles.qBar, styles.qBarShort]} />
      <View style={styles.choices}>
        <View style={styles.choice}>
          <Text style={styles.choiceMark}>A</Text>
          <Text style={styles.choiceLabel}>Option</Text>
        </View>
        <View style={[styles.choice, styles.choiceOk]}>
          <Text style={[styles.choiceMark, styles.choiceMarkOk]}>✓</Text>
          <Text style={[styles.choiceLabel, styles.choiceLabelOk]}>Correct</Text>
        </View>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  scene: {
    height: 136,
    width: '100%',
    maxWidth: 280,
    alignSelf: 'center',
    marginBottom: 8,
  },
  chip: {
    position: 'absolute',
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipQ: { left: 8, top: 8, backgroundColor: '#E8EDE9' },
  chipOk: { right: 18, top: 4, backgroundColor: '#DDE8E0' },
  chipStar: { right: 4, top: 44, backgroundColor: '#FEF3C7' },
  chipText: { fontFamily: Fonts.ui.bold, fontSize: 13, color: '#3F6B4F' },
  card: {
    position: 'absolute',
    left: '50%',
    top: 14,
    width: 184,
    marginLeft: -92,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(95,127,106,0.18)',
    transform: [{ rotate: '-2deg' }],
    ...boxShadow('0 8px 16px rgba(26,47,35,0.12)', {
      shadowColor: '#1A2F23',
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    }),
  },
  qBar: {
    height: 7,
    width: '78%',
    borderRadius: 999,
    backgroundColor: '#3d5646',
    marginBottom: 8,
  },
  qBarShort: { width: '52%', opacity: 0.45, backgroundColor: '#9bb8a6' },
  choices: { marginTop: 6, gap: 6 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(24,24,27,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#FAFAF9',
  },
  choiceOk: {
    backgroundColor: '#E8F0EA',
    borderColor: 'rgba(63,107,79,0.28)',
  },
  choiceMark: { fontFamily: Fonts.ui.semiBold, fontSize: 11, color: '#71717A', width: 14 },
  choiceMarkOk: { color: '#3F6B4F' },
  choiceLabel: { fontFamily: Fonts.ui.medium, fontSize: 12, color: '#52525B' },
  choiceLabelOk: { color: '#1A2F23' },
});
