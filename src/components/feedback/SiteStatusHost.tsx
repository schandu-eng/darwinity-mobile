import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '@/utils/constants';
import { useAppTheme } from '@/store';
import { lightTheme, darkTheme } from '@/theme';
import { Fonts } from '@/config/fonts';
import {
  isBackendMaintenanceActive,
  isCommsScheduleActive,
  mergePublicChrome,
  msUntilCommsScheduleChange,
} from '@/utils/commsSchedule';

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export default function SiteStatusHost() {
  const insets = useSafeAreaInsets();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const [remote, setRemote] = useState<unknown>(null);
  const [now, setNow] = useState(() => Date.now());
  const chrome = useMemo(() => mergePublicChrome(remote as { chrome?: object } | null), [remote]);

  useEffect(() => {
    const root = (API_BASE_URL || '').replace(/\/$/, '');
    if (!root) return undefined;
    let cancelled = false;
    fetch(`${root}/api/public/comms`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setRemote(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const wait = Math.min(
      msUntilCommsScheduleChange(chrome.banner, now) ?? Infinity,
      msUntilCommsScheduleChange(chrome.maintenance, now) ?? Infinity,
    );
    if (!Number.isFinite(wait)) return undefined;
    const id = setTimeout(() => setNow(Date.now()), Math.min(wait + 50, MAX_TIMEOUT_MS));
    return () => clearTimeout(id);
  }, [chrome.banner, chrome.maintenance, now]);

  const bannerActive = Boolean(
    chrome.banner.enabled && chrome.banner.text && isCommsScheduleActive(chrome.banner, now),
  );
  const maintenanceActive = isBackendMaintenanceActive(
    remote as { chrome?: { maintenance?: { enabled?: boolean; startsAt?: string; endsAt?: string } } } | null,
    now,
  );

  return (
    <>
      {bannerActive ? (
        <View
          style={[
            styles.banner,
            {
              paddingTop: Math.max(insets.top, 10),
              backgroundColor: theme.colors.primary,
            },
          ]}
        >
          <Text style={[styles.bannerText, { color: theme.colors.onPrimary }]}>{chrome.banner.text}</Text>
        </View>
      ) : null}
      <Modal visible={maintenanceActive} transparent animationType="fade" onRequestClose={() => undefined}>
        <View style={styles.overlay}>
          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>{chrome.maintenance.title}</Text>
            <Text style={[styles.body, { color: theme.colors.onSurfaceVariant }]}>{chrome.maintenance.body}</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  bannerText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 22,
  },
  title: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontFamily: Fonts.ui.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
