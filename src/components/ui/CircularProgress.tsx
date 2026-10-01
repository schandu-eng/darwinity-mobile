import React, { useEffect, useRef, useMemo, useState } from 'react';
import { View, StyleSheet, Text, Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { USE_NATIVE_DRIVER } from '@/theme/webCompat';

import { Fonts } from '@/config/fonts';

interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
  statusText?: string;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SMOOTH_EASING = Easing.bezier(0.65, 0, 0.35, 1);

const CircularProgress: React.FC<CircularProgressProps> = ({
  progress,
  size = 200,
  strokeWidth = 12,
  showPercentage = true,
  statusText,
}) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const animatedProgress = useRef(new Animated.Value(0)).current;

  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  const [displayPercent, setDisplayPercent] = useState(0);

  const clampedProgress = useMemo(
    () => Math.min(Math.max(progress, 0), 100),
    [progress]
  );

  const radius = useMemo(
    () => (size - strokeWidth) / 2 - 2,
    [size, strokeWidth]
  );
  const circumference = useMemo(() => 2 * Math.PI * radius, [radius]);
  const center = size / 2;

  useEffect(() => {
    const anim = Animated.timing(animatedProgress, {
      toValue: clampedProgress,
      duration: 700,
      easing: SMOOTH_EASING,
      useNativeDriver: false,
    });
    anim.start();

    const startValue = (animatedProgress as any)._value as number;
    const startTime = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - startTime) / 650, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayPercent(Math.round(startValue + (clampedProgress - startValue) * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    return () => anim.stop();
  }, [clampedProgress]);

  useEffect(() => {
    if (clampedProgress !== 100) return;
    pulseScale.setValue(1);
    pulseOpacity.setValue(0.5);
    Animated.parallel([
      Animated.timing(pulseScale, {
        toValue: 1.12,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.timing(pulseOpacity, {
        toValue: 0,
        duration: 550,
        easing: Easing.out(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
    ]).start();
  }, [clampedProgress]);

  const strokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
    extrapolate: 'clamp',
  });

  const isDark = themeMode === 'dark';
  const trackColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill}
        viewBox={`0 0 ${size} ${size}`}
      >
        <Defs>
          <LinearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={theme.colors.primary} stopOpacity="1" />
            <Stop offset="60%" stopColor={theme.colors.primary} stopOpacity="0.85" />
            <Stop offset="100%" stopColor={theme.colors.primary} stopOpacity="0.6" />
          </LinearGradient>

          <LinearGradient id="depthGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={theme.colors.primary} stopOpacity="0.12" />
            <Stop offset="100%" stopColor={theme.colors.primary} stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#depthGradient)"
          strokeWidth={strokeWidth + 6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          rotation={-90}
          origin={`${center}, ${center}`}
        />

        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />

        <AnimatedCircle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.pulseRing,
          {
            borderColor: theme.colors.primary,
            borderRadius: size / 2,
            opacity: pulseOpacity,
            transform: [{ scale: pulseScale }],
          },
        ]}
        pointerEvents="none"
      />

      <View style={styles.content} pointerEvents="none">
        {showPercentage && (
          <Text style={[styles.percentage, { color: theme.colors.onSurface }]}>
            {displayPercent}%
          </Text>
        )}
        {statusText && (
          <Text style={[styles.statusText, { color: theme.colors.onSurfaceVariant }]}>
            {statusText}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  pulseRing: {
    borderWidth: 2,
    margin: 6,
  },
  content: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 1,
    width: '100%',
    height: '100%',
    padding: 48,
  },
  percentage: {
    fontSize: 48,
    fontFamily: Fonts.ui.bold,
    letterSpacing: -2,
    lineHeight: 56,
  },
  statusText: {
    fontSize: 14,
    fontFamily: Fonts.ui.medium,
    textAlign: 'center',
    paddingHorizontal: 20,
    letterSpacing: 0.1,
    lineHeight: 20,
  },
});

export default React.memo(CircularProgress);