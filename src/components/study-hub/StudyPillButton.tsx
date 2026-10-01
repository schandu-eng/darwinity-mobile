import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Fonts } from '@/config/fonts';
import { ICON_STROKE, type LucideIcon } from '@/icons';
import { STUDY_INK } from './studyPanelTokens';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
};

export const StudyPillButton: React.FC<Props> = ({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon: Icon,
}) => {
  const primary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        primary ? styles.primary : styles.secondary,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && { opacity: 0.88 },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={primary ? '#fff' : STUDY_INK} />
      ) : (
        <View style={styles.row}>
          {Icon ? <Icon size={16} strokeWidth={ICON_STROKE} color={primary ? '#fff' : STUDY_INK} /> : null}
          <Text style={[styles.label, { color: primary ? '#fff' : STUDY_INK }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  btn: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: STUDY_INK },
  secondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(63,107,79,0.18)',
  },
  disabled: { opacity: 0.45 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontFamily: Fonts.ui.semiBold, fontSize: 14 },
});
