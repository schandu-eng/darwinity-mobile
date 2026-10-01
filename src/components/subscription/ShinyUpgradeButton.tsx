import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { USE_NATIVE_DRIVER } from '@/theme/webCompat';
import { Fonts } from '@/config/fonts';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loadingSlot?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
};

/**
 * 3D primary CTA with a looping glass shine sweep.
 */
export function ShinyUpgradeButton({
  label,
  onPress,
  disabled = false,
  loadingSlot,
  style,
  backgroundColor = '#1A2F23',
}: Props) {
  const shineX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    if (disabled) {
      shineX.setValue(-1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shineX, {
          toValue: 1.4,
          duration: 1800,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.delay(900),
        Animated.timing(shineX, {
          toValue: -1,
          duration: 0,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [disabled, shineX]);

  const translateX = shineX.interpolate({
    inputRange: [-1, 1.4],
    outputRange: [-140, 320],
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
      style={[
        styles.wrap,
        { backgroundColor, opacity: disabled ? 0.72 : 1 },
        style,
      ]}
    >
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.18)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.shineClip} pointerEvents="none">
        <Animated.View style={[styles.shine, { transform: [{ translateX }] }]}>
          <LinearGradient
            colors={[
              'transparent',
              'rgba(255,255,255,0.08)',
              'rgba(255,255,255,0.45)',
              'rgba(255,255,255,0.08)',
              'transparent',
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      <View style={styles.content}>
        {loadingSlot || <Text style={styles.label}>{label}</Text>}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    ...Platform.select({
      ios: {
        shadowColor: '#0D1A13',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.35,
        shadowRadius: 0,
      },
      android: {
        elevation: 5,
      },
      default: {},
    }),
  },
  shineClip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    top: -8,
    bottom: -8,
    width: 90,
  },
  content: {
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: Fonts.ui.bold,
    letterSpacing: 0.2,
  },
});
