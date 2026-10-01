import * as Updates from 'expo-updates';
import { Alert, Platform } from 'react-native';

export interface UpdateCheckResult {
  isAvailable: boolean;
  manifest?: Updates.Manifest;
  error?: Error;
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  try {

    if (__DEV__ || !Updates.isEnabled) {
      return { isAvailable: false };
    }

    const update = await Updates.checkForUpdateAsync();

    return {
      isAvailable: update.isAvailable,
      manifest: update.manifest,
    };
  } catch (error) {
    console.error('Error checking for updates:', error);
    return {
      isAvailable: false,
      error: error as Error,
    };
  }
}

export async function downloadAndApplyUpdate(): Promise<{
  success: boolean;
  error?: Error;
}> {
  try {
    if (__DEV__ || !Updates.isEnabled) {
      return { success: false, error: new Error('Updates not enabled in development') };
    }

    const result = await Updates.fetchUpdateAsync();

    if (result.isNew) {

      return { success: true };
    }

    return { success: false };
  } catch (error) {
    console.error('Error downloading update:', error);
    return {
      success: false,
      error: error as Error,
    };
  }
}

export async function reloadApp(): Promise<void> {
  try {
    if (__DEV__ || !Updates.isEnabled) {
      return;
    }

    await Updates.reloadAsync();
  } catch (error) {
    console.error('Error reloading app:', error);
    throw error;
  }
}

export function getUpdateInfo(): {
  updateId?: string;
  createdAt?: Date;
  runtimeVersion?: string;
  channel?: string;
  isEmbeddedLaunch?: boolean;
} {
  try {
    if (__DEV__ || !Updates.isEnabled) {
      return {};
    }

    return {
      updateId: Updates.updateId || undefined,
      createdAt: Updates.createdAt || undefined,
      runtimeVersion: Updates.runtimeVersion || undefined,
      channel: Updates.channel || undefined,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    };
  } catch (error) {
    console.error('Error getting update info:', error);
    return {};
  }
}

export async function checkAndApplyUpdatesSilently(): Promise<void> {
  try {
    if (__DEV__ || !Updates.isEnabled) {
      return;
    }

    const updateCheck = await checkForUpdates();

    if (updateCheck.isAvailable) {
      const downloadResult = await downloadAndApplyUpdate();
      if (downloadResult.success) {
        await reloadApp();
      }
    }
  } catch (error) {
    console.error('Error in silent update check:', error);

  }
}

export async function checkAndApplyUpdatesWithNotification(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    if (__DEV__ || !Updates.isEnabled) {
      return {
        success: false,
        message: 'Updates are not available in development mode',
      };
    }

    const updateCheck = await checkForUpdates();

    if (!updateCheck.isAvailable) {
      return {
        success: false,
        message: 'No updates available',
      };
    }

    Alert.alert(
      'Update Available',
      'A new version is available. Would you like to download it now?',
      [
        {
          text: 'Later',
          style: 'cancel',
        },
        {
          text: 'Download',
          onPress: async () => {
            const downloadResult = await downloadAndApplyUpdate();

            if (downloadResult.success) {
              Alert.alert(
                'Update Downloaded',
                'The update has been downloaded. The app will restart to apply the update.',
                [
                  {
                    text: 'Restart Now',
                    onPress: async () => {
                      await reloadApp();
                    },
                  },
                  {
                    text: 'Later',
                    style: 'cancel',
                    onPress: () => {

                    },
                  },
                ]
              );
            } else {
              Alert.alert('Update Failed', downloadResult.error?.message || 'Failed to download update');
            }
          },
        },
      ]
    );

    return {
      success: true,
      message: 'Update check completed',
    };
  } catch (error) {
    console.error('Error in update check with notification:', error);
    return {
      success: false,
      message: (error as Error).message || 'Failed to check for updates',
    };
  }
}

export function getUpdateChannel(): string {
  if (__DEV__) {
    return 'development';
  }

  return Updates.channel || 'production';
}
