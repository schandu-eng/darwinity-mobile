import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Text } from 'react-native-paper';
import { Gamepad2 } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { useAppTheme } from '@/store/appThemeStore';
import { STUDY_INK, STUDY_PAPER, STUDY_PAPER_DARK, STUDY_ZINC_500 } from '../studyPanelTokens';

const ORB_LABELS = ['A', 'Mid', 'D'];

/** Arcade boot screen — not the notes Darwin trail. */
export const GamesGeneratingScreen: React.FC = () => {
  const isDark = (useAppTheme() as 'light' | 'dark') === 'dark';
  const runner = useRef(new Animated.Value(0)).current;
  const scroll = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const hop = Animated.loop(
      Animated.sequence([
        Animated.timing(runner, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(runner, { toValue: -1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(runner, { toValue: 0, duration: 420, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const road = Animated.loop(
      Animated.timing(scroll, { toValue: 1, duration: 700, easing: Easing.linear, useNativeDriver: true }),
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    hop.start();
    road.start();
    glow.start();
    return () => {
      hop.stop();
      road.stop();
      glow.stop();
    };
  }, [pulse, runner, scroll]);

  const runnerX = runner.interpolate({ inputRange: [-1, 0, 1], outputRange: [-42, 0, 42] });
  const runnerY = runner.interpolate({ inputRange: [-1, 0, 1], outputRange: [-3, -8, -3] });
  const roadY = scroll.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });
  const orbScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <View style={[styles.shell, { backgroundColor: isDark ? STUDY_PAPER_DARK : STUDY_PAPER }]}>
      <View style={[styles.stage, { backgroundColor: isDark ? '#1a221e' : '#dce8e0', borderColor: isDark ? 'rgba(180,90,90,0.28)' : 'rgba(95,127,106,0.22)' }]}>
        <View style={styles.lanes} />
        <Animated.View style={[styles.rungs, { transform: [{ translateY: roadY }] }]} />
        {ORB_LABELS.map((label, i) => (
          <Animated.View
            key={label}
            style={[
              styles.orb,
              i === 0 && styles.orbA,
              i === 1 && styles.orbB,
              i === 2 && styles.orbC,
              {
                transform: [
                  { scale: orbScale },
                  { translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, i === 1 ? -6 : 4] }) },
                ],
              },
            ]}
          >
            <Text style={styles.orbText}>{label}</Text>
          </Animated.View>
        ))}
        <Animated.View style={[styles.runner, { transform: [{ translateX: runnerX }, { translateY: runnerY }] }]}>
          <View style={styles.runnerBody} />
        </Animated.View>
      </View>

      <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(180,90,90,0.18)' : '#e8f0ea' }]}>
        <Gamepad2 size={16} strokeWidth={ICON_STROKE} color={isDark ? '#e0a8a8' : '#3d5646'} />
        <Text style={[styles.badgeText, { color: isDark ? '#e0a8a8' : '#3d5646' }]}>Warming up</Text>
      </View>
      <Text style={[styles.title, { color: isDark ? '#F4F7F5' : STUDY_INK }]}>Building your arena</Text>
      <Text style={[styles.copy, { color: isDark ? '#9AA89F' : STUDY_ZINC_500 }]}>
        Writing short questions from your notes — then it is time to dodge, type, and hunt.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stage: {
    width: '100%',
    maxWidth: 320,
    height: 168,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 22,
  },
  lanes: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
    marginHorizontal: '28%',
  },
  rungs: {
    position: 'absolute',
    left: '18%',
    right: '18%',
    top: -18,
    bottom: -18,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  orb: {
    position: 'absolute',
    top: 28,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#5f7f6a',
    marginLeft: -22,
  },
  orbA: { left: '22%' },
  orbB: { left: '50%' },
  orbC: { left: '78%' },
  orbText: {
    fontFamily: Fonts.ui.bold,
    fontSize: 12,
    color: '#3d5646',
  },
  runner: {
    position: 'absolute',
    bottom: 22,
    left: '50%',
    marginLeft: -14,
  },
  runnerBody: {
    width: 28,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#5f7f6a',
    borderWidth: 2,
    borderColor: '#e8f0ea',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: Fonts.ui.bold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 22,
    letterSpacing: -0.4,
    textAlign: 'center',
    marginTop: 10,
  },
  copy: {
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 320,
  },
});

export default GamesGeneratingScreen;
