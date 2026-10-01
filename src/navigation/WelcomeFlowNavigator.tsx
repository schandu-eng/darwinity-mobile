import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { OnboardingStackParamList } from '@/types/navigation';
import { useOnboardingStore } from '@/store';
import { ONBOARDING_STEPS } from '@/utils/welcomeFlowSteps';
import WelcomeIntroScreen from '@/screens/welcome-flow/WelcomeIntroScreen';

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

export const WelcomeFlowNavigator: React.FC = () => {
  const currentStep = useOnboardingStore((state) => state.currentStep);

  const initialState = useMemo(() => {
    if (currentStep <= 0 || currentStep >= ONBOARDING_STEPS.length) {
      return undefined;
    }

    const routes = ONBOARDING_STEPS.slice(0, currentStep + 1).map((name) => ({
      name,
      params: undefined,
    }));

    return {
      index: routes.length - 1,
      routes,
    };
  }, [currentStep]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
      initialRouteName="Welcome"
      {...(initialState ? { initialState } : {})}
    >
      <Stack.Screen name="Welcome" component={WelcomeIntroScreen} />
      <Stack.Screen
        name="Trail"
        getComponent={() => require('@/screens/welcome-flow/WelcomeTrailScreen').default}
      />
      <Stack.Screen
        name="Arrive"
        getComponent={() => require('@/screens/welcome-flow/WelcomeArriveScreen').default}
      />
    </Stack.Navigator>
  );
};
