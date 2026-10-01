import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import { HubHomeHeader } from '@/components/home/HubHomeHeader';
import { Timer } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { BRAND_COLORS } from '@/config/brand';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
const ProductivityScreen: React.FC = () => {
  const themeMode = useAppTheme();
  const isDark = themeMode === 'dark';
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? BRAND_COLORS.charcoal : BRAND_COLORS.paper }]}>
      <HubHomeHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        <View style={styles.pageHeader}>
          <View style={styles.pageTitleRow}>
            <View style={[styles.pageIcon, { backgroundColor: theme.colors.primaryContainer }]}>
              <Timer size={20} strokeWidth={ICON_STROKE} color={theme.colors.primary} />
            </View>
            <Text style={[styles.pageTitle, { color: theme.colors.onSurface }]}>Focus</Text>
          </View>
          <Text style={[styles.pageLead, { color: theme.colors.onSurfaceVariant }]}>
            Use the focus timer to stay on track during study sessions.
          </Text>
        </View>
        <View style={[styles.comingSoonCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
          <Text style={[styles.comingSoonTitle, { color: theme.colors.onSurface }]}>Focus shields & study alarm</Text>
          <Text style={[styles.comingSoonBody, { color: theme.colors.onSurfaceVariant }]}>
            App blocking and quiz alarms are coming soon on Android.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 12,
  },
  pageHeader: {
    paddingBottom: 4,
  },
  pageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pageIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    flex: 1,
    fontFamily: Fonts.ui.semiBold,
    fontSize: 22,
    letterSpacing: -0.4,
  },
  pageLead: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.ui.regular,
  },
  comingSoonCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  comingSoonTitle: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 16,
  },
  comingSoonBody: {
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default ProductivityScreen;
