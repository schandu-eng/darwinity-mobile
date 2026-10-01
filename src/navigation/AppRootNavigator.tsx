import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore, useOnboardingStore, useBillingPlanStore } from '@/store';
import { IdentityNavigator } from './IdentityNavigator';
import { MainAppNavigator } from './MainAppNavigator';
import { WelcomeFlowNavigator } from './WelcomeFlowNavigator';
import { UpdateRequiredScreen } from '@/screens/UpdateRequiredScreen';
import { checkForceUpdate } from '@/services/versionCheckService';
import type { RootStackParamList } from '@/types/navigation';
import { analytics } from '@/analytics/analytics';
import { useSessionTracker } from '@/analytics/useSessionTracker';
import { EVENTS } from '@/analytics/events';
import UpgradePaywallModal from '@/components/subscription/UpgradePaywallModal';
import TrialOfferSplashModal from '@/components/subscription/TrialOfferSplashModal';
import { navigationRef } from './navigationRef';
import { ConcentrationOverlayHost } from '@/features/concentration/FocusOverlayHost';
import { markStudyDwellActivity } from '@/features/concentration/dwellQueue';
import { PodcastPlaybackProvider } from '@/features/podcast/PodcastPlaybackContext';
import PodcastMiniPlayer from '@/features/podcast/PodcastMiniPlayer';

const blurWebFocus = () => {
  if (Platform.OS !== 'web') return;
  const doc = (globalThis as { document?: { activeElement?: { blur?: () => void }; body?: unknown } }).document;
  const active = doc?.activeElement;
  if (active && active !== doc?.body && typeof active.blur === 'function') {
    active.blur();
  }
};

const AppSessionTracker: React.FC = () => {
  useSessionTracker(EVENTS.APP_SESSION_STARTED, EVENTS.APP_SESSION_ENDED);
  return null;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = Platform.OS === 'web' ? { enabled: false as const } : undefined;

export const AppRootNavigator: React.FC = () => {
  const [updateRequired, setUpdateRequired] = useState<boolean | null>(null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const userId = useAuthStore((state) => state.user?.id);
  const userEmail = useAuthStore((state) => state.user?.email);
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const hasSeenOnboarding = useOnboardingStore((state) => state.hasSeenOnboarding);
  const isLoadingOnboarding = useOnboardingStore((state) => state.isLoading);
  const initializeOnboarding = useOnboardingStore((state) => state.initializeOnboarding);
  const startBillingPlan = useBillingPlanStore((state) => state.start);
  const resetBillingPlan = useBillingPlanStore((state) => state.reset);

  useEffect(() => {
    initializeAuth();
    initializeOnboarding();
  }, [initializeAuth, initializeOnboarding]);

  useEffect(() => {
    if (isAuthenticated && userId) {
      void startBillingPlan(userId);
      const identifyProps: Record<string, unknown> = {};
      if (userEmail) {
        identifyProps.email = userEmail;
        identifyProps.$email = userEmail;
      }
      analytics.identify(String(userId), identifyProps);
      return;
    }
    void resetBillingPlan();
  }, [isAuthenticated, userId, userEmail, startBillingPlan, resetBillingPlan]);

  useEffect(() => {
    if (__DEV__) {
      setUpdateRequired(false);
      return;
    }
    checkForceUpdate().then(setUpdateRequired);
  }, []);

  if (isLoading || isLoadingOnboarding || updateRequired === null) {
    return null;
  }

  if (updateRequired) {
    return <UpdateRequiredScreen />;
  }

  const rootKey = isAuthenticated
    ? 'app'
    : hasSeenOnboarding
      ? 'auth'
      : 'onboarding';

  return (
    <PodcastPlaybackProvider>
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        markStudyDwellActivity();
        return false;
      }}
      onMoveShouldSetResponderCapture={() => {
        markStudyDwellActivity();
        return false;
      }}
    >
    <NavigationContainer ref={navigationRef} linking={linking} onStateChange={blurWebFocus}>
      {isAuthenticated && userId ? <AppSessionTracker /> : null}
      <Stack.Navigator key={rootKey} screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="App" component={MainAppNavigator} />
        ) : hasSeenOnboarding ? (
          <Stack.Screen name="Auth" component={IdentityNavigator} />
        ) : (
          <Stack.Screen name="Onboarding" component={WelcomeFlowNavigator} />
        )}
      </Stack.Navigator>
      <UpgradePaywallModal />
      {isAuthenticated ? <TrialOfferSplashModal /> : null}
      {isAuthenticated ? <ConcentrationOverlayHost navigationRef={navigationRef} /> : null}
      {isAuthenticated ? <PodcastMiniPlayer /> : null}
    </NavigationContainer>
    </View>
    </PodcastPlaybackProvider>
  );
};
