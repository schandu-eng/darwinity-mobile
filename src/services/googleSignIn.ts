import { Platform } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { getExtra } from '@/utils/constants';

let configured = false;

/** Google Play Services ApiException status for misconfigured OAuth (package/SHA-1). */
const DEVELOPER_ERROR_CODE = '10';

function googleClientIds(): { webClientId: string; iosClientId: string } {
  const extra = getExtra();
  return {
    webClientId: String(extra.googleWebClientId || '').trim(),
    iosClientId: String(extra.googleIosClientId || '').trim(),
  };
}

function ensureConfigured(): void {
  if (configured) return;

  const { webClientId, iosClientId } = googleClientIds();

  if (Platform.OS === 'android' && !webClientId) {
    throw new Error('Google Sign-In is not configured (missing web client ID).');
  }
  if (Platform.OS === 'ios' && !iosClientId) {
    throw new Error('Google Sign-In is not configured (missing iOS client ID).');
  }

  GoogleSignin.configure({
    // Required on Android to receive an idToken the backend can verify (aud = web client).
    webClientId: webClientId || undefined,
    iosClientId: iosClientId || undefined,
    offlineAccess: false,
  });
  configured = true;
}

export type GoogleNativeSignInResult =
  | { ok: true; idToken: string }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

function isDeveloperError(error: unknown): boolean {
  if (!isErrorWithCode(error)) return false;
  if (String(error.code) === DEVELOPER_ERROR_CODE) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /DEVELOPER_ERROR|ApiException:\s*10\b/i.test(message);
}

/**
 * Native Google Sign-In (Play Services / Google Sign-In SDK).
 * Prefer this over expo-auth-session on Android — Google rejects custom URI
 * scheme browser OAuth for Android clients (Error 400: invalid_request).
 */
export async function signInWithGoogleNative(): Promise<GoogleNativeSignInResult> {
  if (!isNativeGoogleSignInAvailable()) {
    return {
      ok: false,
      cancelled: false,
      message: 'Google sign-in is not available in this build.',
    };
  }
  ensureConfigured();

  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }

    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
      return { ok: false, cancelled: true };
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      // Some Android configs omit idToken on the sign-in payload; getTokens recovers it.
      const tokens = await GoogleSignin.getTokens();
      if (!tokens.idToken) {
        return {
          ok: false,
          cancelled: false,
          message: 'Google did not return a valid sign-in token.',
        };
      }
      return { ok: true, idToken: tokens.idToken };
    }

    return { ok: true, idToken };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) {
      return { ok: false, cancelled: true };
    }
    if (isErrorWithCode(error) && error.code === statusCodes.IN_PROGRESS) {
      return { ok: false, cancelled: false, message: 'Google sign-in is already in progress.' };
    }
    if (isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return {
        ok: false,
        cancelled: false,
        message: 'Google Play Services is required for Google sign-in.',
      };
    }
    if (isDeveloperError(error)) {
      return {
        ok: false,
        cancelled: false,
        message:
          'Google Sign-In is misconfigured for this Android build (package name or SHA-1). ' +
          'Add the upload-key SHA-1 (and Play App Signing SHA-1 once published) to the Android OAuth client in Google Cloud Console, then reinstall this app build.',
      };
    }
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Unable to open Google sign-in. Please try again.';
    return { ok: false, cancelled: false, message };
  }
}

export function isNativeGoogleSignInAvailable(): boolean {
  const { webClientId, iosClientId } = googleClientIds();
  if (Platform.OS === 'android') return Boolean(webClientId);
  if (Platform.OS === 'ios') return Boolean(iosClientId);
  return false;
}
