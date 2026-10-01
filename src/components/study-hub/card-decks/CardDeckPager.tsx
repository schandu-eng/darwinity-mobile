import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';

import { Fonts } from '@/config/fonts';

type Props = {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
};

const CardDeckPager: React.FC<Props> = ({ index, total, onPrev, onNext }) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  if (total <= 0) return null;

  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={onPrev} style={styles.button} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <MaterialCommunityIcons name="chevron-left" size={24} color={theme.colors.onSurface} />
      </TouchableOpacity>
      <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
        {index + 1} / {total}
      </Text>
      <TouchableOpacity onPress={onNext} style={styles.button} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.onSurface} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  button: {
    padding: 4,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.ui.semiBold,
    minWidth: 64,
    textAlign: 'center',
  },
});

export default CardDeckPager;
