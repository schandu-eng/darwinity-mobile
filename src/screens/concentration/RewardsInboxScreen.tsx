import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '@/types/navigation';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';

const RewardsInboxScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;

  useEffect(() => {
    navigation.replace('BillingPlanSettings');
  }, [navigation]);

  return (
    <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default RewardsInboxScreen;
