import { useMutation } from '@tanstack/react-query';
import { memberAuthService } from '@/services/authService';

export const useRegister = () => {
  return useMutation({
    mutationFn: ({ email, password, name }: { email: string; password: string; name: string }) =>
      memberAuthService.register(email, password, name),
  });
};

export const useLogin = () => {
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      memberAuthService.login(email, password),
  });
};

export const useGoogleAuth = () => {
  return useMutation({
    mutationFn: (idToken: string) => memberAuthService.google(idToken),
  });
};

export const useAppleAuth = () => {
  return useMutation({
    mutationFn: ({
      identityToken,
      fullName,
      email,
    }: {
      identityToken: string;
      fullName?: string;
      email?: string;
    }) => memberAuthService.apple(identityToken, fullName, email),
  });
};

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: (email: string) => memberAuthService.forgotPassword(email),
  });
};

export const useResendVerification = () => {
  return useMutation({
    mutationFn: (email: string) => memberAuthService.resendVerification(email),
  });
};

export const useSignup = () => {
  return useMutation({
    mutationFn: ({
      email,
      name,
      phoneNo,
      token,
      countryCode,
      country,
      category,
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
      preferredLanguage,
    }: {
      email: string;
      name: string;
      phoneNo?: string;
      token: string;
      countryCode?: string;
      country?: string;
      category?: string;
      undergraduateCourse?: string | null;
      graduateProgram?: string | null;
      graduateProgramOtherDesc?: string | null;
      graduateCourse?: string | null;
      middleSchoolInterest?: string | null;
      highSchoolInterest?: string | null;
      professionalSector?: string | null;
      professionalSectorOtherDesc?: string | null;
      otherBackgroundDesc?: string | null;
      acquisitionSource?: string | null;
      preferredLanguage?: string;
    }) =>
      memberAuthService.signup(
        email,
        name,
        phoneNo,
        token,
        countryCode,
        country,
        category,
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
        preferredLanguage
      ),
  });
};

export const useVerifyMagicToken = () => {
  return useMutation({
    mutationFn: (token: string) => memberAuthService.verifyMagicToken(token),
  });
};
