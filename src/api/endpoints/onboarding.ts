import apiClient from '../client';

export interface OnboardingEnumsResponse {
  onboardingCategories: string[];
  graduateProgramTypes: string[];
  professionalSectors: string[];
  acquisitionSources: string[];
}

export interface OnboardingRequest {
  name: string;
  email: string;
  phoneNo?: string;
  countryCode?: string;
  country?: string;
  category: string;
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
}

export interface OnboardingResponse {
  status: boolean;
  userId?: number;
  message?: string;
  isApproved?: boolean;
  isApplied?: boolean;
  emailQuotaCarriedOver?: boolean;
  deviceQuotaCarriedOver?: boolean;
}

export const onboardingEndpoints = {
  fetchEnums: async (): Promise<OnboardingEnumsResponse> => {
    const response = await apiClient.get<OnboardingEnumsResponse>('/auth/onboarding/enums');
    return response.data;
  },

  completeOnboarding: async (data: OnboardingRequest): Promise<OnboardingResponse> => {
    const response = await apiClient.post<OnboardingResponse>('/auth/onboarding/complete', data);
    return response.data;
  },
};
