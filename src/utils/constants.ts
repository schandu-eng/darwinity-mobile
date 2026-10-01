import Constants from 'expo-constants';

export type ExpoExtra = {
  apiBaseUrl?: string;
  apiTimeout?: string;
  environment?: string;
  debug?: boolean;
  revenueCatIosApiKey?: string;
  revenueCatAndroidApiKey?: string;
  googleWebClientId?: string;
  googleIosClientId?: string;
  googleAndroidClientId?: string;
  statsigClientKey?: string;
  statsigFlowchartEnabled?: boolean;
  siteOrigin?: string;
  appStoreUrl?: string;
  playStoreUrl?: string;
};

export function getExtra(): ExpoExtra {
  return (Constants.expoConfig?.extra || {}) as ExpoExtra;
}

function trimOrigin(value: string | undefined): string {
  return String(value || '').trim().replace(/\/$/, '');
}

export const API_BASE_URL = trimOrigin(getExtra().apiBaseUrl);
export const API_TIMEOUT = parseInt(getExtra().apiTimeout || '30000', 10);

export const ENVIRONMENT = getExtra().environment || 'development';
export const IS_DEV = ENVIRONMENT === 'development';
export const IS_PROD = ENVIRONMENT === 'production';
export const DEBUG = Boolean(getExtra().debug);

export const SITE_ORIGIN = trimOrigin(getExtra().siteOrigin);

export const APP_NAME = 'Darwinity';

export const PODCAST_DEFAULT_COVER_IMAGE = require('../../assets/podcast-cover.jpg');
