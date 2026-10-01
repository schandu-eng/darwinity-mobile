import { authEndpoints } from '@/api/endpoints/auth';
import { onboardingEndpoints } from '@/api/endpoints/onboarding';
import { setAuthToken } from '@/api/client';
import { useAuthStore } from '@/store';
import type { User } from '@/types';
import type { AuthSessionResponse } from '@/api/endpoints/auth';

const getDeviceTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const quotaCarryoverMessage = (
  emailCarried?: boolean,
  deviceCarried?: boolean
): string | null => {
  if (emailCarried && deviceCarried) {
    return 'We detected previous free usage from this email and device, so that usage still applies to your free uploads.';
  }
  if (emailCarried) {
    return 'We detected that this email was previously used, so your earlier free upload usage still applies.';
  }
  if (deviceCarried) {
    return 'We detected multiple free accounts on this device, so its earlier free upload usage still applies.';
  }
  return null;
};

const applySession = async (
  response: AuthSessionResponse,
  emailFallback = ''
): Promise<{
  success: boolean;
  message?: string;
  userPresent?: boolean;
  token?: string;
  email?: string;
  needsEmailVerification?: boolean;
}> => {
  if (response.needsEmailVerification) {
    return {
      success: true,
      needsEmailVerification: true,
      email: response.userEmail || emailFallback,
      message:
        response.message ||
        'Check your email for a verification link to finish creating your account.',
    };
  }

  if (!response.tokenValid || !response.token) {
    return {
      success: false,
      message: 'Unable to create a session. Please try again.',
    };
  }

  const { setAuth } = useAuthStore.getState();
  const resolvedEmail = response.userEmail || emailFallback;

  if (response.userPresent && response.userId) {

    await setAuthToken(response.token);

    let user: User | null = null;
    try {
      const profile = await authEndpoints.getMemberProfile(response.userId);
      user = {
        id: profile.id,
        email: profile.email,
        name: profile.name || '',
        phoneNo: profile.phoneNo,
        college_name: profile.college_name,
        country: profile.country,
        countryCode: profile.countryCode,
        category: profile.category,
        preferredLanguage: profile.preferredLanguage || 'en',
        undergraduateCourse: profile.undergraduateCourse,
        graduateProgram: profile.graduateProgram,
        graduateProgramOtherDesc: profile.graduateProgramOtherDesc,
        graduateCourse: profile.graduateCourse,
        middleSchoolInterest: profile.middleSchoolInterest,
        highSchoolInterest: profile.highSchoolInterest,
        professionalSector: profile.professionalSector,
        professionalSectorOtherDesc: profile.professionalSectorOtherDesc,
        otherBackgroundDesc: profile.otherBackgroundDesc,
        acquisitionSource: profile.acquisitionSource,
      };
    } catch {
      user = {
        id: response.userId,
        email: resolvedEmail,
        name: '',
        college_name: response.college?.name,
      };
    }

    await setAuth(user, response.token);

    return {
      success: true,
      message: 'Login successful',
      userPresent: true,
      email: resolvedEmail,
    };
  }

  return {
    success: true,
    message: 'Please complete signup.',
    userPresent: false,
    token: response.token,
    email: resolvedEmail,
  };
};

const emailFromIdToken = (idToken: string): string => {
  try {
    const payload = idToken.split('.')[1];
    if (!payload) return '';
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const globalAtob = (globalThis as { atob?: (data: string) => string }).atob;
    if (!globalAtob) return '';
    const data = JSON.parse(globalAtob(padded)) as { email?: string };
    return typeof data.email === 'string' ? data.email : '';
  } catch {
    return '';
  }
};

const apiErrorMessage = (error: any, fallback: string) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return error?.message || fallback;
};

