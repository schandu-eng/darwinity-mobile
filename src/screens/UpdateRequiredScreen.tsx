import React from 'react';
import { Text, StyleSheet, Linking, Platform } from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { APP_NAME, getExtra } from '@/utils/constants';
import { Fonts } from '@/config/fonts';

export const UpdateRequiredScreen: React.FC = () => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const { appStoreUrl, playStoreUrl } = getExtra();
  const storeUrl = Platform.OS === 'android' ? playStoreUrl : appStoreUrl;

  const handleUpdate = () => {
    if (storeUrl) Linking.openURL(storeUrl);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <Text style={[styles.title, { color: theme.colors.onBackground }]}>Update Required</Text>
      <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
        A new version of {APP_NAME} is available. Please update to continue.
      </Text>
      <Button mode="contained" onPress={handleUpdate} style={styles.button}>
        Update Now
      </Button>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.display.bold,
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    fontFamily: Fonts.body.regular,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    minWidth: 200,
  },
});
