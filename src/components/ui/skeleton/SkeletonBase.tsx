import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '@/store/appThemeStore';
import { USE_NATIVE_DRIVER, pointerEventsProp, pointerEventsStyle } from '@/theme/webCompat';

type SkeletonBaseProps = {
  style?: StyleProp<ViewStyle>;
  /** Stagger like web `animationDelay` (ms). */
  delayMs?: number;
  borderRadius?: number;
};

/**
 * Phone-web `.skeleton-shimmer` — zinc gradient sweep, 1.6s ease-in-out.
 * Light: #E4E4E7 → #F4F4F5 → #E4E4E7
 * Dark:  #27272A → #3F3F46 → #27272A
 *
 * Native driver cannot loop `Animated.delay` or interpolate % `translateX`;
 * both freeze after one cycle on iOS/Android (web CSS keeps going).
 */
export const SkeletonBase: React.FC<SkeletonBaseProps> = ({
  style,
  delayMs = 0,
  borderRadius,
}) => {
  const isDark = useAppTheme() === 'dark';
  const progress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(Boolean(enabled));
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      if (sub && typeof (sub as { remove?: () => void }).remove === 'function') {
        (sub as { remove: () => void }).remove();
      }
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || width <= 0) {
      progress.setValue(0);
      return undefined;
    }

    let stopped = false;
    let delayTimer: ReturnType<typeof setTimeout> | undefined;
    let animation: Animated.CompositeAnimation | undefined;

    const run = () => {
      if (stopped) return;
      progress.setValue(0);
      animation = Animated.timing(progress, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: USE_NATIVE_DRIVER,
      });
      animation.start(({ finished }) => {
        if (finished && !stopped) run();
      });
    };

    if (delayMs > 0) {
      delayTimer = setTimeout(run, delayMs);
    } else {
      run();
    }

    return () => {
      stopped = true;
      if (delayTimer) clearTimeout(delayTimer);
      animation?.stop();
    };
  }, [progress, delayMs, reduceMotion, width]);

  const translateX =
    width > 0
      ? progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -width],
        })
      : 0;

  const base = isDark ? '#27272A' : '#E4E4E7';
  const highlight = isDark ? '#3F3F46' : '#F4F4F5';
  const colors = useMemo(
    () => [base, base, highlight, base, base] as const,
    [base, highlight]
  );

  const radiusStyle = borderRadius != null ? { borderRadius } : undefined;

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next > 0 && next !== width) setWidth(next);
  };

  if (reduceMotion) {
    return <View style={[styles.base, { backgroundColor: base }, radiusStyle, style]} />;
  }

  return (
    <View
      onLayout={onLayout}
      style={[styles.base, { backgroundColor: base }, radiusStyle, style]}
    >
      {width > 0 ? (
        <Animated.View
          pointerEvents={pointerEventsProp('none')}
          style={[styles.sweep, pointerEventsStyle('none'), { width: width * 2, transform: [{ translateX }] }]}
        >
          <LinearGradient
            colors={[...colors]}
            locations={[0, 0.4, 0.5, 0.6, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    position: 'relative',
  },
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
});
