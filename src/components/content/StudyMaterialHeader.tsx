import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Download, Menu } from '@/icons';
import { ConcentrationChip } from '@/features/concentration/FocusChip';
import { BRAND_COLORS } from '@/config/brand';
import { Fonts } from '@/config/fonts';
import { useAppTheme } from '@/store/appThemeStore';

type StudyMaterialHeaderProps = {
  title?: string;
  onBack: () => void;
  onDownload?: () => void;
  downloadDisabled?: boolean;
  downloading?: boolean;
  onTitlePress?: () => void;
};

export const StudyMaterialHeader: React.FC<StudyMaterialHeaderProps> = ({
  title,
  onBack,
  onDownload,
  downloadDisabled = false,
  downloading = false,
  onTitlePress,
}) => {
  const insets = useSafeAreaInsets();
  const isDark = useAppTheme() === 'dark';
  const iconColor = isDark ? '#D4D4D8' : '#3F3F46';
  const topPad = Platform.OS === 'web' ? 6 : insets.top + 6;
  const titleDisabled = !onTitlePress;

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingTop: topPad,
          minHeight: 44 + (Platform.OS === 'web' ? 0 : insets.top),
          backgroundColor: isDark ? '#09090B' : BRAND_COLORS.paper,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onBack}
        style={styles.iconBtn}
        accessibilityRole="button"
        accessibilityLabel="Open navigation menu"
        activeOpacity={0.7}
      >
        <Menu size={20} strokeWidth={2} color={iconColor} />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onTitlePress}
        disabled={titleDisabled}
        activeOpacity={0.7}
        style={styles.titleHit}
        accessibilityRole={onTitlePress ? 'button' : undefined}
        accessibilityLabel={onTitlePress ? `Rename: ${title || 'Notes'}` : undefined}
      >
        <Text numberOfLines={1} style={[styles.title, { color: isDark ? '#F4F4F5' : '#18181B' }]}>
          {title || 'Notes'}
        </Text>
      </TouchableOpacity>

      <View style={styles.actions}>
        <ConcentrationChip variant="header" />
        {onDownload ? (
          <TouchableOpacity
            onPress={onDownload}
            disabled={downloadDisabled || downloading}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={downloading ? 'Preparing download' : 'Download'}
            activeOpacity={0.7}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={iconColor} />
            ) : (
              <Download size={20} strokeWidth={2} color={iconColor} />
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 6,
    gap: 4,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: 'transparent',
  },
  titleHit: {
    flex: 1,
    minWidth: 0,
    marginLeft: 2,
    justifyContent: 'center',
  },
  title: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
});
