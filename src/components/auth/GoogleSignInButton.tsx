import React from 'react';
import {
  Pressable,
  StyleSheet,
  ActivityIndicator,
  View,
  Platform,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GoogleGlyph } from '@/components/auth/GoogleGlyph';
import { Fonts } from '@/config/fonts';
import {
  AUTH,
  type AuthPressState,
  googleHoverShadow,
  googleShadow,
  webCursor,
} from '@/components/auth/authTheme';
import { pointerEventsProp, pointerEventsStyle } from '@/theme/webCompat';

type GoogleSignInButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onPress,
  disabled = false,
  loading = false,
  label = 'Continue with Google',
  style,
}) => {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed, hovered }: AuthPressState) => [
        styles.hit,
        webCursor,
        hovered && !isDisabled && styles.hovered,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <LinearGradient
        colors={[AUTH.white, AUTH.paperLift]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents={pointerEventsProp('none')}
        style={[StyleSheet.absoluteFill, pointerEventsStyle('none')]}
      />
      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color={AUTH.fg} />
          <Text style={styles.label}>Connecting…</Text>
        </View>
      ) : (
        <View style={styles.row}>
          <GoogleGlyph size={18} />
          <Text style={styles.label}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  hit: {
    width: '100%',
    minHeight: 50,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AUTH.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...googleShadow,
    ...(Platform.OS === 'web'
      ? {
          transitionDuration: '180ms',
          transitionProperty: 'transform, box-shadow, border-color, background-color',
        }
      : {}),
  },
  hovered: {
    borderColor: 'rgba(63, 107, 79, 0.42)',
    ...googleHoverShadow,
    ...(Platform.OS === 'web' ? { transform: [{ translateY: -1 }] } : {}),
  },
  pressed: {
    ...(Platform.OS === 'web'
      ? { transform: [{ translateY: 0 }] }
      : { opacity: 0.92 }),
  },
  disabled: {
    opacity: 0.55,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 1,
  },
  label: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 15,
    letterSpacing: -0.2,
    color: AUTH.fg,
  },
});

export default GoogleSignInButton;
