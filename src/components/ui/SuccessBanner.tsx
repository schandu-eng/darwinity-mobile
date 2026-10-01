import React from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useAppTheme } from '@/store/appThemeStore';

import { Fonts } from '@/config/fonts';

interface SuccessBannerProps {
  message: string;
  onDismiss?: () => void;
  variant?: 'inline' | 'compact';
}

const SuccessBanner: React.FC<SuccessBannerProps> = ({ message, onDismiss, variant = 'inline' }) => {
  const themeMode = useAppTheme();

  const isCompact = variant === 'compact';
  const iconSize = isCompact ? 16 : 24;
  const fontSize = isCompact ? 12 : 14;
  const letterSpacing = isCompact ? 0.4 : 0.25;
  const paddingVertical = isCompact ? 12 : 16;
  const paddingHorizontal = isCompact ? 12 : 20;
  const marginBottom = isCompact ? 0 : 16;

  const backgroundColor = themeMode === 'dark' ? '#1B5E20' : '#E8F5E9';
  const accentColor = themeMode === 'dark' ? '#66BB6A' : '#2E7D32';
  const textColor = themeMode === 'dark' ? '#E8F5E9' : '#1B5E20';

  return (
    <Surface
      style={[
        styles.container,
        {
          backgroundColor,
          borderLeftWidth: 4,
          borderLeftColor: accentColor,
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
        <MaterialCommunityIcons name="check-circle" size={iconSize} color={accentColor} />
        <View style={styles.messageContainer}>
          <Text style={[styles.message, { color: textColor, fontSize, letterSpacing }]}>
            {message}
          </Text>
        </View>
        {onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            style={styles.dismissButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="close" size={isCompact ? 18 : 20} color={textColor} />
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
    fontFamily: Fonts.ui.medium,
    lineHeight: 20,
  },
  dismissButton: {
    padding: 4,
    marginLeft: -4,
  },
});

export default SuccessBanner;
