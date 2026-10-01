import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import type { ExamPrepStackParamList } from '@/types/navigation';
import { Fonts } from '@/config/fonts';

const Stack = createNativeStackNavigator<ExamPrepStackParamList>();

export const ExamPrepNavigator: React.FC = () => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.primary,
        headerTitleStyle: {
          fontFamily: Fonts.ui.semiBold,
          fontSize: 17,
        },
        headerTitleAlign: 'center',
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen
        name="ExamPrepHub"
        getComponent={() => require('@/screens/exam-prep/ExamPrepHubScreen').default}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ExamPrepTarget"
        getComponent={() => require('@/screens/exam-prep/ExamPrepTargetScreen').default}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
};
