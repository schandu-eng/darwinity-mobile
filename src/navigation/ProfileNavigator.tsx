import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import type { ProfileStackParamList } from '@/types/navigation';
import SettingsScreen from '@/screens/profile/SettingsScreen';

import { Fonts } from '@/config/fonts';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileNavigator: React.FC = () => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerShadowVisible: false,
        headerTintColor: theme.colors.onSurface,
        headerTitleStyle: {
          fontFamily: Fonts.ui.bold,
          fontSize: 20,
        },
        headerTitleAlign: 'left',
        headerShown: true,
        headerBackButtonDisplayMode: 'minimal',
      }}
      initialRouteName="Settings"
    >
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="AccountDetails"
        getComponent={() => require('@/screens/profile/MemberDetailsScreen').default}
        options={{
          title: 'Account details',
        }}
      />
      <Stack.Screen
        name="ChangeLanguage"
        getComponent={() => require('@/screens/profile/ChangeLanguageScreen').default}
        options={{
          title: 'Language',
        }}
      />
      <Stack.Screen
        name="HelpSupport"
        getComponent={() => require('@/screens/profile/HelpSupportScreen').default}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="About"
        getComponent={() => require('@/screens/profile/AboutScreen').default}
        options={{
          title: 'About',
        }}
      />
      <Stack.Screen
        name="BillingPlanSettings"
        getComponent={() => require('@/screens/subscription/SubscriptionSettingsScreen').default}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Upgrade"
        getComponent={() => require('@/screens/subscription/PremiumUpgradeScreen').default}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="RewardsInbox"
        getComponent={() => require('@/screens/concentration/RewardsInboxScreen').default}
        options={{
          title: 'BillingPlan & rewards',
        }}
      />
      <Stack.Screen
        name="StudyStats"
        getComponent={() => require('@/screens/concentration/ConcentrationStatsScreen').default}
        options={{
          title: 'Study quest',
        }}
      />
    </Stack.Navigator>
  );
};
