import apiClient from '../client';

export interface BillingPlanCheckResponse {
  can_upload: boolean;
  message: string;
}

export interface ValidatePromoResponse {
  valid?: boolean;
  percent_off?: number;
  kind?: string | null;
  influencer_label?: string | null;
  code?: string | null;
  first_purchase_only?: boolean;
  detail?: string | Array<{ msg?: string }> | { msg?: string };
}

export const subscriptionEndpoints = {
  checkUploadLimit: async (userId: number): Promise<BillingPlanCheckResponse> => {
    const response = await apiClient.get<BillingPlanCheckResponse>(
      `/api/v1/billing/user/${userId}/check/upload`
    );
    return response.data;
  },

  validatePromo: async (payload: {
    code: string;
    user_id: number;
    plan_id: number;
    user_country?: string;
  }): Promise<ValidatePromoResponse> => {
    const response = await apiClient.post<ValidatePromoResponse>(
      '/api/payments/validate-promo',
      payload,
    );
    return response.data;
  },
};
