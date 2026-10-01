import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';

export type AppleNativeSignInResult =
  | { ok: true; identityToken: string; fullName?: string; email?: string }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

function formatAppleFullName(
  name: AppleAuthentication.AppleAuthenticationFullName | null | undefined
): string | undefined {
  if (!name) return undefined;
  const parts = [name.givenName, name.middleName, name.familyName]
    .map((p) => (p || '').trim())
    .filter(Boolean);
  return parts.length ? parts.join(' ') : undefined;
}

export async function isNativeAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Native Sign in with Apple (iOS only).
 * identityToken is a JWT; aud is the iOS bundle id (com.darwinity.mobile).
 */
export async function signInWithAppleNative(): Promise<AppleNativeSignInResult> {
  if (Platform.OS !== 'ios') {
    return { ok: false, cancelled: false, message: 'Sign in with Apple is only available on iOS.' };
  }

  const available = await isNativeAppleSignInAvailable();
  if (!available) {
    return {
      ok: false,
      cancelled: false,
      message: 'Sign in with Apple is not available on this device.',
    };
  }

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      return {
        ok: false,
        cancelled: false,
        message: 'Apple did not return a valid sign-in token.',
      };
    }

    return {
      ok: true,
      identityToken: credential.identityToken,
      fullName: formatAppleFullName(credential.fullName),
      email: credential.email || undefined,
    };
  } catch (error: unknown) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code)
        : '';
    if (code === 'ERR_REQUEST_CANCELED' || code === 'ERR_CANCELED') {
      return { ok: false, cancelled: true };
    }
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Unable to complete Sign in with Apple. Please try again.';
    return { ok: false, cancelled: false, message };
  }
}
