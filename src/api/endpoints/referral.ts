import apiClient from '../client';

export type ReferralSummary = {
  code: string;
  percent_off?: number;
  wallet_credit_percent?: number;
  wallet_credit_ttl_days?: number;
  lifetime_successful_referrals?: number;
  pending_referrals?: number;
};

export const referralEndpoints = {
  getSummary: async (userId: number): Promise<ReferralSummary | null> => {
    const response = await apiClient.get<ReferralSummary>(`/api/referral/${userId}`);
    return response.data || null;
  },
  invite: async (email: string): Promise<{ success: boolean; email: string }> => {
    const response = await apiClient.post<{ success: boolean; email: string }>(
      '/api/referral/invite',
      { email },
    );
    return response.data;
  },
  apply: async (payload: {
    user_id: number;
    referral_code: string;
    discount_code?: string;
  }): Promise<{ success: boolean }> => {
    const response = await apiClient.post<{ success: boolean }>(
      '/api/referral/apply',
      payload,
    );
    return response.data;
  },
};
