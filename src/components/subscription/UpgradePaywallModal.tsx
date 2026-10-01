import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import { paywallSubmessage, registerUpgradePaywallHandler } from '@/utils/upgradePaywall';
import { navigateToUpgradePlans } from '@/navigation/navigationRef';

import { Fonts } from '@/config/fonts';

const DEFAULT_MESSAGE =
  'Free uploads are exhausted. Go Pro for unlimited study notes, quizzes, and chats.';

const UpgradePaywallModal: React.FC = () => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [limitType, setLimitType] = useState('content');

  useEffect(() => {
    registerUpgradePaywallHandler(({ message: nextMessage, limitType: nextLimitType }) => {
      setMessage(nextMessage || DEFAULT_MESSAGE);
      setLimitType(nextLimitType || 'content');
      setOpen(true);
      analytics.track(EVENTS.PAYWALL_HIT, {
        message: nextMessage,
        limit_type: nextLimitType,
      });
    });
    return () => registerUpgradePaywallHandler(null);
  }, []);

  const handleClose = () => {
    setOpen(false);
  };

  const handleUpgrade = () => {
    analytics.track(EVENTS.UPGRADE_CLICKED, {
      source: 'upgrade_paywall_modal',
      limit_type: limitType,
    });
    setOpen(false);
    navigateToUpgradePlans();
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            accessibilityLabel="Close"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="close" size={20} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>

          <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name="star-four-points" size={22} color={theme.colors.primary} />
          </View>

          <Text style={[styles.title, { color: theme.colors.onSurface }]}>Go Pro now</Text>
          <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>{message}</Text>
          <Text style={[styles.submessage, { color: theme.colors.onSurfaceVariant }]}>
            {paywallSubmessage(limitType)}
          </Text>

          <TouchableOpacity
            onPress={handleUpgrade}
            style={[styles.primaryButton, { backgroundColor: theme.colors.primary }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryButtonText, { color: theme.colors.onPrimary }]}>View Pro Plans</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleClose}
            style={[styles.secondaryButton, { borderColor: theme.colors.outlineVariant }]}
            activeOpacity={0.85}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.colors.onSurface }]}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    borderRadius: 20,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: Fonts.ui.bold,
    fontSize: 20,
    marginBottom: 12,
  },
  message: {
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  submessage: {
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 24,
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 15,
    
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 15,
    
  },
});

export default UpgradePaywallModal;
