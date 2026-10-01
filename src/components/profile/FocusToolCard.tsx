import React from 'react';
import { View, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { ChevronRight, type LucideIcon } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { BRAND_COLORS } from '@/config/brand';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';

type FocusToolCardProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
};

export function FocusToolCard({ icon: Icon, title, subtitle, headerRight, children }: FocusToolCardProps) {
  const isDark = useAppTheme() === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconTile, { backgroundColor: theme.colors.primaryContainer }]}>
          <Icon size={18} strokeWidth={ICON_STROKE} color={theme.colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>{subtitle}</Text>
        </View>
        {headerRight}
      </View>
      {children}
    </View>
  );
}

export function FocusGroup({ children }: { children: React.ReactNode }) {
  const isDark = useAppTheme() === 'dark';
  const theme = isDark ? darkTheme : lightTheme;
  return (
    <View
      style={[
        styles.group,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : BRAND_COLORS.white,
          borderColor: theme.colors.outlineVariant,
        },
      ]}
    >
      {children}
    </View>
  );
}

export function FocusDivider() {
  const isDark = useAppTheme() === 'dark';
  return (
    <View
      style={[
        styles.divider,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.08)' },
      ]}
    />
  );
}

export function FocusSectionLabel({ children }: { children: string }) {
  const theme = useAppTheme() === 'dark' ? darkTheme : lightTheme;
  return (
    <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>{children}</Text>
  );
}

type FocusRowProps = {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
};

export function FocusRow({ title, hint, icon, right, onPress, disabled }: FocusRowProps) {
  const theme = useAppTheme() === 'dark' ? darkTheme : lightTheme;
  const inner = (
    <View style={[styles.row, disabled && styles.rowDisabled]}>
      {icon ? <View style={styles.rowIcon}>{icon}</View> : null}
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>{title}</Text>
        {hint ? (
          <Text style={[styles.rowHint, { color: theme.colors.onSurfaceVariant }]}>{hint}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );

  if (!onPress) return inner;
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7}>
      {inner}
    </TouchableOpacity>
  );
}

type FocusToggleRowProps = {
  title: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
};

export function FocusToggleRow({ title, hint, value, onValueChange, disabled }: FocusToggleRowProps) {
  return (
    <FocusRow
      title={title}
      hint={hint}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ false: '#D6D3D1', true: BRAND_COLORS.growth }}
          thumbColor={BRAND_COLORS.white}
          ios_backgroundColor="#D6D3D1"
        />
      }
    />
  );
}

export function FocusNavRow({
  title,
  hint,
  icon,
  onPress,
  disabled,
}: {
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useAppTheme() === 'dark' ? darkTheme : lightTheme;
  return (
    <FocusRow
      title={title}
      hint={hint}
      icon={icon}
      onPress={onPress}
      disabled={disabled}
      right={<ChevronRight size={18} strokeWidth={ICON_STROKE} color={theme.colors.onSurfaceVariant} />}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0, gap: 4 },
  title: {
    fontSize: 18,
    lineHeight: 22,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.ui.regular,
  },
  group: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 11,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowDisabled: { opacity: 0.45 },
  rowIcon: { width: 22, alignItems: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontFamily: Fonts.ui.medium },
  rowHint: { fontSize: 12, fontFamily: Fonts.ui.regular, marginTop: 2, lineHeight: 16 },
});
