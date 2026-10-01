import React, { useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { PaperProvider } from 'react-native-paper';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { Platform, LogBox, Text, TextInput } from 'react-native';
import { useFonts } from 'expo-font';
import { useThemeStore, useAppTheme } from './src/store';
import { lightTheme, darkTheme } from './src/theme';
import { Fonts } from './src/config/fonts';
import { BRAND_FONT_MAP, injectBrandFontCss } from './src/config/loadBrandFonts';
import { injectWebFocusReset } from './src/theme/webCompat';
import { queryClient } from './src/api/queryClient';
import { AppRootNavigator } from './src/navigation/AppRootNavigator';
import { checkAndApplyUpdatesSilently, getUpdateInfo } from './src/utils/updateManager';
import { initAnalytics } from './src/analytics/analytics';
import { ConcentrationSessionProvider } from './src/features/concentration/ConcentrationSessionProvider';
import StatsigAppProvider from './src/featureFlags/StatsigAppProvider';
import HighTrafficOverlay from './src/components/feedback/HighTrafficOverlay';
import SiteStatusHost from './src/components/feedback/SiteStatusHost';

if (!__DEV__) {
  LogBox.ignoreAllLogs(true);
}

SplashScreen.preventAutoHideAsync().catch(() => { });
SplashScreen.setOptions({ duration: 250, fade: true });

(Text as any).defaultProps = (Text as any).defaultProps ?? {};
(Text as any).defaultProps.style = { fontFamily: Fonts.ui.regular };
(TextInput as any).defaultProps = (TextInput as any).defaultProps ?? {};
(TextInput as any).defaultProps.style =
  Platform.OS === 'web'
    ? { fontFamily: Fonts.ui.regular, outlineStyle: 'none', outlineWidth: 0, outlineColor: 'transparent' }
    : { fontFamily: Fonts.ui.regular };
injectWebFocusReset();

function App() {
  const { initializeTheme } = useThemeStore();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  const [fontsLoaded] = useFonts(BRAND_FONT_MAP);

  useEffect(() => {
    if (fontsLoaded) {
      injectBrandFontCss();
      injectWebFocusReset();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    initializeTheme();
    void initAnalytics();
  }, [initializeTheme]);

  useEffect(() => {
    const initializeUpdates = async () => {
      try {
        const updateInfo = getUpdateInfo();
        console.log('Current update info:', updateInfo);

        await checkAndApplyUpdatesSilently();
      } catch (error) {
        console.error('Error initializing updates:', error);
      }
    };

    if (!__DEV__) {
      initializeUpdates();
    }
  }, []);

  const onLayoutRootView = useCallback(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => { });
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider theme={theme}>
            <StatsigAppProvider>
              <ConcentrationSessionProvider>
                <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
                <AppRootNavigator />
                <HighTrafficOverlay />
                <SiteStatusHost />
              </ConcentrationSessionProvider>
            </StatsigAppProvider>
          </PaperProvider>
        </QueryClientProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

export default App;
