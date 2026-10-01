import React, { memo, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { FileText, Mic, MoreVertical, Video, type LucideIcon } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { useAppTheme } from '@/store/appThemeStore';
import type { ContentListItem } from '@/api/schemas/content';
import { activityLabelForItem, formatActivityRelative } from '@/utils/dashboardDateGroups';
import { BRAND_COLORS } from '@/config/brand';
import { Fonts } from '@/config/fonts';

interface ContentCardProps {
  item: ContentListItem;
  onPress: (item: ContentListItem) => void;
  onMenuPress?: (item: ContentListItem) => void;
  theme: any;
  /** list = phone-web docs row; grid = docs grid card chrome */
  variant?: 'list' | 'grid';
}

const typeMeta = (contentType: ContentListItem['content_type']): {
  icon: LucideIcon;
  bg: string;
  color: string;
} => {
  if (contentType === 'YOUTUBE') {
    return { icon: Video, bg: '#E8EDE9', color: BRAND_COLORS.growth };
  }
  if (contentType === 'AUDIO_RECORDING') {
    return { icon: Mic, bg: '#DDE6E0', color: '#2F4F3E' };
  }
  return { icon: FileText, bg: 'rgba(63,107,79,0.14)', color: BRAND_COLORS.ink };
};

const ContentCardComponent: React.FC<ContentCardProps> = ({
  item,
  onPress,
  onMenuPress,
  theme,
  variant = 'list',
}) => {
  const isDark = useAppTheme() === 'dark';
  const meta = typeMeta(item.content_type);
  const TypeIcon = meta.icon;
  const { verb, at } = activityLabelForItem(item);
  const subtitle = useMemo(() => {
    const rel = formatActivityRelative(at);
    return rel ? `${verb} ${rel}` : verb;
  }, [verb, at]);

  if (variant === 'grid') {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onPress(item)}
        style={styles.gridCard}
      >
        <View style={styles.gridTop}>
          <View style={[styles.gridIcon, { backgroundColor: isDark ? 'rgba(63,107,79,0.2)' : meta.bg }]}>
            <TypeIcon size={20} strokeWidth={ICON_STROKE} color={isDark ? '#7A9E86' : meta.color} />
          </View>
          {onMenuPress ? (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onMenuPress(item);
              }}
              style={styles.menu}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
              accessibilityLabel="Note options"
            >
              <MoreVertical size={16} strokeWidth={ICON_STROKE} color={isDark ? '#A1A1AA' : '#A1A1AA'} />
            </TouchableOpacity>
          ) : null}
        </View>
        <Text numberOfLines={2} style={[styles.gridTitle, { color: isDark ? '#F4F4F5' : '#18181B' }]}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={[styles.sub, { color: isDark ? '#A1A1AA' : '#71717A' }]}>
          {subtitle}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => onPress(item)} style={styles.row}>
      <View style={[styles.icon, { backgroundColor: isDark ? 'rgba(63,107,79,0.2)' : meta.bg }]}>
        <TypeIcon size={16} strokeWidth={ICON_STROKE} color={isDark ? '#7A9E86' : meta.color} />
      </View>
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.title, { color: isDark ? '#F4F4F5' : '#18181B' }]}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={[styles.sub, { color: isDark ? '#A1A1AA' : '#71717A' }]}>
          {subtitle}
        </Text>
      </View>
      {onMenuPress ? (
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onMenuPress(item);
          }}
          style={styles.menu}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
          accessibilityLabel="Note options"
        >
          <MoreVertical size={16} strokeWidth={ICON_STROKE} color={isDark ? '#A1A1AA' : '#A1A1AA'} />
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 52,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  sub: {
    fontFamily: Fonts.ui.regular,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  menu: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCard: {
    padding: 16,
    minHeight: 120,
  },
  gridTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTitle: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
});

export const ContentCard = memo(
  ContentCardComponent,
  (prev, next) =>
    prev.item.id === next.item.id &&
    prev.item.title === next.item.title &&
    prev.item.last_opened_at === next.item.last_opened_at &&
    prev.item.created_at === next.item.created_at &&
    prev.theme === next.theme &&
    prev.variant === next.variant &&
    prev.onPress === next.onPress &&
    prev.onMenuPress === next.onMenuPress
);
