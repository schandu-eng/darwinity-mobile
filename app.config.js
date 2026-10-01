import { existsSync, readFileSync } from 'fs';
import { parse } from 'dotenv';
import { resolve } from 'path';

const ENV = process.env.APP_ENV || process.env.NODE_ENV || 'development';
const envFile = ENV === 'production' ? '.env.production' : '.env.development';

// Load local env without clobbering EAS/CI secrets. Skip blank placeholders so
// empty REVENUECAT_* lines in git do not win over EAS Environment variables.
(() => {
  const path = resolve(__dirname, envFile);
  if (!existsSync(path)) return;
  const parsed = parse(readFileSync(path));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] !== undefined) continue;
    if (String(value ?? '').trim() === '') continue;
    process.env[key] = value;
  }
})();

function isConfiguredGoogleClientId(value) {
  const id = String(value || '').trim();
  if (!id) return false;
  if (/placeholder|changeme|^your[-_]?|example\.apps|xxx+/i.test(id)) return false;
  return /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(id);
}

function configuredGoogleOAuth() {
  const webClientId = isConfiguredGoogleClientId(process.env.GOOGLE_WEB_CLIENT_ID)
    ? String(process.env.GOOGLE_WEB_CLIENT_ID).trim()
    : '';
  const rawIosClientId = isConfiguredGoogleClientId(process.env.GOOGLE_IOS_CLIENT_ID)
    ? String(process.env.GOOGLE_IOS_CLIENT_ID).trim()
    : '';
  const androidClientId = isConfiguredGoogleClientId(process.env.GOOGLE_ANDROID_CLIENT_ID)
    ? String(process.env.GOOGLE_ANDROID_CLIENT_ID).trim()
    : '';
  const enabled = /^(true|1|yes)$/i.test(String(process.env.GOOGLE_SIGN_IN_ENABLED || '').trim());
  const iosClientId =
    enabled && rawIosClientId && rawIosClientId !== webClientId ? rawIosClientId : '';
  return { webClientId, iosClientId, androidClientId };
}

const isDev = ENV === 'development';
const expoProjectId = (process.env.EXPO_PROJECT_ID || '').trim();
const googleOAuth = configuredGoogleOAuth();

/** Google iOS OAuth plugin expects the reversed client ID as a URL scheme. */
function googleReversedClientScheme(clientId) {
  const id = String(clientId || '').trim();
  const suffix = '.apps.googleusercontent.com';
  if (!id.endsWith(suffix)) return null;
  return `com.googleusercontent.apps.${id.slice(0, -suffix.length)}`;
}

const googleIosScheme = googleReversedClientScheme(googleOAuth.iosClientId);
const urlSchemes = [
  'darwinity',
  'com.darwinity.mobile',
  ...(googleIosScheme ? [googleIosScheme] : []),
];

