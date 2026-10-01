import { Platform } from 'react-native';
import type { DownloadSaveLocation } from '@/utils/androidDownloads';

interface DownloadSaveMessageOptions {
  plural?: boolean;
}

export const getDownloadSaveMessage = (
  label: string,
  location: DownloadSaveLocation,
  options: DownloadSaveMessageOptions = {}
): string => {
  const verb = options.plural ? 'have' : 'has';

  if (Platform.OS === 'android') {
    return location === 'downloads'
      ? `${label} ${verb} been saved to your Downloads folder.`
      : `${label} ${verb} been saved in the app files folder.`;
  }

  return `${label} ${verb} been saved to your Files app.`;
};
