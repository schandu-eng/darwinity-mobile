import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { X } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useAuthStore } from '@/store/memberAuthStore';
import { SITE_ORIGIN } from '@/utils/constants';
import {
  FLUSH_NOTES_SAVE_SCRIPT,
  NATIVE_NOTES_EMBED_MESSAGE,
  isAllowedEmbedNavigation,
  nativeNotesEmbedUrl,
  openNotesEditorInBrowser,
  parseNativeNotesEmbedMessage,
  tokenInjectScript,
} from '@/utils/notesEmbed';
import type { ContentStackParamList } from '@/types/navigation';

const FLUSH_TIMEOUT_MS = 4000;
const LOAD_TIMEOUT_MS = 18000;

type NotesEditorRoute = RouteProp<ContentStackParamList, 'NotesEditor'>;
type NotesEditorNav = NativeStackNavigationProp<ContentStackParamList, 'NotesEditor'>;

export default function NotesEditorScreen() {
  const navigation = useNavigation<NotesEditorNav>();
  const { contentId } = useRoute<NotesEditorRoute>().params;
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const token = useAuthStore((s) => s.token);

  const webRef = useRef<WebView>(null);
  const dirtyRef = useRef(false);
  const allowLeaveRef = useRef(false);
  const flushWaiterRef = useRef<((ok: boolean) => void) | null>(null);
  const leavingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webFallback, setWebFallback] = useState(Platform.OS === 'web');

  const embedUrl = useMemo(() => nativeNotesEmbedUrl(contentId, token), [contentId, token]);
  const injectScript = useMemo(() => tokenInjectScript(token || ''), [token]);

  const invalidateNotes = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['content'] });
  }, [queryClient]);

  const finishLeave = useCallback(
    (action?: { type: string }) => {
      allowLeaveRef.current = true;
      leavingRef.current = false;
      invalidateNotes();
      if (action) {
        navigation.dispatch(action as never);
        return;
      }
      if (navigation.canGoBack()) navigation.goBack();
    },
    [invalidateNotes, navigation],
  );

  const requestFlush = useCallback((): Promise<boolean> => {
    if (!dirtyRef.current || !ready) return Promise.resolve(true);
    return new Promise((resolve) => {
      flushWaiterRef.current = resolve;
      webRef.current?.injectJavaScript(FLUSH_NOTES_SAVE_SCRIPT);
      setTimeout(() => {
        if (flushWaiterRef.current !== resolve) return;
        flushWaiterRef.current = null;
        resolve(false);
      }, FLUSH_TIMEOUT_MS);
    });
  }, [ready]);

  const leaveAfterFlush = useCallback(
    async (action?: { type: string }) => {
      if (leavingRef.current) return;
      leavingRef.current = true;
      setSaving(true);
      try {
        await requestFlush();
      } finally {
        setSaving(false);
        finishLeave(action);
      }
    },
    [finishLeave, requestFlush],
  );

  const closeNow = useCallback(() => {
    if (dirtyRef.current && ready) {
      void leaveAfterFlush();
      return;
    }
    finishLeave();
  }, [finishLeave, leaveAfterFlush, ready]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (allowLeaveRef.current || webFallback) return;
      if (!dirtyRef.current || !ready) return;
      e.preventDefault();
      void leaveAfterFlush(e.data.action);
    });
    return unsub;
  }, [leaveAfterFlush, navigation, ready, webFallback]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      closeNow();
      return true;
    });
    return () => sub.remove();
  }, [closeNow]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const msg = parseNativeNotesEmbedMessage(event.nativeEvent.data);
      if (!msg) return;
      if (msg.type === NATIVE_NOTES_EMBED_MESSAGE.READY) {
        setReady(true);
        setError(null);
        return;
      }
      if (msg.type === NATIVE_NOTES_EMBED_MESSAGE.DIRTY) {
        dirtyRef.current = true;
        return;
      }
      if (msg.type === NATIVE_NOTES_EMBED_MESSAGE.SAVED) {
        dirtyRef.current = false;
        flushWaiterRef.current?.(true);
        flushWaiterRef.current = null;
        return;
      }
      if (msg.type === NATIVE_NOTES_EMBED_MESSAGE.SAVE_FAILED) {
        flushWaiterRef.current?.(false);
        flushWaiterRef.current = null;
        return;
      }
      if (msg.type === NATIVE_NOTES_EMBED_MESSAGE.AUTH_REQUIRED) {
        setError('Sign in again to edit notes.');
        setReady(false);
        return;
      }
      if (msg.type === NATIVE_NOTES_EMBED_MESSAGE.NOT_FOUND) {
        setError("This note couldn't be opened.");
      }
    },
    [],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (req: WebViewNavigation) => {
      if (!embedUrl) return false;
      return isAllowedEmbedNavigation(req.url, SITE_ORIGIN);
    },
    [embedUrl],
  );

  useEffect(() => {
    if (ready || webFallback || error) return undefined;
    const t = setTimeout(() => {
      setError((prev) => prev || 'Could not load the notes editor.');
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [error, ready, webFallback]);

  useEffect(() => {
    if (!webFallback || !contentId) return;
    void openNotesEditorInBrowser(contentId);
  }, [contentId, webFallback]);

  const paper = themeMode === 'dark' ? '#09090B' : '#FFFFFF';
  const iconColor = themeMode === 'dark' ? '#D4D4D8' : '#3F3F46';

  const header = (
    <View
      style={[
        styles.header,
        {
          paddingTop: insets.top + 6,
          backgroundColor: paper,
          borderBottomColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(24,24,27,0.08)',
        },
      ]}
    >
      <TouchableOpacity
        onPress={closeNow}
        style={styles.iconBtn}
        accessibilityRole="button"
        accessibilityLabel="Close editor"
        activeOpacity={0.7}
      >
        <X size={20} strokeWidth={ICON_STROKE} color={iconColor} />
      </TouchableOpacity>
      <Text numberOfLines={1} style={[styles.title, { color: themeMode === 'dark' ? '#F4F4F5' : '#18181B' }]}>
        {saving ? 'Saving…' : 'Edit notes'}
      </Text>
      <TouchableOpacity
        onPress={closeNow}
        style={styles.doneHit}
        accessibilityRole="button"
        accessibilityLabel="Done"
        activeOpacity={0.7}
        disabled={saving}
      >
        <Text style={[styles.doneLabel, { color: theme.colors.primary, opacity: saving ? 0.5 : 1 }]}>
          Done
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (!token) {
    return (
      <View style={[styles.root, { backgroundColor: paper }]}>
        <StatusBar barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'} />
        {header}
        <Text style={[styles.errorText, { color: theme.colors.onSurface }]}>
          Sign in again to edit notes.
        </Text>
      </View>
    );
  }

  if (!embedUrl) {
    return (
      <View style={[styles.root, { backgroundColor: paper }]}>
        <StatusBar barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'} />
        {header}
        <Text style={[styles.errorText, { color: theme.colors.onSurface }]}>
          Notes editor is not configured for this build.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: paper }]}>
      <StatusBar barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'} />
      {header}

      {error ? (
        <View style={styles.fallback}>
          <Text style={[styles.banner, { color: theme.colors.error }]}>{error}</Text>
          <TouchableOpacity onPress={closeNow} style={styles.doneHit}>
            <Text style={[styles.doneLabel, { color: theme.colors.primary }]}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setError(null);
              setReady(false);
              webRef.current?.reload();
            }}
            style={styles.doneHit}
          >
            <Text style={[styles.doneLabel, { color: theme.colors.primary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : webFallback ? (
        <View style={styles.fallback}>
          <Text style={[styles.fallbackText, { color: theme.colors.onSurface }]}>
            The editor opened in your browser. Come back here when you are done.
          </Text>
          <TouchableOpacity
            onPress={() => {
              setWebFallback(false);
              void openNotesEditorInBrowser(contentId);
            }}
            style={styles.doneHit}
          >
            <Text style={[styles.doneLabel, { color: theme.colors.primary }]}>Open again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.webWrap} collapsable={false}>
          {!ready ? (
            <View style={[styles.loading, { backgroundColor: paper }]} pointerEvents="none">
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : null}
          <WebView
            ref={webRef}
            source={{ uri: embedUrl }}
            style={styles.web}
            originWhitelist={['https://*', 'http://*']}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled={false}
            thirdPartyCookiesEnabled={false}
            setSupportMultipleWindows={false}
            hideKeyboardAccessoryView={false}
            keyboardDisplayRequiresUserAction={false}
            automaticallyAdjustContentInsets={false}
            contentInsetAdjustmentBehavior="never"
            nestedScrollEnabled
            mixedContentMode="always"
            injectedJavaScriptBeforeContentLoaded={injectScript}
            injectedJavaScript={injectScript}
            onMessage={onMessage}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onHttpError={() => setError('Could not load the notes editor.')}
            onError={() => setError('Could not load the notes editor.')}
            startInLoadingState={false}
            allowsBackForwardNavigationGestures={false}
            decelerationRate="normal"
            androidLayerType="hardware"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
    zIndex: 20,
    elevation: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  doneHit: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneLabel: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 16,
  },
  webWrap: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  web: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    fontFamily: Fonts.ui.medium,
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 8,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 15,
    paddingHorizontal: 24,
    paddingTop: 24,
    textAlign: 'center',
  },
  fallback: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 16,
    alignItems: 'center',
  },
  fallbackText: {
    fontFamily: Fonts.ui.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
