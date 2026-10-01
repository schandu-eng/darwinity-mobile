import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, type LucideIcon } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { useAppTheme } from '@/store/appThemeStore';
import TourAnchor from '@/components/ui/feature-tour/TourAnchor';
import { InkPanelGradient } from '@/components/brand/InkPanelGradient';
import { boxShadow, pointerEventsProp, pointerEventsStyle } from '@/theme/webCompat';

/** Icon + label row only. Safe-area inset is applied as a separate spacer. */
export const PHONE_TAB_BAR_CONTENT_HEIGHT = 56;
/** @deprecated Use PHONE_TAB_BAR_CONTENT_HEIGHT + insets.bottom. Kept for existing offsets. */
export const PHONE_TAB_BAR_HEIGHT = PHONE_TAB_BAR_CONTENT_HEIGHT;

export type PhoneTabItem = {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
  locked?: boolean;
  tourStepId?: string;
  accessory?: React.ReactNode;
};

type PhoneTabBarProps = {
  items: PhoneTabItem[];
  fab?: {
    onPress: () => void;
    accessibilityLabel?: string;
    tourStepId?: string;
  };
};

const PhoneTabBar: React.FC<PhoneTabBarProps> = ({ items, fab }) => {
  const insets = useSafeAreaInsets();
  const themeMode = useAppTheme();
  const isDark = themeMode === 'dark';
  const bottomPad = Math.max(insets.bottom, 8);

  const bar = (
    <View
      style={[
        styles.bar,
        fab ? styles.barWithFab : null,
        {
          backgroundColor: fab
            ? (isDark ? '#111113' : '#FFFFFF')
            : (isDark ? 'rgba(17,17,19,0.96)' : '#FFFFFF'),
          borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : '#E4E4E7',
        },
      ]}
    >
      {fab ? (
        <View
          style={[
            styles.fabHalo,
            pointerEventsStyle('none'),
            {
              backgroundColor: isDark ? '#111113' : '#FFFFFF',
              ...boxShadow(
                isDark ? '0 8px 24px rgba(255,255,255,0.08)' : '0 8px 24px rgba(26,47,35,0.08)',
                {
                  shadowColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,47,35,0.08)',
                  shadowOpacity: 1,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 4,
                },
              ),
            },
          ]}
          pointerEvents={pointerEventsProp('none')}
        />
      ) : null}

      <View style={styles.row}>
        {items.slice(0, 2).map((item) => (
          <TabButton key={item.id} item={item} isDark={isDark} />
        ))}

        {fab ? (
          <View style={styles.fabSlot}>
            <FabButton fab={fab} isDark={isDark} />
          </View>
        ) : null}

        {items.slice(2).map((item) => (
          <TabButton key={item.id} item={item} isDark={isDark} />
        ))}
      </View>

      <View style={{ height: bottomPad }} />
    </View>
  );

  return bar;
};

const TabButton: React.FC<{
  item: PhoneTabItem;
  isDark: boolean;
}> = ({ item, isDark }) => {
  const activeColor = isDark ? '#7A9E86' : '#1A2F23';
  const inactiveColor = isDark ? '#71717A' : '#A1A1AA';
  const Icon = item.icon;
  const button = (
    <TouchableOpacity
      style={[
        styles.item,
        item.active
          ? {
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(63,107,79,0.12)',
            }
          : null,
      ]}
      onPress={item.onPress}
      disabled={item.disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ selected: item.active, disabled: item.disabled }}
    >
      <View style={styles.iconWrap}>
        <View style={item.locked ? styles.iconLocked : null}>
          <Icon
            size={22}
            strokeWidth={ICON_STROKE}
            color={item.active ? activeColor : inactiveColor}
          />
        </View>
        {item.accessory}
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          { color: item.active ? (isDark ? '#E4E4E7' : '#1A2F23') : inactiveColor },
        ]}
      >
        {item.shortLabel}
      </Text>
    </TouchableOpacity>
  );

  if (!item.tourStepId) return <View style={styles.itemSlot}>{button}</View>;

  return (
    <TourAnchor stepId={item.tourStepId} style={styles.itemSlot}>
      {button}
    </TourAnchor>
  );
};

const FabButton: React.FC<{
  fab: NonNullable<PhoneTabBarProps['fab']>;
  isDark: boolean;
}> = ({ fab }) => {
  const button = (
    <TouchableOpacity
      style={styles.fab}
      onPress={fab.onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={fab.accessibilityLabel || 'Create new note'}
    >
      <View style={styles.fabFill} pointerEvents="none">
        <InkPanelGradient glow={false} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.fabIcon} pointerEvents="none">
        <Plus size={28} strokeWidth={2.4} color="#FAF9F6" />
      </View>
    </TouchableOpacity>
  );

  if (!fab.tourStepId) return button;
  return <TourAnchor stepId={fab.tourStepId}>{button}</TourAnchor>;
};

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'visible',
    ...Platform.select({
      web: { backdropFilter: 'blur(16px)' },
      ios: { shadowOpacity: 0 },
      android: { elevation: 8 },
    }),
  },
  barWithFab: {
    overflow: 'visible',
  },
  row: {
    height: PHONE_TAB_BAR_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  fabHalo: {
    position: 'absolute',
    left: '50%',
    top: 0,
    width: 75,
    height: 75,
    marginLeft: -37.5,
    marginTop: -33,
    borderRadius: 38,
    zIndex: 0,
  },
  itemSlot: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  item: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 8,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  iconLocked: {
    opacity: 0.55,
  },
  label: {
    maxWidth: '100%',
    fontSize: 11,
    fontFamily: Fonts.ui.medium,
    letterSpacing: -0.11,
    lineHeight: 14,
  },
  fabSlot: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 2,
  },
  fab: {
    width: 56,
    height: 56,
    marginTop: -22,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...boxShadow('0 8px 24px rgba(26,47,35,0.32)', {
      shadowColor: '#1A2F23',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.32,
      shadowRadius: 12,
      elevation: 8,
    }),
  },
  fabFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    overflow: 'hidden',
  },
  fabIcon: {
    zIndex: 1,
  },
});

export default PhoneTabBar;
