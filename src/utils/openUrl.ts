import { Alert, Linking } from 'react-native';

export async function openExternalUrl(url: string, errorMessage: string): Promise<void> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
      return;
    }
    Alert.alert('Error', errorMessage);
  } catch {
    Alert.alert('Error', errorMessage);
  }
}
