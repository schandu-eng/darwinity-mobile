import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Extrapolate,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const SWIPE_THRESHOLD = 50;
const SWIPE_VELOCITY_THRESHOLD = 0.5;

type Props = {
  children: React.ReactNode;
  onPrev: () => void;
  onNext: () => void;
  enabled?: boolean;
};

const CardDeckSwipeArea: React.FC<Props> = ({
  children,
  onPrev,
  onNext,
  enabled = true,
}) => {
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const isAnimatingRef = useRef(false);

  const onPrevRef = useRef(onPrev);
  const onNextRef = useRef(onNext);
  useEffect(() => {
    onPrevRef.current = onPrev;
  }, [onPrev]);
  useEffect(() => {
    onNextRef.current = onNext;
  }, [onNext]);

  const snapBack = useCallback(() => {
    cancelAnimation(translateX);
    cancelAnimation(opacity);
    translateX.value = withSpring(0, { damping: 20, stiffness: 220, mass: 0.7 });
    opacity.value = withTiming(1, { duration: 200 });
    isAnimatingRef.current = false;
  }, [opacity, translateX]);

  const finishSwipe = useCallback(
    (direction: 'prev' | 'next') => {
      const exitX = direction === 'next' ? -320 : 320;
      isAnimatingRef.current = true;
      translateX.value = withTiming(exitX, { duration: 180 }, (finished) => {
        if (!finished) return;
        if (direction === 'next') {
          runOnJS(onNextRef.current)();
        } else {
          runOnJS(onPrevRef.current)();
        }
        translateX.value = 0;
        opacity.value = 1;
        isAnimatingRef.current = false;
      });
    },
    [opacity, translateX]
  );

  const isHorizontalSwipe = useCallback((dx: number, dy: number) => {
    if (Math.abs(dx) <= 8) return false;
    return Math.abs(dx) > Math.abs(dy) * 0.9;
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponderCapture: (_, g) => {
          if (!enabled || isAnimatingRef.current) return false;
          return isHorizontalSwipe(g.dx, g.dy);
        },
        onMoveShouldSetPanResponder: (_, g) => {
          if (!enabled || isAnimatingRef.current) return false;
          return isHorizontalSwipe(g.dx, g.dy);
        },
        onPanResponderMove: (_, g) => {
          if (isAnimatingRef.current) return;
          const resistance = 0.45;
          translateX.value = g.dx * resistance;
          const p = Math.abs(g.dx * resistance) / 280;
          opacity.value = interpolate(p, [0, 0.35, 0.7], [1, 0.85, 0.6], Extrapolate.CLAMP);
        },
        onPanResponderRelease: (_, g) => {
          if (isAnimatingRef.current) {
            snapBack();
            return;
          }

          const goingNext = g.dx < -SWIPE_THRESHOLD || g.vx < -SWIPE_VELOCITY_THRESHOLD;
          const goingPrev = g.dx > SWIPE_THRESHOLD || g.vx > SWIPE_VELOCITY_THRESHOLD;

          if (goingNext) {
            finishSwipe('next');
            return;
          }
          if (goingPrev) {
            finishSwipe('prev');
            return;
          }

          snapBack();
        },
        onPanResponderTerminate: snapBack,
      }),
    [enabled, finishSwipe, isHorizontalSwipe, opacity, snapBack, translateX]
  );

  const animatedStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateX: translateX.value }],
      opacity: opacity.value,
    }),
    []
  );

  return (
    <View style={styles.container} {...panResponder.panHandlers} collapsable={false}>
      <Animated.View style={[styles.card, animatedStyle]}>{children}</Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    ...Platform.select({
      web: {
        touchAction: 'pan-y',
        userSelect: 'none',
      },
    }),
  },
  card: {
    width: '100%',
  },
});

export default CardDeckSwipeArea;
