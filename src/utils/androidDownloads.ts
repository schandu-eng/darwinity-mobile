import * as FileSystem from 'expo-file-system/legacy';
import { NativeModules, Platform } from 'react-native';

interface SaveToDownloadsOptions {
  fileUri: string;
  fileName: string;
  mimeType: string;
}

export type DownloadSaveLocation = 'downloads' | 'app';
export type DownloadSaveMethod = 'mediaStore' | 'saf' | 'appStorage';

export interface SaveToDownloadsResult {
  uri: string;
  location: DownloadSaveLocation;
  method: DownloadSaveMethod;
}

const normalizeFileUri = (fileUri: string): string => {
  if (fileUri.startsWith('file://') || fileUri.startsWith('content://')) {
    return fileUri;
  }
  return `file://${fileUri}`;
};

const mediaStoreDownloadModule = (NativeModules as {
  MediaStoreDownload?: {
    saveToDownloads?: (fileUri: string, fileName: string, mimeType: string) => Promise<string>;
  };
}).MediaStoreDownload;

const getStorageAccessFramework = (): any | null => {
  const SAF = (FileSystem as any).StorageAccessFramework;
  if (!SAF?.requestDirectoryPermissionsAsync || !SAF?.createFileAsync) {
    return null;
  }
  return SAF;
};

const getDownloadSourceUris = async (fileUri: string): Promise<string[]> => {
  const normalizedUri = normalizeFileUri(fileUri);
  const candidates: string[] = [];

  const getContentUriAsync = (FileSystem as unknown as { getContentUriAsync?: (uri: string) => Promise<string> })
    .getContentUriAsync;

  if (Platform.OS === 'android' && typeof getContentUriAsync === 'function') {
    try {
      const contentUri = await getContentUriAsync(normalizedUri);
      if (contentUri) {
        candidates.push(contentUri);
      }
    } catch (error) {
      console.warn('Failed to resolve content URI for download:', error);
    }
  }

  candidates.push(normalizedUri);

  const rawPath = normalizedUri.replace(/^file:\/\//, '');
  if (rawPath && rawPath !== normalizedUri) {
    candidates.push(rawPath);
  }

  return Array.from(new Set(candidates));
};

const requestDirectoryPermission = async (): Promise<{ directoryUri: string } | null> => {
  const SAF = getStorageAccessFramework();
  if (!SAF) {
    return null;
  }

  const initialUri =
    typeof SAF.getUriForDirectoryInRoot === 'function'
      ? SAF.getUriForDirectoryInRoot('Download')
      : null;

  let permission: { granted?: boolean; directoryUri?: string } | null = null;

  try {
    permission = await SAF.requestDirectoryPermissionsAsync(initialUri);
  } catch (error) {
    console.warn('Failed to request initial downloads directory permission:', error);
    permission = null;
  }

  if (!permission?.granted || !permission?.directoryUri) {
    try {
      permission = await SAF.requestDirectoryPermissionsAsync();
    } catch (error) {
      console.warn('Failed to request downloads directory permission:', error);
      permission = null;
    }
  }

  if (!permission?.granted || !permission?.directoryUri) {
    return null;
  }

  return { directoryUri: permission.directoryUri };
};

const saveWithStorageAccessFramework = async (
  fileUri: string,
  fileName: string,
  mimeType: string
): Promise<string | null> => {
  const SAF = getStorageAccessFramework();
  if (!SAF) {
    return null;
  }
  const permission = await requestDirectoryPermission();
  if (!permission) {
    return null;
  }
  const targetUri = await SAF.createFileAsync(permission.directoryUri, fileName, mimeType);
  const base64Data = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
  await FileSystem.writeAsStringAsync(targetUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
  return targetUri;
};

const saveToAppStorage = async (fileUri: string, fileName: string): Promise<string> => {
  const directory = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  if (!directory) {
    throw new Error('Storage directory not available');
  }

  const downloadsDirectory = `${directory}Downloads/`;
  try {
    await FileSystem.makeDirectoryAsync(downloadsDirectory, { intermediates: true });
  } catch (error) {
    console.warn('Failed to ensure app downloads directory exists:', error);
  }

  const targetUri = `${downloadsDirectory}${fileName}`;
  const existingFile = await FileSystem.getInfoAsync(targetUri);
  if (existingFile.exists) {
    await FileSystem.deleteAsync(targetUri, { idempotent: true });
  }

  try {
    await FileSystem.copyAsync({ from: fileUri, to: targetUri });
  } catch (error) {
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(targetUri, base64Data, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  return targetUri;
};

export const saveToDownloadsAndroid = async (
  options: SaveToDownloadsOptions
): Promise<SaveToDownloadsResult> => {
  const { fileUri, fileName, mimeType } = options;
  const normalizedUri = normalizeFileUri(fileUri);
  let lastError: unknown;

  if (mediaStoreDownloadModule?.saveToDownloads) {
    const sourceUris = await getDownloadSourceUris(normalizedUri);

    for (const sourceUri of sourceUris) {
      try {
        const uri = await mediaStoreDownloadModule.saveToDownloads(sourceUri, fileName, mimeType);
        return { uri, location: 'downloads', method: 'mediaStore' };
      } catch (error) {
        lastError = error;
      }
    }
  }

  try {
    const safUri = await saveWithStorageAccessFramework(normalizedUri, fileName, mimeType);
    if (safUri) {
      return { uri: safUri, location: 'downloads', method: 'saf' };
    }
  } catch (error) {
    if (lastError) {
      console.warn('MediaStore download failed, falling back to SAF failed:', lastError, error);
    }
    lastError = error;
  }

  try {
    const appUri = await saveToAppStorage(normalizedUri, fileName);
    if (lastError) {
      console.warn('Download save failed; using app storage fallback:', lastError);
    }
    return { uri: appUri, location: 'app', method: 'appStorage' };
  } catch (error) {
    if (lastError) {
      console.warn('Download save failed; app storage fallback failed:', lastError, error);
    }
    throw error;
  }
};
