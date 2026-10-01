import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_TIMEOUT } from '@/utils/constants';
import { clearHighTraffic, noticeHighTrafficError } from '@/utils/highTraffic';

const TOKEN_KEY = '@darwinity_token';
const USER_KEY = '@darwinity_user';
const DEVICE_ID_KEY = '@darwinity_device_id';
let authTokenCache: string | null = null;
let hasHydratedAuthToken = false;
let deviceIdPromise: Promise<string> | null = null;
let unauthorizedHandler: (() => void | Promise<void>) | null = null;

const CREDENTIAL_AUTH_PATHS = [
  '/auth/user/login',
  '/auth/user/register',
  '/auth/user/google',
  '/auth/user/forgot-password',
  '/auth/user/reset-password',
  '/auth/user/verify-email',
  '/auth/user/resend-verification',
  '/auth/user/magic',
  '/auth/user/dev-login',
];

const isCredentialAuthRequest = (error: AxiosError): boolean => {
  const url = `${error.config?.baseURL || ''}${error.config?.url || ''}`;
  return CREDENTIAL_AUTH_PATHS.some((path) => url.includes(path));
};

const generateDeviceId = (): string => {

  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const getDeviceId = (): Promise<string> => {
  if (!deviceIdPromise) {
    deviceIdPromise = (async () => {
      try {
        const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (existing) {
          return existing;
        }
        const generated = generateDeviceId();
        await AsyncStorage.setItem(DEVICE_ID_KEY, generated);
        return generated;
      } catch {
        return generateDeviceId();
      }
    })();
  }
  return deviceIdPromise;
};

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (authTokenCache && config.headers) {
      config.headers.Authorization = `Bearer ${authTokenCache}`;
    }
    if (config.headers) {
      try {
        config.headers['X-Device-Id'] = await getDeviceId();
      } catch {

      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => {
    const url = `${response.config?.baseURL || ''}${response.config?.url || ''}`;
    if (!/\/(health|region-check)(\?|$)/.test(url)) {
      clearHighTraffic();
    }
    return response;
  },
  async (error: AxiosError) => {
    if (error.response?.status === 401 && !isCredentialAuthRequest(error)) {
      authTokenCache = null;
      hasHydratedAuthToken = true;
      await AsyncStorage.removeItem(TOKEN_KEY);
      await AsyncStorage.removeItem(USER_KEY);
      await unauthorizedHandler?.();
    }
    noticeHighTrafficError(error);
    return Promise.reject(error);
  }
);

export const setUnauthorizedHandler = (handler: (() => void | Promise<void>) | null): void => {
  unauthorizedHandler = handler;
};

export const hydrateAuthTokenCache = (token: string | null): void => {
  authTokenCache = token;
  hasHydratedAuthToken = true;
};

export const setAuthToken = async (token: string | null): Promise<void> => {
  authTokenCache = token;
  hasHydratedAuthToken = true;
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
};

export const getAuthToken = async (): Promise<string | null> => {
  if (hasHydratedAuthToken) {
    return authTokenCache;
  }
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  authTokenCache = token;
  hasHydratedAuthToken = true;
  return token;
};

export const setAuthUser = async (user: User | null): Promise<void> => {
  if (user) {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    await AsyncStorage.removeItem(USER_KEY);
  }
};

export const getAuthUser = async (): Promise<User | null> => {
  const userString = await AsyncStorage.getItem(USER_KEY);
  if (userString) {
    try {
      return JSON.parse(userString);
    } catch {
      return null;
    }
  }
  return null;
};

export default apiClient;
