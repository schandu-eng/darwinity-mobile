import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { lightTheme } from '@/theme';

import { Fonts } from '@/config/fonts';

export type SettingsListRowProps = {
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress?: () => void;
  rightText?: string;
  rightNode?: React.ReactNode;
  showChevron?: boolean;
  disabled?: boolean;
  showDivider?: boolean;
  tone?: 'default' | 'danger';
  indented?: boolean;
  theme: typeof lightTheme;
};

const SettingsListRow: React.FC<SettingsListRowProps> = ({
  icon,
  label,
  onPress,
  rightText,
  rightNode,
  showChevron = true,
  disabled,
  showDivider = false,
  tone = 'default',
  indented = false,
  theme,
}) => {
  const isDanger = tone === 'danger';
  const iconColor = isDanger ? theme.colors.error : theme.colors.onSurfaceVariant;
  const labelColor = isDanger ? theme.colors.error : theme.colors.onSurface;

  const content = (
    <>
      {icon ? <MaterialCommunityIcons name={icon} size={22} color={iconColor} /> : null}
      <Text style={[styles.listItemText, { color: labelColor }]}>{label}</Text>
      <View style={styles.listItemRight}>
        {rightNode}
        {rightText ? (
          <Text style={[styles.themeLabel, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
            {rightText}
          </Text>
        ) : null}
        {showChevron ? (
          <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.onSurfaceVariant} />
        ) : null}
      </View>
    </>
  );

  return (
    <>
      {onPress ? (
        <TouchableOpacity
          onPress={onPress}
          style={[
            styles.listItem,
            indented ? styles.listItemIndented : null,
            disabled ? styles.listItemDisabled : null,
          ]}
          activeOpacity={0.65}
          disabled={disabled}
        >
          {content}
        </TouchableOpacity>
      ) : (
        <View style={[styles.listItem, indented ? styles.listItemIndented : null]}>{content}</View>
      )}
      {showDivider ? <View style={[styles.divider, { backgroundColor: theme.colors.outlineVariant }]} /> : null}
    </>
  );
};

const styles = StyleSheet.create({
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    gap: 14,
  },
  listItemDisabled: {
    opacity: 0.55,
  },
  listItemIndented: {
    paddingLeft: 36,
  },
  listItemText: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.ui.regular,
    letterSpacing: 0.1,
  },
  listItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  themeLabel: {
    fontSize: 14,
    fontFamily: Fonts.ui.regular,
    maxWidth: 160,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 36,
  },
});

export default SettingsListRow;
