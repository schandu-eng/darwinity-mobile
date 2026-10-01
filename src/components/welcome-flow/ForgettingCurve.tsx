import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { ONBOARDING_LIGHT } from './welcomeFlowTheme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const FADE_PATH =
  'M 12 28 C 48 30, 72 48, 96 78 C 118 102, 148 128, 188 148';

const HOLD_PATH =
  'M 12 28 C 52 30, 88 36, 120 42 C 148 48, 168 54, 188 60';

const PATH_LEN = 260;

type ForgettingCurveProps = {
  mode: 'idle' | 'fading' | 'holding';
  width?: number;
  height?: number;
};

export const ForgettingCurve: React.FC<ForgettingCurveProps> = ({
  mode,
  width = 220,
  height = 170,
}) => {
  const c = ONBOARDING_LIGHT;
  const fadeProgress = useSharedValue(0);
  const holdProgress = useSharedValue(0);
  const holdOpacity = useSharedValue(0);

  useEffect(() => {
    if (mode === 'idle') {
      fadeProgress.value = 0;
      holdProgress.value = 0;
      holdOpacity.value = 0;
      return;
    }
    if (mode === 'fading') {
      holdOpacity.value = withTiming(0, { duration: 200 });
      holdProgress.value = 0;
      fadeProgress.value = withTiming(1, {
        duration: 1600,
        easing: Easing.out(Easing.cubic),
      });
      return;
    }

    fadeProgress.value = 1;
    holdOpacity.value = withTiming(1, { duration: 400 });
    holdProgress.value = withDelay(
      120,
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) })
    );
  }, [mode, fadeProgress, holdProgress, holdOpacity]);

  const fadeProps = useAnimatedProps(() => ({
    strokeDashoffset: PATH_LEN * (1 - fadeProgress.value),
  }));

  const holdProps = useAnimatedProps(() => ({
    strokeDashoffset: PATH_LEN * (1 - holdProgress.value),
    opacity: holdOpacity.value,
  }));

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height} viewBox="0 0 200 170">
        <Defs>
          <LinearGradient id="holdGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={c.growth} stopOpacity="0.35" />
            <Stop offset="1" stopColor={c.growth} stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {}
        <Path
          d="M 12 20 L 12 152 L 192 152"
          stroke="rgba(26,47,35,0.14)"
          strokeWidth={1.5}
          fill="none"
        />

        {}
        <AnimatedPath
          d={FADE_PATH}
          stroke={mode === 'holding' ? 'rgba(26,47,35,0.18)' : c.mute}
          strokeWidth={mode === 'holding' ? 2 : 3}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${PATH_LEN} ${PATH_LEN}`}
          animatedProps={fadeProps}
        />

        {}
        <AnimatedPath
          d={HOLD_PATH}
          stroke="url(#holdGrad)"
          strokeWidth={3.5}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${PATH_LEN} ${PATH_LEN}`}
          animatedProps={holdProps}
        />

        <Circle cx="12" cy="28" r="4" fill={c.ink} />
        {mode === 'holding' ? (
          <Circle cx="188" cy="60" r="5" fill={c.growth} />
        ) : null}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
  },
});

export default ForgettingCurve;
