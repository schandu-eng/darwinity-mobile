import apiClient from '../client';

export interface PasswordAuthRequest {
  email: string;
  password: string;
  name?: string;
  timezone?: string;
}

export interface GoogleAuthRequest {
  idToken: string;
  timezone?: string;
}

export interface AppleAuthRequest {
  identityToken: string;
  fullName?: string;
  timezone?: string;
}

export interface AuthSessionResponse {
  token: string;
  tokenValid: boolean;
  userPresent: boolean;
  userId?: number;
  userEmail?: string;
  college?: {
    name: string;
  };
  needsEmailVerification?: boolean;
  message?: string;
}

export interface MemberProfileResponse {
  id: number;
  name: string;
  email: string;
  phoneNo?: string;
  college_name?: string;
  expType?: string;
  currCompany?: string;
  yearsOfExp?: string;
  countryCode?: string;
  country?: string;
  category?: string;
  preferredLanguage?: string;
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

export interface SignupRequest {
  email: string;
  name: string;
  phoneNo: string;
  token: string;
  countryCode?: string;
  country?: string;
  expType?: string;
  collegeName?: string;
  currCompany?: string;
  yearsOfExp?: string;
}

export interface SignupResponse {
  status: boolean;
  userId?: number;
  message?: string;
  emailQuotaCarriedOver?: boolean;
  deviceQuotaCarriedOver?: boolean;
}

export interface DeletionEligibility {
  can_delete: boolean;
  blocked: boolean;
  mandate_status?: string | null;
  subscription_plan_id?: number | null;
  warning?: string | null;
  reason?: string | null;
}

export const authEndpoints = {
  register: async (data: PasswordAuthRequest): Promise<AuthSessionResponse> => {
    const response = await apiClient.post<AuthSessionResponse>('/auth/user/register', data);
    return response.data;
  },

  login: async (data: PasswordAuthRequest): Promise<AuthSessionResponse> => {
    const response = await apiClient.post<AuthSessionResponse>('/auth/user/login', data);
    return response.data;
  },

  google: async (data: GoogleAuthRequest): Promise<AuthSessionResponse> => {
    const response = await apiClient.post<AuthSessionResponse>('/auth/user/google', data);
    return response.data;
  },

  apple: async (data: AppleAuthRequest): Promise<AuthSessionResponse> => {
    const response = await apiClient.post<AuthSessionResponse>('/auth/user/apple', data);
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ status: boolean; reason: string }> => {
    const response = await apiClient.post<{ status: boolean; reason: string }>(
      '/auth/user/forgot-password',
      { email }
    );
    return response.data;
  },

  resendVerification: async (email: string): Promise<{ status: boolean; reason: string }> => {
    const response = await apiClient.post<{ status: boolean; reason: string }>(
      '/auth/user/resend-verification',
      { email }
    );
    return response.data;
  },

  verifyEmail: async (token: string): Promise<AuthSessionResponse> => {
    const response = await apiClient.post<AuthSessionResponse>('/auth/user/verify-email', {
      token,
    });
    return response.data;
  },

  getMemberProfile: async (userId: number): Promise<MemberProfileResponse> => {
    const response = await apiClient.get<MemberProfileResponse>('/auth/user/profile', {
      params: { user_id: userId },
    });
    return response.data;
  },

  signup: async (data: SignupRequest): Promise<SignupResponse> => {
    const response = await apiClient.post<SignupResponse>('/auth/user/addUser', {
      email: data.email,
      name: data.name,
      phoneNo: data.phoneNo,
      countryCode: data.countryCode || '+91',
      country: data.country || 'India',
      expType: data.expType,
      collegeName: data.collegeName,
      currCompany: data.currCompany,
      yearsOfExp: data.yearsOfExp,
    });
    return response.data;
  },

  verifyMagicToken: async (token: string, timezone?: string): Promise<AuthSessionResponse> => {
    const response = await apiClient.get<AuthSessionResponse>('/auth/user/magic', {
      params: { token, timezone },
    });
    return response.data;
  },

  getSupportedLanguages: async (): Promise<{ code: string; name: string }[]> => {
    const response = await apiClient.get<{ code: string; name: string }[]>(
      '/auth/user/supported-languages'
    );
    return response.data;
  },

  updatePreferredLanguage: async (
    userId: number,
    preferredLanguage: string
  ): Promise<{ preferredLanguage: string }> => {
    const response = await apiClient.patch<{ preferredLanguage: string }>(
      '/auth/user/profile/preferred-language',
      { preferredLanguage },
      { params: { user_id: userId } }
    );
    return response.data;
  },

  getDeletionEligibility: async (): Promise<DeletionEligibility> => {
    const response = await apiClient.get<DeletionEligibility>('/auth/user/deletion-eligibility');
    return response.data;
  },

  deleteAccount: async (): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>('/auth/user/delete', {
      timeout: 60000,
    });
    return response.data;
  },
};
