import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Animated, Easing, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { useAppTheme } from '@/store/appThemeStore';

import { Fonts } from '@/config/fonts';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  destructive?: boolean;
  hideCancel?: boolean;
  loadingText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
  destructive = false,
  hideCancel = false,
  loadingText = 'Deleting...',
}) => {
  const isDark = useAppTheme() === 'dark';
  const c = isDark ? darkColors : lightColors;

  const [mounted, setMounted] = React.useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: Platform.OS !== 'web',
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  if (!mounted) return null;

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onCancel}>
      <Animated.View style={[styles.backdrop, { backgroundColor: c.backdrop, opacity: progress }]}>
        <Animated.View
          style={[
            styles.modalCard,
            { backgroundColor: c.card, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth },
            { opacity: progress, transform: [{ scale }] },
          ]}
        >
          <Text variant="titleMedium" style={[styles.title, { color: c.title }]}>
            {title}
          </Text>
          <Text variant="bodyMedium" style={[styles.message, { color: c.message }]}>
            {message}
          </Text>
          <View style={styles.actions}>
            {!hideCancel && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: c.cancelBg }]}
                onPress={onCancel}
                disabled={isLoading}
                activeOpacity={0.7}
              >
                <Text style={[styles.actionText, { color: c.cancelText }]}>{cancelText}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.actionButton,
                hideCancel && styles.fullWidthButton,
                { backgroundColor: destructive ? '#DC2626' : '#1A2F23' },
              ]}
              onPress={onConfirm}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Text style={[styles.actionText, { color: '#FFFFFF' }]}>
                {isLoading ? loadingText : confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const lightColors = {
  backdrop: 'rgba(15, 23, 42, 0.4)',
  card: '#F1F5F9',
  border: 'transparent',
  title: '#0F172A',
  message: '#64748B',
  cancelBg: '#E2E8F0',
  cancelText: '#475569',
};

const darkColors = {
  backdrop: 'rgba(0, 0, 0, 0.6)',
  card: '#1a1a1aff',
  border: 'rgba(148, 163, 184, 0.15)',
  title: '#F8FAFC',
  message: '#94A3B8',
  cancelBg: '#334155',
  cancelText: '#CBD5E1',
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 22,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.18)',
      },
      default: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 8,
      },
    }),
  },
  title: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 18,
    marginBottom: 8,
  },
  message: {
    fontFamily: Fonts.ui.regular,
    lineHeight: 21,
    fontSize: 14,
    marginBottom: 22,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidthButton: {
    flex: 0,
    width: '100%',
  },
  actionText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 15,
  },
});

export default ConfirmModal;
