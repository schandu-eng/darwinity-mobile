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
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '@/config/fonts';
import {
  type AuthPressState,
  webCursor,
} from '@/components/auth/authTheme';

type AppleSignInButtonProps = {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/** Black “Continue with Apple” control matching GoogleSignInButton layout. */
export const AppleSignInButton: React.FC<AppleSignInButtonProps> = ({
  onPress,
  disabled = false,
  loading = false,
  label = 'Continue with Apple',
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
      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.label}>Connecting…</Text>
        </View>
      ) : (
        <View style={styles.row}>
          <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
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
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: '#000000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...(Platform.OS === 'web'
      ? {
          transitionDuration: '180ms',
          transitionProperty: 'transform, opacity',
        }
      : {}),
  },
  hovered: {
    opacity: 0.92,
    ...(Platform.OS === 'web' ? { transform: [{ translateY: -1 }] } : {}),
  },
  pressed: {
    opacity: 0.88,
  },
  disabled: {
    opacity: 0.55,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 15,
    letterSpacing: -0.2,
    color: '#FFFFFF',
  },
});

export default AppleSignInButton;
