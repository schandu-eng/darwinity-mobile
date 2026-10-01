import React, { memo } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';

import { Fonts } from '@/config/fonts';

interface ExportSuccessModalProps {
  visible: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

const ExportSuccessModal: React.FC<ExportSuccessModalProps> = ({
  visible,
  title = 'Saved',
  message,
  onClose,
}) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.iconWrapper}>
            <View style={[styles.iconBadge, { backgroundColor: theme.colors.primaryContainer }]}>
              <MaterialCommunityIcons name="check-circle" size={28} color={theme.colors.primary} />
            </View>
          </View>
          <Text variant="titleMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
            {title}
          </Text>
          <Text variant="bodyMedium" style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
            {message}
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={[styles.actionText, { color: theme.colors.onPrimary }]}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  iconWrapper: {
    marginBottom: 12,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.ui.semiBold,
    marginBottom: 6,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButton: {
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  actionText: {
    fontFamily: Fonts.ui.semiBold,
  },
});

export default memo(ExportSuccessModal);
