import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import type { ProductivityStackParamList } from '@/types/navigation';
import ProductivityScreen from '@/screens/profile/ProductivityScreen';
import { Fonts } from '@/config/fonts';

const Stack = createNativeStackNavigator<ProductivityStackParamList>();

export const ProductivityNavigator: React.FC = () => {
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
      initialRouteName="ProductivityHome"
    >
      <Stack.Screen
        name="ProductivityHome"
        component={ProductivityScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="FocusShieldAppPicker"
        getComponent={() => require('@/screens/profile/FocusShieldAppPickerScreen').default}
        options={{ title: 'Choose apps' }}
      />
    </Stack.Navigator>
  );
};
