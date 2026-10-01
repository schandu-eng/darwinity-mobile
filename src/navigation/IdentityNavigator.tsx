import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '@/types/navigation';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const IdentityNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="Login" getComponent={() => require('@/screens/auth/LoginScreen').default} />
      <Stack.Screen
        name="VerifyEmail"
        getComponent={() => require('@/screens/auth/VerifyEmailScreen').default}
      />
      <Stack.Screen name="Signup" getComponent={() => require('@/screens/auth/MemberSignupScreen').default} />
      <Stack.Screen
        name="OnboardingIdentity"
        getComponent={() => require('@/screens/auth/WelcomeIdentityScreen').default}
      />
      <Stack.Screen
        name="OnboardingDetails"
        getComponent={() => require('@/screens/auth/WelcomeDetailsScreen').default}
      />
      <Stack.Screen
        name="OnboardingLanguage"
        getComponent={() => require('@/screens/auth/WelcomeLanguageScreen').default}
      />
      <Stack.Screen
        name="OnboardingCountry"
        getComponent={() => require('@/screens/auth/WelcomeCountryScreen').default}
      />
      <Stack.Screen
        name="OnboardingSource"
        getComponent={() => require('@/screens/auth/WelcomeSourceScreen').default}
      />
    </Stack.Navigator>
  );
};
