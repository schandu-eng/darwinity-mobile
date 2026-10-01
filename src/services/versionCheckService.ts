import { Platform } from 'react-native';
import Constants from 'expo-constants';
import apiClient from '@/api/client';

export interface MinVersionResponse {
  minimum_supported_version_android: string | null;
  minimum_supported_version_ios: string | null;
}

export async function fetchMinimumVersions(): Promise<MinVersionResponse> {
  const { data } = await apiClient.get<MinVersionResponse>('/api/config/minimum-app-version');
  return data;
}

function parseSemver(version: string): [number, number, number] {
  const parts = version.replace(/^v/, '').split('.').map(Number);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function compareSemver(a: string, b: string): number {
  const [a1, a2, a3] = parseSemver(a);
  const [b1, b2, b3] = parseSemver(b);
  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;
  return a3 - b3;
}

function getCurrentVersion(): string {
  const config = Constants.expoConfig;
  if (Platform.OS === 'android') {
    const vc = config?.android?.versionCode;
    return String(typeof vc === 'number' ? vc : 0);
  }
  return config?.version || config?.ios?.buildNumber || '0';
}

export function isUpdateRequired(
  minAndroid: string | null,
  minIos: string | null
): boolean {
  if (Platform.OS === 'android') {
    if (!minAndroid) return false;
    const current = parseInt(getCurrentVersion(), 10);
    const min = parseInt(minAndroid, 10);
    return isNaN(current) || isNaN(min) || current < min;
  }
  if (!minIos) return false;
  const current = getCurrentVersion();
  return compareSemver(current, minIos) < 0;
}

export async function checkForceUpdate(): Promise<boolean> {
  try {
    const { minimum_supported_version_android, minimum_supported_version_ios } =
      await fetchMinimumVersions();
    return isUpdateRequired(minimum_supported_version_android, minimum_supported_version_ios);
  } catch {
    return false;
  }
}