export default {
  expo: {
    name: isDev ? 'Darwinity Dev' : 'Darwinity',
    slug: 'darwinity-mobile-v2',
    scheme: urlSchemes,
    version: '1.0.4',
    orientation: 'default',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    backgroundColor: '#F4F4F5',
    newArchEnabled: true,
    plugins: [
      [
        'expo-font',
        {
          fonts: [
            './assets/fonts/Syne-Medium.ttf',
            './assets/fonts/Syne-SemiBold.ttf',
            './assets/fonts/Syne-Bold.ttf',
            './assets/fonts/Syne-ExtraBold.ttf',
            './assets/fonts/DMSans-Regular.ttf',
            './assets/fonts/DMSans-Medium.ttf',
            './assets/fonts/DMSans-SemiBold.ttf',
            './assets/fonts/DMSans-Bold.ttf',
            './assets/fonts/Outfit-Regular.ttf',
            './assets/fonts/Outfit-Medium.ttf',
            './assets/fonts/Outfit-SemiBold.ttf',
            './assets/fonts/Outfit-Bold.ttf',
            './assets/fonts/Outfit-ExtraBold.ttf',
          ],
          android: {
            fonts: [
              {
                fontFamily: 'Syne',
                fontDefinitions: [
                  { path: './assets/fonts/Syne-Medium.ttf', weight: 500 },
                  { path: './assets/fonts/Syne-SemiBold.ttf', weight: 600 },
                  { path: './assets/fonts/Syne-Bold.ttf', weight: 700 },
                  { path: './assets/fonts/Syne-ExtraBold.ttf', weight: 800 },
                ],
              },
              {
                fontFamily: 'DMSans',
                fontDefinitions: [
                  { path: './assets/fonts/DMSans-Regular.ttf', weight: 400 },
                  { path: './assets/fonts/DMSans-Medium.ttf', weight: 500 },
                  { path: './assets/fonts/DMSans-SemiBold.ttf', weight: 600 },
                  { path: './assets/fonts/DMSans-Bold.ttf', weight: 700 },
                ],
              },
              {
                fontFamily: 'Outfit',
                fontDefinitions: [
                  { path: './assets/fonts/Outfit-Regular.ttf', weight: 400 },
                  { path: './assets/fonts/Outfit-Medium.ttf', weight: 500 },
                  { path: './assets/fonts/Outfit-SemiBold.ttf', weight: 600 },
                  { path: './assets/fonts/Outfit-Bold.ttf', weight: 700 },
                  { path: './assets/fonts/Outfit-ExtraBold.ttf', weight: 800 },
                ],
              },
            ],
          },
        },
      ],
      'expo-asset',
      [
        'expo-audio',
        {
          microphonePermission:
            'Record audio lectures and meetings to convert them into notes with AI notetaker',
          recordAudioAndroid: true,
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            compileSdkVersion: 36,
            targetSdkVersion: 36,
            enableMinifyInReleaseBuilds: true,
            enableShrinkResourcesInReleaseBuilds: true,
            extraProguardRules: [
              '-keep class expo.modules.** { *; }',
              '-keep class com.revenuecat.purchases.** { *; }',
              '-keep class com.mixpanel.** { *; }',
            ].join('\n'),
          },
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          imageWidth: 180,
          resizeMode: 'contain',
          backgroundColor: '#F4F4F5',
          dark: {
            image: './assets/splash-icon.png',
            backgroundColor: '#09090B',
          },
        },
      ],
      'expo-apple-authentication',
      // Only register when we have a real iOS OAuth URL scheme. Bare inclusion
      // (no options) makes the plugin expect Firebase google-services files and
      // fails prebuild. Google Sign-In UI is already gated at runtime.
      ...(googleIosScheme
        ? [
            [
              '@react-native-google-signin/google-signin',
              {
                iosUrlScheme: googleIosScheme,
              },
            ],
          ]
        : []),
    ],
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: expoProjectId ? `https://u.expo.dev/${expoProjectId}` : undefined,
      fallbackToCacheTimeout: 0,
      checkAutomatically: 'ON_LOAD',
      enabled: !isDev,
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier: isDev ? 'com.darwinity.mobile' : 'com.darwinity.mobile',
      buildNumber: '40',
      usesAppleSignIn: true,
      infoPlist: {
        UIBackgroundModes: ['audio'],
        ITSAppUsesNonExemptEncryption: false,
        CFBundleName: isDev ? 'Darwinity Dev' : 'Darwinity',
        CFBundleDisplayName: isDev ? 'Darwinity Dev' : 'Darwinity',
        NSMicrophoneUsageDescription: 'Record audio lectures and meetings to convert them into notes with AI notetaker',
        UIFileSharingEnabled: true,
        LSSupportsOpeningDocumentsInPlace: true,
      },
    },
    android: {
      label: isDev ? 'Darwinity Dev' : 'Darwinity',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#F1F0EC',
      },
      package: isDev ? 'com.darwinity.mobile' : 'com.darwinity.mobile',
      versionCode: 45,
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      blockedPermissions: [
        'android.permission.SCHEDULE_EXACT_ALARM',
        'android.permission.USE_EXACT_ALARM',
        'android.permission.USE_FULL_SCREEN_INTENT',
      ],
      permissions: [
        'WAKE_LOCK',
        'POST_NOTIFICATIONS',
        'RECORD_AUDIO',
        'VIBRATE',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_MEDIA_PLAYBACK',
      ],
    },
    web: {
      favicon: './assets/favicon.png',
      backgroundColor: '#F4F4F5',
      themeColor: '#F4F4F5',
    },
    extra: {
      eas: {
        projectId: expoProjectId,
      },
      apiBaseUrl: (process.env.API_BASE_URL || '').trim(),
      apiTimeout: process.env.API_TIMEOUT || '30000',
      environment: process.env.ENVIRONMENT || ENV,
      debug: process.env.DEBUG === 'true' || isDev,
      revenueCatIosApiKey: process.env.REVENUECAT_IOS_API_KEY || '',
      revenueCatAndroidApiKey: process.env.REVENUECAT_ANDROID_API_KEY || '',
      googleWebClientId: googleOAuth.webClientId,
      googleIosClientId: googleOAuth.iosClientId,
      googleAndroidClientId: googleOAuth.androidClientId,
      statsigClientKey: process.env.EXPO_PUBLIC_STATSIG_CLIENT_KEY || '',
      statsigFlowchartEnabled: process.env.EXPO_PUBLIC_STATSIG_FLOWCHART_ENABLED === 'true',
      siteOrigin: (process.env.SITE_ORIGIN || '').trim(),
      appStoreUrl: (process.env.APP_STORE_URL || '').trim(),
      playStoreUrl: (process.env.PLAY_STORE_URL || '').trim(),
    },
  },
};
