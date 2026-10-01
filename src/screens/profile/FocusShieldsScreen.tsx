import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { Text } from 'react-native-paper';
import { LayoutGrid, ShieldOff } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { Fonts } from '@/config/fonts';
import type { ProductivityStackParamList } from '@/types/navigation';
import type {
  FocusShieldPermissions,
  FocusShieldPrefs,
} from '@/features/concentration/focusShields/logic';
import {
  permissionsReady,
  unsupportedPermissions,
} from '@/features/concentration/focusShields/logic';
import {
  getFocusShieldPermissions,
  isFocusShieldNativeAvailable,
  listLauncherApps,
  openNotificationSettings,
  openOverlaySettings,
  openUsageAccessSettings,
  type LauncherApp,
} from '@/features/concentration/focusShields/native';
import {
  loadFocusShieldPrefs,
  setFocusShieldEnabled,
} from '@/features/concentration/focusShields/storage';
import {
  FocusDivider,
  FocusGroup,
  FocusNavRow,
  FocusToggleRow,
  FocusToolCard,
} from '@/components/profile/FocusToolCard';

type Nav = NativeStackNavigationProp<ProductivityStackParamList>;

const FocusShieldsScreen: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const navigation = useNavigation<Nav>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const [prefs, setPrefs] = useState<FocusShieldPrefs>({ enabled: false, packageNames: [] });
  const [permissions, setPermissions] = useState<FocusShieldPermissions>(unsupportedPermissions());
  const [apps, setApps] = useState<LauncherApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const supported = permissions.supported && isFocusShieldNativeAvailable();

  const refresh = useCallback(async () => {
    const [nextPrefs, nextPerms, nextApps] = await Promise.all([
      loadFocusShieldPrefs(),
      getFocusShieldPermissions(),
      listLauncherApps(),
    ]);
    setPrefs(nextPrefs);
    setPermissions(nextPerms);
    setApps(nextApps);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void refresh().finally(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [refresh])
  );

  const selectedApps = useMemo(() => {
    const labels = new Map(apps.map((app) => [app.packageName, app.label]));
    return prefs.packageNames.map((packageName) => ({
      packageName,
      label: labels.get(packageName) || packageName,
    }));
  }, [apps, prefs.packageNames]);

  const handleToggle = useCallback(
    async (value: boolean) => {
      if (toggling) return;
      if (value && !supported) {
        Alert.alert(
          Platform.OS === 'ios' ? 'Android only for now' : 'Rebuild required',
          Platform.OS === 'ios'
            ? 'App blocking uses Android focus APIs. iOS Screen Time support is coming.'
            : 'Install a Darwinity development or production build to block apps. Expo Go cannot do this.'
        );
        return;
      }
      setToggling(true);
      try {
        const next = await setFocusShieldEnabled(value);
        setPrefs(next);
        if (value && next.packageNames.length === 0) {
          Alert.alert(
            'Choose apps to block',
            'Pick the apps that should stay closed during a study session.'
          );
        } else if (value && !permissionsReady(permissions)) {
          Alert.alert(
            'Allow blocking permissions',
            'Darwinity needs usage access and display-over-other-apps to hide distracting apps during focus.'
          );
        }
      } finally {
        setToggling(false);
      }
    },
    [permissions, supported, toggling]
  );

  const card = (
    <FocusToolCard
      icon={ShieldOff}
      title="Block distractions"
      subtitle="Selected apps stay blocked during study sessions, then unlock on break."
    >
      {loading ? (
        <ActivityIndicator style={styles.spinner} color={theme.colors.primary} />
      ) : (
        <>
          <FocusGroup>
            <FocusToggleRow
              title="Block during study sessions"
              hint={supported ? 'Work phases only' : 'Not available on this device'}
              value={prefs.enabled}
              onValueChange={(value) => void handleToggle(value)}
              disabled={toggling}
            />
            <FocusDivider />
            <FocusNavRow
              title="Choose apps"
              hint={
                selectedApps.length === 0
                  ? 'None selected'
                  : `${selectedApps.length} app${selectedApps.length === 1 ? '' : 's'} selected`
              }
              icon={
                <LayoutGrid size={18} strokeWidth={ICON_STROKE} color={theme.colors.onSurface} />
              }
              onPress={() => navigation.navigate('FocusShieldAppPicker')}
              disabled={!supported}
            />
          </FocusGroup>

          {selectedApps.length > 0 ? (
            <View style={styles.chips}>
              {selectedApps.map((app) => (
                <View
                  key={app.packageName}
                  style={[styles.chip, { backgroundColor: theme.colors.surfaceVariant }]}
                >
                  <Text
                    style={[styles.chipText, { color: theme.colors.onSurface }]}
                    numberOfLines={1}
                  >
                    {app.label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {supported && prefs.enabled && !permissions.usageGranted ? (
            <PermissionCard
              title="Usage access"
              body="Needed so Darwinity can tell when a blocked app opens."
              action="Allow usage access"
              onPress={() => void openUsageAccessSettings()}
              theme={theme}
            />
          ) : null}

          {supported && prefs.enabled && !permissions.overlayGranted ? (
            <PermissionCard
              title="Display over other apps"
              body="Needed to show a full-screen block when a distracting app opens."
              action="Allow overlay"
              onPress={() => void openOverlaySettings()}
              theme={theme}
            />
          ) : null}

          {supported && prefs.enabled && !permissions.notificationsGranted ? (
            <PermissionCard
              title="Notifications"
              body="Optional. Lets Darwinity show that blocking is on during a session."
              action="Allow notifications"
              onPress={() => void openNotificationSettings()}
              theme={theme}
            />
          ) : null}
        </>
      )}
    </FocusToolCard>
  );

  if (embedded) return card;

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
      >
        {card}
      </ScrollView>
    </View>
  );
};

const PermissionCard: React.FC<{
  title: string;
  body: string;
  action: string;
  onPress: () => void;
  theme: typeof lightTheme;
}> = ({ title, body, action, onPress, theme }) => (
  <TouchableOpacity
    style={[styles.permission, { backgroundColor: theme.colors.errorContainer }]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <Text style={[styles.permissionTitle, { color: theme.colors.onErrorContainer }]}>{title}</Text>
    <Text style={[styles.permissionBody, { color: theme.colors.onErrorContainer }]}>{body}</Text>
    <Text style={[styles.permissionAction, { color: theme.colors.onErrorContainer }]}>{action}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  page: { flex: 1 },
  scroll: { flex: 1 },
  pageContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  spinner: { marginVertical: 20 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  chipText: { fontSize: 12, fontFamily: Fonts.ui.medium },
  permission: { borderRadius: 14, padding: 14, marginTop: 12 },
  permissionTitle: { fontSize: 15, fontFamily: Fonts.ui.medium },
  permissionBody: { fontSize: 13, fontFamily: Fonts.ui.regular, marginTop: 4, lineHeight: 18 },
  permissionAction: { marginTop: 8, fontSize: 13, fontFamily: Fonts.ui.semiBold },
});

export default FocusShieldsScreen;
