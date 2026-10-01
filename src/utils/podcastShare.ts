import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { saveToDownloadsAndroid, type DownloadSaveLocation } from '@/utils/androidDownloads';

interface DownloadPodcastOptions {
  podcastUrl: string;
  title: string;
}

const sanitizeFilename = (filename: string): string => {
  return filename
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200);
};

const getTempFilePath = (title: string): string => {
  const directory = FileSystem.cacheDirectory || '';
  if (!directory) {
    throw new Error('Cache directory not available');
  }
  const sanitizedTitle = sanitizeFilename(title);
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const filename = `${sanitizedTitle}_${timestamp}_${randomSuffix}.wav`;
  return `${directory}${filename}`;
};

const normalizeFileUri = (fileUri: string): string => {
  if (fileUri.startsWith('file://') || fileUri.startsWith('content://')) {
    return fileUri;
  }
  return `file://${fileUri}`;
};

const getDownloadFilename = (title: string): string => {
  const sanitizedTitle = sanitizeFilename(title) || 'Podcast';
  return `${sanitizedTitle}.wav`;
};

export interface SavePodcastResult {
  uri: string;
  location: DownloadSaveLocation;
}

export const downloadPodcastFile = async (
  options: DownloadPodcastOptions
): Promise<string> => {
  const { podcastUrl, title } = options;

  if (!podcastUrl) {
    throw new Error('Podcast URL is required');
  }

  if (!title) {
    throw new Error('Title is required');
  }

  const tempFilePath = getTempFilePath(title);

  try {
    const existingFile = await FileSystem.getInfoAsync(tempFilePath);
    if (existingFile.exists) {
      await FileSystem.deleteAsync(tempFilePath, { idempotent: true });
    }

    const downloadResult = await FileSystem.downloadAsync(podcastUrl, tempFilePath);

    if (downloadResult.status !== 200) {
      try {
        await FileSystem.deleteAsync(tempFilePath, { idempotent: true });
      } catch (cleanupError) {
        console.warn('Failed to cleanup after download error:', cleanupError);
      }
      throw new Error(`Failed to download podcast: HTTP ${downloadResult.status}`);
    }

    const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
    if (!fileInfo.exists) {
      throw new Error('Downloaded file does not exist');
    }

    return downloadResult.uri;
  } catch (error) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(tempFilePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(tempFilePath, { idempotent: true });
      }
    } catch (cleanupError) {
      console.warn('Failed to cleanup after error:', cleanupError);
    }

    if (error instanceof Error && error.message.includes('download')) {
      throw new Error(`Failed to download podcast file: ${error.message}`);
    }
    throw new Error(`Failed to download podcast: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const sharePodcastFile = async (
  fileUri: string,
  title: string,
  onShareComplete?: () => void
): Promise<boolean> => {
  try {
    if (!fileUri) {
      throw new Error('Audio file not available for sharing');
    }

    const safeTitle = title?.trim() || 'Podcast';
    const normalizedUri = normalizeFileUri(fileUri);
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(normalizedUri, {
      mimeType: 'audio/wav',
      dialogTitle: `Share ${safeTitle}.wav`,
      UTI: 'public.wav',
    });
    
    if (onShareComplete) {
      onShareComplete();
    }
    
    return true;
  } catch (error) {
    if (onShareComplete) {
      onShareComplete();
    }
    
    if (error instanceof Error && error.message !== 'User did not share') {
      throw new Error(`Failed to share podcast: ${error.message}`);
    }
    return false;
  }
};

export const savePodcastFile = async (fileUri: string, title: string): Promise<SavePodcastResult> => {
  if (!fileUri) {
    throw new Error('Audio file not available for saving');
  }

  const normalizedUri = normalizeFileUri(fileUri);

  if (Platform.OS === 'android') {
    const result = await saveToDownloadsAndroid({
      fileUri: normalizedUri,
      fileName: getDownloadFilename(title),
      mimeType: 'audio/wav',
    });
    return { uri: result.uri, location: result.location };
  }

  const directory = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  if (!directory) {
    throw new Error('Storage directory not available');
  }

  const filename = getDownloadFilename(title);
  const destinationUri = `${directory}${filename}`;
  const existingFile = await FileSystem.getInfoAsync(destinationUri);
  if (existingFile.exists) {
    await FileSystem.deleteAsync(destinationUri, { idempotent: true });
  }

  await FileSystem.copyAsync({
    from: normalizedUri,
    to: destinationUri,
  });

  return { uri: destinationUri, location: 'app' };
};

export const cleanupPodcastFile = async (fileUri: string): Promise<void> => {
  try {
    if (!fileUri) {
      return;
    }

    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
      
      const verifyInfo = await FileSystem.getInfoAsync(fileUri);
      if (verifyInfo.exists) {
        console.warn('File still exists after deletion attempt:', fileUri);
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup podcast file:', error);
  }
};
