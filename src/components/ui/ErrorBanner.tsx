import React from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useAppTheme } from '@/store/appThemeStore';
import { toUserFacingError } from '@/utils/userFacingError';
import { lightTheme, darkTheme } from '@/theme';

import { Fonts } from '@/config/fonts';

interface ErrorBannerProps {
  message: unknown;
  onDismiss?: () => void;
  variant?: 'inline' | 'compact';
}

const formatMessage = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(formatMessage).filter(Boolean);
    return parts.length ? parts.join('\n') : 'Something went wrong.';
  }
  if (value && typeof value === 'object') {
    const record = value as { msg?: unknown; message?: unknown; detail?: unknown };
    const nested = record.msg ?? record.message ?? record.detail;
    if (nested !== undefined) {
      return formatMessage(nested);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return 'Something went wrong.';
    }
  }
  return 'Something went wrong.';
};

const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onDismiss, variant = 'inline' }) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const safeMessage = toUserFacingError(formatMessage(message));

  const isCompact = variant === 'compact';
  const iconSize = isCompact ? 16 : 24;
  const fontSize = isCompact ? 12 : 14;
  const letterSpacing = isCompact ? 0.4 : 0.25;
  const paddingVertical = isCompact ? 12 : 16;
  const paddingHorizontal = isCompact ? 12 : 20;
  const marginBottom = isCompact ? 0 : 16;

  return (
    <Surface
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.errorContainer,
          borderLeftWidth: 4,
          borderLeftColor: theme.colors.error,
          marginBottom,
        },
        Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
          },
          android: {
            elevation: 4,
          },
        }),
      ]}
    >
      <View style={[styles.content, { paddingHorizontal, paddingVertical }]}>
        <MaterialCommunityIcons name="alert-circle" size={iconSize} color={theme.colors.error} />
        <View style={styles.messageContainer}>
          <Text style={[styles.message, { color: theme.colors.onErrorContainer, fontSize, letterSpacing }]}>
            {safeMessage}
          </Text>
        </View>
        {onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.dismissButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="close" size={isCompact ? 18 : 20} color={theme.colors.onErrorContainer} />
          </TouchableOpacity>
        )}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  messageContainer: {
    flex: 1,
  },
  message: {
    fontFamily: Fonts.ui.regular,
    lineHeight: 20,
  },
  dismissButton: {
    padding: 4,
    marginLeft: -4,
  },
});

export default ErrorBanner;
