import React, { useMemo } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useConcentrationSessionOptional } from './ConcentrationSessionProvider';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';

import { Fonts } from '@/config/fonts';

export const CheckpointModalHost: React.FC = () => {
  const focus = useConcentrationSessionOptional();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const current = focus?.pendingCheckpoints[0] ?? null;

  const message = useMemo(() => {
    if (!current) return '';
    return `Checkpoint ${current.checkpoint_code}: +${current.amount.toFixed(2)} ${current.currency}`;
  }, [current]);

  if (!focus || !current) return null;

  return (
    <Modal transparent animationType="fade" visible>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>Reward unlocked</Text>
          <Text style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>{message}</Text>
          <Text style={[styles.balance, { color: theme.colors.primary }]}>
            Wallet balance: {current.balance.toFixed(2)} {current.currency}
          </Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.colors.primary }]}
            onPress={() => focus.clearCheckpoint(current.inbox_id)}
          >
            <Text style={[styles.btnText, { color: theme.colors.onPrimary }]}>Nice</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
  title: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 20,
  },
  body: {
    fontFamily: Fonts.ui.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  balance: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
    marginTop: 4,
  },
  btn: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 15,
  },
});
