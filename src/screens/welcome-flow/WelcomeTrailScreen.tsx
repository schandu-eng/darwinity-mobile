import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  PanResponder,
  Platform,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { playQuizAnswerResult } from '@/study-hub/quizAnswerFeedback';
import { useOnboardingStore } from '@/store';
import {
  WelcomeFlowShell,
  OnboardingPrimaryButton,
} from '@/components/welcome-flow/WelcomeFlowShell';
import { AdventureMap } from '@/components/welcome-flow/AdventureMap';
import { ForgettingCurve } from '@/components/welcome-flow/ForgettingCurve';
import { ONBOARDING_LIGHT } from '@/components/welcome-flow/welcomeFlowTheme';
import { Fonts } from '@/config/fonts';
import {
  TRAIL_LEVELS,
  type TrailLevelId,
  KIT_LABELS,
  DROP_FILE_LABEL,
  DROP_GATE_LABEL,
  NOTES_HEADING,
  NOTE_LINES,
  QUIZ_QUESTION,
  QUIZ_OPTIONS,
  QUIZ_CORRECT,
  CARD_DECK_TERM,
  CARD_DECK_MEANING,
  SAMPLE_PODCAST_TITLE,
  SAMPLE_PODCAST_META,
  PODCAST_CLEAR_AFTER_SEC,
} from '@/components/welcome-flow/trailLevels';
import { ONBOARDING_FINAL_STEP } from '@/utils/welcomeFlowSteps';
import type { OnboardingStackParamList } from '@/types/navigation';

type NavigationProp = NativeStackNavigationProp<OnboardingStackParamList, 'Trail'>;

const c = ONBOARDING_LIGHT;
const SPRING = { damping: 18, stiffness: 260, mass: 0.55 };

const WelcomeTrailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const setCurrentStep = useOnboardingStore((s) => s.setCurrentStep);

  const [currentId, setCurrentId] = useState<TrailLevelId>('drop');
  const [completed, setCompleted] = useState<Set<TrailLevelId>>(() => new Set());
  const [travelToId, setTravelToId] = useState<TrailLevelId | null>(null);
  const [active, setActive] = useState<TrailLevelId | null>(null);
  const [curveMode, setCurveMode] = useState<'idle' | 'fading' | 'holding'>('idle');
  const [kitLit, setKitLit] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [dropDone, setDropDone] = useState(false);
  const [podcastPlaying, setPodcastPlaying] = useState(false);
  const bootstrapped = useRef(false);
  const podcastClearRef = useRef(false);

  const bedRef = useRef<View>(null);
  const seedRef = useRef<Animated.View>(null);
  const bedLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const seedLayout = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const seedScale = useSharedValue(1);
  const seedOpacity = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const bedPulse = useSharedValue(1);
  const rotation = useSharedValue(0);
  const dragHintY = useSharedValue(0);
  const dragHintOpacity = useSharedValue(0);
  const isDraggingSeed = useSharedValue(false);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  useFocusEffect(
    useCallback(
      () => () => {
        clearTimers();
      },
      [clearTimers]
    )
  );

  const goArrive = useCallback(async () => {
    clearTimers();
    await setCurrentStep(ONBOARDING_FINAL_STEP);
    navigation.navigate('Arrive');
  }, [clearTimers, navigation, setCurrentStep]);

  const clearLevelRef = useRef<(id: TrailLevelId) => void>(() => {});

  const openLevel = useCallback(
    (id: TrailLevelId) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setQuizAnswer(null);
      setCardFlipped(false);
      setDropDone(false);
      setPodcastPlaying(false);
      podcastClearRef.current = false;
      setKitLit(0);
      setCurveMode('idle');
      rotation.value = 0;
      translateX.value = 0;
      translateY.value = 0;
      seedScale.value = 1;
      seedOpacity.value = 1;
      bedPulse.value = 1;
      isDraggingSeed.value = false;
      cancelAnimation(dragHintY);
      dragHintY.value = 0;
      dragHintOpacity.value = 0;
      setActive(id);

      if (id === 'drop') {
        later(480, () => {
          dragHintOpacity.value = withTiming(1, { duration: 280 });
          dragHintY.value = withRepeat(
            withSequence(
              withTiming(-28, { duration: 700, easing: Easing.inOut(Easing.quad) }),
              withTiming(0, { duration: 700, easing: Easing.inOut(Easing.quad) })
            ),
            -1,
            false
          );
        });
      }

      if (id === 'fade') {
        later(400, () => {
          setCurveMode('fading');
          later(1700, () => {
            setCurveMode('holding');
            later(1600, () => clearLevelRef.current('fade'));
          });
        });
      }
      if (id === 'kit') {
        later(350, () => {
          setKitLit(1);
          later(400, () => setKitLit(2));
          later(800, () => setKitLit(3));
          later(1200, () => setKitLit(4));
          later(2000, () => clearLevelRef.current('kit'));
        });
      }
    },
    [
      bedPulse,
      dragHintOpacity,
      dragHintY,
      isDraggingSeed,
      later,
      rotation,
      seedOpacity,
      seedScale,
      translateX,
      translateY,
    ]
  );

  const openLevelRef = useRef(openLevel);
  openLevelRef.current = openLevel;

  const clearLevel = useCallback(
    async (id: TrailLevelId) => {
      if (travelToId) return;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearTimers();

      setActive(null);
      setCompleted((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      const idx = TRAIL_LEVELS.findIndex((l) => l.id === id);
      const nextLevel = TRAIL_LEVELS[idx + 1];
      if (!nextLevel) {
        later(450, () => {
          goArrive();
        });
        return;
      }

      later(380, () => {
        setTravelToId(nextLevel.id);
      });
    },
    [clearTimers, goArrive, later, travelToId]
  );

  clearLevelRef.current = clearLevel;

  const handleTravelEnd = useCallback(
    (arrivedId: TrailLevelId) => {
      setTravelToId(null);
      setCurrentId(arrivedId);

      later(420, () => {
        openLevelRef.current(arrivedId);
      });
    },
    [later]
  );

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    later(550, () => {
      openLevelRef.current('drop');
    });
  }, [later]);

  const measure = useCallback(() => {
    bedRef.current?.measureInWindow((x, y, width, height) => {
      bedLayout.current = { x, y, width, height };
    });
    seedRef.current?.measureInWindow((x, y, width, height) => {
      seedLayout.current = { x, y, width, height };
    });
  }, []);

  useEffect(() => {
    if (active !== 'drop') return;
    const t = setTimeout(measure, 100);
    return () => clearTimeout(t);
  }, [active, measure]);

  const inBed = useCallback((dx: number, dy: number) => {
    const bed = bedLayout.current;
    const seed = seedLayout.current;
    if (!bed.width || !seed.width) return false;
    const cx = seed.x + seed.width / 2 + dx;
    const cy = seed.y + seed.height / 2 + dy;
    return cx >= bed.x && cx <= bed.x + bed.width && cy >= bed.y && cy <= bed.y + bed.height;
  }, []);

  const finishDrop = useCallback(() => {
    clearLevelRef.current('drop');
  }, []);

  const onPlanted = useCallback(() => {
    setDropDone(true);
    seedScale.value = withTiming(0.5, { duration: 200 });
    seedOpacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(finishDrop)();
    });
  }, [finishDrop, seedOpacity, seedScale]);

  const inBedRef = useRef(inBed);
  const onPlantedRef = useRef(onPlanted);
  const stopDragHintRef = useRef(() => {});
  useEffect(() => {
    inBedRef.current = inBed;
    onPlantedRef.current = onPlanted;
  }, [inBed, onPlanted]);

  const stopDragHint = useCallback(() => {
    isDraggingSeed.value = true;
    cancelAnimation(dragHintY);
    dragHintY.value = withTiming(0, { duration: 120 });
    dragHintOpacity.value = withTiming(0, { duration: 160 });
  }, [dragHintOpacity, dragHintY, isDraggingSeed]);
  stopDragHintRef.current = stopDragHint;

  useEffect(() => {
    if (Platform.OS !== 'web' || active !== 'drop' || dropDone) return;
    const prevent = (event: Event) => {
      event.preventDefault();
    };
    document.addEventListener('selectstart', prevent);
    return () => document.removeEventListener('selectstart', prevent);
  }, [active, dropDone]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        stopDragHintRef.current();
        startX.value = translateX.value;
        startY.value = translateY.value;
        seedScale.value = withSpring(1.06, SPRING);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, g) => {
        translateX.value = startX.value + g.dx;
        translateY.value = startY.value + g.dy;
        bedPulse.value = withSpring(
          inBedRef.current(translateX.value, translateY.value) ? 1.04 : 1,
          SPRING
        );
      },
      onPanResponderRelease: () => {
        if (inBedRef.current(translateX.value, translateY.value)) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onPlantedRef.current();
        } else {
          translateX.value = withSpring(0, SPRING);
          translateY.value = withSpring(0, SPRING);
          seedScale.value = withSpring(1, SPRING);
          bedPulse.value = withSpring(1, SPRING);
        }
      },
    })
  ).current;

  const seedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      {
        translateY:
          translateY.value + (isDraggingSeed.value ? 0 : dragHintY.value),
      },
      { scale: seedScale.value },
    ],
    opacity: seedOpacity.value,
  }));
  const bedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bedPulse.value }],
  }));
  const dragHintStyle = useAnimatedStyle(() => ({
    opacity: dragHintOpacity.value,
    transform: [{ translateY: dragHintY.value * 0.35 }],
  }));

  const handleQuiz = useCallback(
    (answer: string) => {
      if (quizAnswer) return;
      setQuizAnswer(answer);
      playQuizAnswerResult(answer === QUIZ_CORRECT);
      if (answer === QUIZ_CORRECT) {
        later(700, () => clearLevelRef.current('quiz'));
      } else {
        later(900, () => setQuizAnswer(null));
      }
    },
    [later, quizAnswer]
  );

  const handleFlip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !cardFlipped;
    setCardFlipped(next);
    rotation.value = withTiming(next ? 180 : 0, {
      duration: 420,
      easing: Easing.inOut(Easing.cubic),
    });
    if (next) later(900, () => clearLevelRef.current('cards'));
  }, [cardFlipped, later, rotation]);

  const handlePodcastToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPodcastPlaying((prev) => {
      const next = !prev;
      if (next && !podcastClearRef.current) {
        later(PODCAST_CLEAR_AFTER_SEC * 1000, () => {
          if (podcastClearRef.current) return;
          podcastClearRef.current = true;
          clearLevelRef.current('podcast');
        });
      }
      return next;
    });
  }, [later]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(rotation.value, [0, 180], [0, 180])}deg` },
    ],
    opacity: rotation.value >= 90 ? 0 : 1,
    zIndex: rotation.value >= 90 ? 0 : 1,
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${interpolate(rotation.value, [0, 180], [180, 360])}deg` },
    ],
    opacity: rotation.value >= 90 ? 1 : 0,
    zIndex: rotation.value >= 90 ? 1 : 0,
  }));

  const handleSummit = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await clearLevelRef.current('summit');
  }, []);

  const closeModal = useCallback(() => {

  }, []);

  const handleSkipTour = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTravelToId(null);
    setActive(null);
    await goArrive();
  }, [goArrive]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (travelToId) return;
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation, travelToId]);

  const levelMeta = TRAIL_LEVELS.find((l) => l.id === active);
  const clearedCount = completed.size;

  return (
    <WelcomeFlowShell
      step="Trail"
      onBack={handleBack}
      onSkip={handleSkipTour}
      hideProgress
      centered={false}
      contentStyle={styles.body}
    >
      <View style={styles.headerCopy}>
        <Text style={styles.title}>Evolve your mind, one stage at a time</Text>
        <View style={styles.progressMeta}>
          <Text style={styles.progressPct}>
            {Math.round((clearedCount / TRAIL_LEVELS.length) * 100)}%
          </Text>
          <Text style={styles.progressCount}>
            {Math.min(clearedCount + 1, TRAIL_LEVELS.length)} of {TRAIL_LEVELS.length} stages
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.round((clearedCount / TRAIL_LEVELS.length) * 100)}%` },
            ]}
          />
        </View>
      </View>

      <AdventureMap
        currentId={currentId}
        completed={completed}
        travelToId={travelToId}
        onTravelEnd={handleTravelEnd}
      />

      <Modal
        visible={active !== null}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalTop}>
              <Text style={styles.modalEyebrow}>
                Stage {levelMeta?.number} · {levelMeta?.title}
              </Text>
              <TouchableOpacity
                onPress={handleSkipTour}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Skip tour"
              >
                <Text style={styles.modalSkip}>Skip</Text>
              </TouchableOpacity>
            </View>

            {active === 'drop' ? (
              <View style={styles.challenge}>
                <Text style={styles.challengeTitle}>Drag the lecture into the gate</Text>
                <Animated.View
                  ref={bedRef}
                  onLayout={measure}
                  style={[styles.soil, bedStyle]}
                >
                  <MaterialCommunityIcons name="gate" size={26} color={c.growth} />
                  <Text style={styles.soilLabel} selectable={false}>
                    {DROP_GATE_LABEL}
                  </Text>
                </Animated.View>
                {!dropDone ? (
                  <View style={styles.seedStack}>
                    <Animated.View style={[styles.dragHint, dragHintStyle]} pointerEvents="none">
                      <MaterialCommunityIcons name="gesture-swipe-up" size={22} color={c.growth} />
                      <Text style={styles.dragHintText} selectable={false}>
                        Drag up
                      </Text>
                    </Animated.View>
                    <Animated.View
                      ref={seedRef}
                      onLayout={measure}
                      style={[styles.seed, seedStyle]}
                      {...panResponder.panHandlers}
                      collapsable={false}
                    >
                      <MaterialCommunityIcons
                        name="file-pdf-box"
                        size={22}
                        color={c.growth}
                      />
                      <Text style={styles.seedText} selectable={false}>
                        {DROP_FILE_LABEL}
                      </Text>
                    </Animated.View>
                  </View>
                ) : (
                  <Text style={styles.cleared} selectable={false}>
                    Gate cleared!
                  </Text>
                )}
              </View>
            ) : null}

            {active === 'fade' ? (
              <View style={styles.challenge}>
                <Text style={styles.challengeTitle}>
                  {curveMode === 'holding'
                    ? 'Darwinity holds the memory'
                    : 'Watch the lecture fade…'}
                </Text>
                <ForgettingCurve mode={curveMode === 'idle' ? 'fading' : curveMode} />
              </View>
            ) : null}

            {active === 'kit' ? (
              <View style={styles.challenge}>
                <Text style={styles.challengeTitle}>Your study kit is growing</Text>
                <View style={styles.notesPreview}>
                  <Text style={styles.notesHeading}>{NOTES_HEADING}</Text>
                  {NOTE_LINES.map((line) => (
                    <Text key={line} style={styles.notesLine}>
                      · {line}
                    </Text>
                  ))}
                </View>
                <View style={styles.kitGrid}>
                  {KIT_LABELS.map((label, i) => {
                    const on = kitLit > i;
                    return (
                      <View
                        key={label}
                        style={[styles.kitChip, on && styles.kitChipOn]}
                      >
                        <Text style={[styles.kitChipText, on && styles.kitChipTextOn]}>
                          {label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {active === 'podcast' ? (
              <View style={styles.challenge}>
                <Text style={styles.challengeTitle}>Play the history podcast</Text>
                <View style={styles.podcastCard}>
                  <Text style={styles.podcastTitle}>{SAMPLE_PODCAST_TITLE}</Text>
                  <TouchableOpacity
                    style={styles.podcastBtn}
                    onPress={handlePodcastToggle}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons
                      name={podcastPlaying ? 'pause' : 'play'}
                      size={18}
                      color={c.white}
                    />
                    <Text style={styles.podcastBtnText}>
                      {podcastPlaying ? 'Pause' : 'Play'}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.hint}>
                    {podcastPlaying
                      ? `Listening… clears after ${PODCAST_CLEAR_AFTER_SEC}s`
                      : `Play a few seconds to clear · ${SAMPLE_PODCAST_META}`}
                  </Text>
                </View>
              </View>
            ) : null}

            {active === 'quiz' ? (
              <View style={styles.challenge}>
                <Text style={styles.challengeTitle}>{QUIZ_QUESTION}</Text>
                {QUIZ_OPTIONS.map((opt) => {
                  const show = quizAnswer !== null;
                  const correct = opt === QUIZ_CORRECT;
                  const selected = quizAnswer === opt;
                  let bg: string = c.paper;
                  let fg: string = c.ink;
                  if (show && correct) {
                    bg = c.growthSoft;
                    fg = c.growth;
                  } else if (show && selected) {
                    bg = c.dangerSoft;
                  }
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.quizOpt, { backgroundColor: bg }]}
                      onPress={() => handleQuiz(opt)}
                      disabled={!!quizAnswer}
                    >
                      <Text style={[styles.quizOptText, { color: fg }]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
                <Text style={styles.hint}>Get it right to clear the level</Text>
              </View>
            ) : null}

            {active === 'cards' ? (
              <View style={styles.challenge}>
                <Text style={styles.challengeTitle}>Flip the card to clear</Text>
                <Pressable onPress={handleFlip}>
                  <View style={styles.flipScene}>
                    <Animated.View style={[styles.flipFace, frontStyle]}>
                      <Text style={styles.cardPill}>Term</Text>
                      <Text style={styles.cardTerm}>{CARD_DECK_TERM}</Text>
                      <Text style={styles.hint}>Tap to flip</Text>
                    </Animated.View>
                    <Animated.View style={[styles.flipFace, styles.flipBack, backStyle]}>
                      <Text style={styles.cardPill}>Meaning</Text>
                      <Text style={styles.cardMeaning}>{CARD_DECK_MEANING}</Text>
                    </Animated.View>
                  </View>
                </Pressable>
              </View>
            ) : null}

            {active === 'summit' ? (
              <View style={styles.challenge}>
                <Text style={styles.challengeTitle}>Trail complete.</Text>
                <Text style={styles.summitBody}>You’re ready to remember.</Text>
                <OnboardingPrimaryButton label="Continue" onPress={handleSummit} />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </WelcomeFlowShell>
  );
};

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  headerCopy: {
    paddingHorizontal: 24,
    marginBottom: 8,
    gap: 8,
  },
  title: {
    fontFamily: Fonts.display.bold,
    fontSize: 22,
    letterSpacing: -0.4,
    lineHeight: 28,
    color: c.ink,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressPct: {
    fontFamily: Fonts.body.bold,
    fontSize: 14,
    color: c.growth,
  },
  progressCount: {
    fontFamily: Fonts.body.semiBold,
    fontSize: 14,
    color: c.growth,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(63,107,79,0.12)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(63,107,79,0.45)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(26,47,35,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: c.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 28,
    minHeight: 340,
    maxHeight: '88%',
  },
  modalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalEyebrow: {
    fontFamily: Fonts.body.bold,
    fontSize: 13,
    color: c.growth,
    flexShrink: 1,
    paddingRight: 12,
  },
  modalSkip: {
    fontFamily: Fonts.body.semiBold,
    fontSize: 14,
    color: c.mute,
  },
  challenge: {
    gap: 12,
  },
  challengeTitle: {
    fontFamily: Fonts.display.bold,
    fontSize: 20,
    lineHeight: 26,
    color: c.ink,
    marginBottom: 4,
  },
  soil: {
    height: 120,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(63,107,79,0.35)',
    backgroundColor: c.growthSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  soilLabel: {
    fontFamily: Fonts.body.semiBold,
    fontSize: 14,
    color: c.growth,
  },
  seed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.border,
    ...Platform.select({
      web: {
        cursor: 'grab',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
        WebkitUserDrag: 'none',
      },
      default: {},
    }),
  },
  seedStack: {
    alignItems: 'center',
    gap: 6,
    minHeight: 72,
    justifyContent: 'flex-end',
  },
  dragHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  dragHintText: {
    fontFamily: Fonts.body.semiBold,
    fontSize: 12,
    color: c.growth,
    ...Platform.select({
      web: {
        userSelect: 'none',
        WebkitUserSelect: 'none',
      },
      default: {},
    }),
  },
  seedText: {
    fontFamily: Fonts.body.semiBold,
    fontSize: 14,
    color: c.ink,
    ...Platform.select({
      web: {
        userSelect: 'none',
        WebkitUserSelect: 'none',
      },
      default: {},
    }),
  },
  cleared: {
    fontFamily: Fonts.display.bold,
    fontSize: 16,
    color: c.growth,
    textAlign: 'center',
  },
  kitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  notesPreview: {
    borderRadius: 16,
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: 'rgba(26,47,35,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  notesHeading: {
    fontFamily: Fonts.body.bold,
    fontSize: 15,
    color: c.ink,
    marginBottom: 2,
  },
  notesLine: {
    fontFamily: Fonts.body.regular,
    fontSize: 13,
    lineHeight: 18,
    color: c.mute,
  },
  podcastCard: {
    borderRadius: 16,
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: 'rgba(26,47,35,0.08)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  podcastTitle: {
    fontFamily: Fonts.body.bold,
    fontSize: 15,
    color: c.ink,
  },
  podcastBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.ink,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  podcastBtnText: {
    fontFamily: Fonts.body.bold,
    fontSize: 14,
    color: c.white,
  },
  kitChip: {
    width: '47%',
    paddingVertical: 18,
    borderRadius: 14,
    backgroundColor: c.paperDeep,
    alignItems: 'center',
  },
  kitChipOn: {
    backgroundColor: 'rgba(63,107,79,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(63,107,79,0.28)',
  },
  kitChipText: {
    fontFamily: Fonts.body.semiBold,
    fontSize: 15,
    color: c.mute,
  },
  kitChipTextOn: {
    color: c.growth,
  },
  quizOpt: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  quizOptText: {
    fontFamily: Fonts.body.medium,
    fontSize: 15,
  },
  hint: {
    fontFamily: Fonts.body.regular,
    fontSize: 13,
    color: c.mute,
    textAlign: 'center',
  },
  flipScene: {
    minHeight: 170,
    position: 'relative',
  },
  flipFace: {
    minHeight: 170,
    borderRadius: 16,
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    backfaceVisibility: 'hidden',
  },
  flipBack: {
    ...StyleSheet.absoluteFillObject,
  },
  cardPill: {
    fontFamily: Fonts.body.semiBold,
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: c.growth,
  },
  cardTerm: {
    fontFamily: Fonts.display.bold,
    fontSize: 22,
    color: c.ink,
  },
  cardMeaning: {
    fontFamily: Fonts.body.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: c.ink,
  },
  summitBody: {
    fontFamily: Fonts.body.regular,
    fontSize: 15,
    lineHeight: 22,
    color: c.mute,
    marginBottom: 8,
  },
});

export default WelcomeTrailScreen;