export const memberAuthService = {
  register: async (
    email: string,
    password: string,
    name: string
  ): Promise<{
    success: boolean;
    message?: string;
    userPresent?: boolean;
    token?: string;
    needsEmailVerification?: boolean;
    email?: string;
    emailTaken?: boolean;
  }> => {
    try {
      const response = await authEndpoints.register({
        email,
        password,
        name,
        timezone: getDeviceTimezone(),
      });
      return await applySession(response, email);
    } catch (error: any) {
      return {
        success: false,
        message: apiErrorMessage(error, 'Registration failed'),
        emailTaken: error?.response?.status === 409,
      };
    }
  },

  login: async (
    email: string,
    password: string
  ): Promise<{
    success: boolean;
    message?: string;
    userPresent?: boolean;
    token?: string;
    needsEmailVerification?: boolean;
    email?: string;
  }> => {
    try {
      const response = await authEndpoints.login({
        email,
        password,
        timezone: getDeviceTimezone(),
      });
      return await applySession(response, email);
    } catch (error: any) {
      const message = apiErrorMessage(error, 'Login failed');
      const notVerified =
        error?.response?.status === 403 &&
        typeof message === 'string' &&
        message.toLowerCase().includes('verify your email');
      return {
        success: false,
        message,
        needsEmailVerification: notVerified,
        email: notVerified ? email : undefined,
      };
    }
  },

  google: async (
    idToken: string
  ): Promise<{
    success: boolean;
    message?: string;
    userPresent?: boolean;
    token?: string;
    email?: string;
  }> => {
    try {
      const response = await authEndpoints.google({
        idToken,
        timezone: getDeviceTimezone(),
      });
      return await applySession(response, emailFromIdToken(idToken));
    } catch (error: any) {
      return {
        success: false,
        message: apiErrorMessage(error, 'Google sign-in failed'),
      };
    }
  },

  apple: async (
    identityToken: string,
    fullName?: string,
    emailHint?: string
  ): Promise<{
    success: boolean;
    message?: string;
    userPresent?: boolean;
    token?: string;
    email?: string;
  }> => {
    try {
      const response = await authEndpoints.apple({
        identityToken,
        fullName,
        timezone: getDeviceTimezone(),
      });
      return await applySession(
        response,
        emailHint || emailFromIdToken(identityToken)
      );
    } catch (error: any) {
      return {
        success: false,
        message: apiErrorMessage(error, 'Apple sign-in failed'),
      };
    }
  },

  forgotPassword: async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await authEndpoints.forgotPassword(email);
      return {
        success: response.status,
        message: response.reason || 'Check your email for a reset link.',
      };
    } catch (error: any) {
      return {
        success: false,
        message: apiErrorMessage(error, 'Failed to send reset email'),
      };
    }
  },

  resendVerification: async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await authEndpoints.resendVerification(email);
      return {
        success: response.status,
        message:
          response.reason ||
          'If an unverified account exists for that email, we sent a verification link.',
      };
    } catch (error: any) {
      return {
        success: false,
        message: apiErrorMessage(error, 'Failed to resend verification email'),
      };
    }
  },

  signup: async (
    email: string,
    name: string,
    phoneNo?: string,
    token: string,
    countryCode?: string,
    country?: string,
    category?: string,
    undergraduateCourse?: string | null,
    graduateProgram?: string | null,
    graduateProgramOtherDesc?: string | null,
    graduateCourse?: string | null,
    middleSchoolInterest?: string | null,
    highSchoolInterest?: string | null,
    professionalSector?: string | null,
    professionalSectorOtherDesc?: string | null,
    otherBackgroundDesc?: string | null,
    acquisitionSource?: string | null,
    preferredLanguage?: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const response = await onboardingEndpoints.completeOnboarding({
        email,
        name,
        phoneNo: phoneNo ?? '',
        countryCode: countryCode ?? '',
        country: country ?? '',
        category: category || '',
        undergraduateCourse,
        graduateProgram,
        graduateProgramOtherDesc,
        graduateCourse,
        middleSchoolInterest,
        highSchoolInterest,
        professionalSector,
        professionalSectorOtherDesc,
        otherBackgroundDesc,
        acquisitionSource,
      });

      if (!response.status || !response.userId) {
        return {
          success: false,
          message: response.message || 'Signup failed. Please try again.',
        };
      }

      const { setAuth, setWelcomeMessage } = useAuthStore.getState();

      let user: User = {
        id: response.userId,
        email,
        name,
        phoneNo,
        country,
        countryCode,
        category,
        preferredLanguage: preferredLanguage || 'en',
        undergraduateCourse,
        graduateProgram,
        graduateProgramOtherDesc,
        graduateCourse,
        middleSchoolInterest,
        highSchoolInterest,
        professionalSector,
        professionalSectorOtherDesc,
        otherBackgroundDesc,
        acquisitionSource,
      };

      try {
        await setAuthToken(token);
        if (preferredLanguage) {
          try {
            await authEndpoints.updatePreferredLanguage(response.userId, preferredLanguage);
          } catch {

          }
        }
        const profile = await authEndpoints.getMemberProfile(response.userId);
        user = {
          id: profile.id,
          email: profile.email,
          name: profile.name || '',
          phoneNo: profile.phoneNo,
          country: profile.country,
          countryCode: profile.countryCode,
          category: profile.category,
          preferredLanguage: profile.preferredLanguage || 'en',
          undergraduateCourse: profile.undergraduateCourse,
          graduateProgram: profile.graduateProgram,
          graduateProgramOtherDesc: profile.graduateProgramOtherDesc,
          graduateCourse: profile.graduateCourse,
          middleSchoolInterest: profile.middleSchoolInterest,
          highSchoolInterest: profile.highSchoolInterest,
          professionalSector: profile.professionalSector,
          professionalSectorOtherDesc: profile.professionalSectorOtherDesc,
          otherBackgroundDesc: profile.otherBackgroundDesc,
          acquisitionSource: profile.acquisitionSource,
        };
      } catch {

      }

      await setAuth(user, token);
      const carryoverMessage = quotaCarryoverMessage(
        response.emailQuotaCarriedOver,
        response.deviceQuotaCarriedOver
      );
      setWelcomeMessage(carryoverMessage ?? 'Welcome to Darwinity');

      return {
        success: true,
        message: 'Account created successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        message: apiErrorMessage(error, 'Signup failed. Please try again.'),
      };
    }
  },

  verifyMagicToken: async (
    token: string
  ): Promise<{ success: boolean; message?: string; userPresent?: boolean; token?: string }> => {
    try {
      const response = await authEndpoints.verifyMagicToken(token, getDeviceTimezone());
      return await applySession(response);
    } catch (error: any) {
      return {
        success: false,
        message: apiErrorMessage(error, 'Token verification failed'),
      };
    }
  },
};
