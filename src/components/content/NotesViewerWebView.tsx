import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useAuthStore } from '@/store/memberAuthStore';
import { SITE_ORIGIN } from '@/utils/constants';
import { Fonts } from '@/config/fonts';
import {
  NATIVE_NOTES_EMBED_MESSAGE,
  isAllowedEmbedNavigation,
  nativeNotesViewEmbedUrl,
  parseNativeNotesEmbedMessage,
  tokenInjectScript,
} from '@/utils/notesEmbed';

const LOAD_TIMEOUT_MS = 18000;

export type NotesViewerWebViewRef = {
  reload: () => void;
};

type NotesViewerWebViewProps = {
  contentId: number;
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
};

function applyEmbedMessage(
  raw: string,
  setReady: (v: boolean) => void,
  setError: (v: string | null) => void,
) {
  const msg = parseNativeNotesEmbedMessage(raw);
  if (!msg) return;
  if (msg.type === NATIVE_NOTES_EMBED_MESSAGE.READY) {
    setReady(true);
    setError(null);
    return;
  }
  if (msg.type === NATIVE_NOTES_EMBED_MESSAGE.AUTH_REQUIRED) {
    setError('Sign in again to view notes.');
    setReady(false);
    return;
  }
  if (msg.type === NATIVE_NOTES_EMBED_MESSAGE.NOT_FOUND) {
    setError("This note couldn't be opened.");
    setReady(false);
  }
}

function isTrustedEmbedOrigin(origin: string): boolean {
  if (!origin || !SITE_ORIGIN) return false;
  try {
    const got = new URL(origin);
    const expected = new URL(SITE_ORIGIN);
    const stripWww = (h: string) => h.replace(/^www\./, '');
    return stripWww(got.hostname) === stripWww(expected.hostname);
  } catch {
    return false;
  }
}

const NotesViewerWebView = forwardRef<NotesViewerWebViewRef, NotesViewerWebViewProps>(
  ({ contentId, visible = true, style }, ref) => {
    const themeMode = useAppTheme();
    const theme = themeMode === 'dark' ? darkTheme : lightTheme;
    const token = useAuthStore((s) => s.token);

    const webRef = useRef<WebView>(null);
    const [iframeNonce, setIframeNonce] = useState(0);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const embedUrl = useMemo(
      () => nativeNotesViewEmbedUrl(contentId, token),
      [contentId, token],
    );
    const injectScript = useMemo(() => tokenInjectScript(token || ''), [token]);
    const paper = themeMode === 'dark' ? '#121214' : '#FFFFFF';
    const isWeb = Platform.OS === 'web';

    useImperativeHandle(
      ref,
      () => ({
        reload: () => {
          setReady(false);
          setError(null);
          if (isWeb) {
            setIframeNonce((n) => n + 1);
            return;
          }
          webRef.current?.reload();
        },
      }),
      [isWeb],
    );

    useEffect(() => {
      setReady(false);
      setError(null);
    }, [contentId, embedUrl]);

    useEffect(() => {
      if (!visible || ready || error || !embedUrl) return undefined;
      const t = setTimeout(() => {
        setError((prev) => prev || 'Could not load notes.');
      }, LOAD_TIMEOUT_MS);
      return () => clearTimeout(t);
    }, [embedUrl, error, ready, visible]);

    useEffect(() => {
      if (!isWeb || typeof window === 'undefined') return undefined;
      const onWindowMessage = (event: MessageEvent) => {
        if (!isTrustedEmbedOrigin(event.origin)) return;
        const raw =
          typeof event.data === 'string'
            ? event.data
            : event.data != null
              ? JSON.stringify(event.data)
              : '';
        applyEmbedMessage(raw, setReady, setError);
      };
      window.addEventListener('message', onWindowMessage);
      return () => window.removeEventListener('message', onWindowMessage);
    }, [isWeb]);

    const onMessage = useCallback((event: WebViewMessageEvent) => {
      applyEmbedMessage(event.nativeEvent.data, setReady, setError);
    }, []);

    const onShouldStartLoadWithRequest = useCallback(
      (req: WebViewNavigation) => {
        if (!embedUrl) return false;
        return isAllowedEmbedNavigation(req.url, SITE_ORIGIN);
      },
      [embedUrl],
    );

    const retry = useCallback(() => {
      setError(null);
      setReady(false);
      if (isWeb) {
        setIframeNonce((n) => n + 1);
        return;
      }
      webRef.current?.reload();
    }, [isWeb]);

    if (!token) {
      return (
        <View style={[styles.root, styles.centered, { backgroundColor: paper }, style]}>
          <Text style={[styles.fallbackText, { color: theme.colors.onSurface }]}>
            Sign in again to view notes.
          </Text>
        </View>
      );
    }

    if (!embedUrl) {
      return (
        <View style={[styles.root, styles.centered, { backgroundColor: paper }, style]}>
          <Text style={[styles.fallbackText, { color: theme.colors.onSurface }]}>
            Notes viewer is not configured for this build.
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={[styles.root, styles.centered, { backgroundColor: paper }, style]}>
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
          <TouchableOpacity
            onPress={retry}
            style={styles.retryBtn}
            accessibilityRole="button"
            accessibilityLabel="Retry loading notes"
          >
            <Text style={[styles.retryLabel, { color: theme.colors.primary }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (isWeb) {
      return (
        <View style={[styles.root, { backgroundColor: paper }, style]} collapsable={false}>
          {!ready ? (
            <View style={[styles.loading, { backgroundColor: paper }]} pointerEvents="none">
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : null}
          {React.createElement('iframe', {
            key: `${contentId}-${iframeNonce}`,
            src: embedUrl,
            title: 'Notes',
            // onLoad alone isn't auth-proof, but keeps notes visible if postMessage
            // bridge isn't deployed yet on SITE_ORIGIN.
            onLoad: () => {
              setReady(true);
              setError(null);
            },
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              border: 'none',
              width: '100%',
              height: '100%',
              backgroundColor: 'transparent',
              opacity: ready ? 1 : 0,
            },
            allow: 'clipboard-read; clipboard-write',
            referrerPolicy: 'strict-origin-when-cross-origin',
          })}
        </View>
      );
    }

    return (
      <View style={[styles.root, { backgroundColor: paper }, style]} collapsable={false}>
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
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          nestedScrollEnabled
          mixedContentMode="always"
          injectedJavaScriptBeforeContentLoaded={injectScript}
          injectedJavaScript={injectScript}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onHttpError={() => setError('Could not load notes.')}
          onError={() => setError('Could not load notes.')}
          startInLoadingState={false}
          allowsBackForwardNavigationGestures={false}
          decelerationRate="normal"
          androidLayerType="hardware"
          scrollEnabled
          bounces={false}
          overScrollMode="never"
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  },
);

NotesViewerWebView.displayName = 'NotesViewerWebView';

export default NotesViewerWebView;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  web: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  fallbackText: {
    fontFamily: Fonts.ui.regular,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 15,
    textAlign: 'center',
  },
  retryBtn: {
    minHeight: 40,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryLabel: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 16,
  },
});
