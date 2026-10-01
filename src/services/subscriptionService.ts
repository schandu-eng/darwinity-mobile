import { Platform, Linking } from 'react-native';
import Purchases, {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
  PURCHASES_ERROR_CODE,
  PurchasesError,
} from 'react-native-purchases';
import apiClient from '@/api/client';
import type { ReferralSummary } from '@/api/endpoints/referral';
import type { ApiContentLimits } from '@/utils/contentLimits';
import { getExtra } from '@/utils/constants';

interface MobileProduct {
  product_id: string;
  plan_id: number;
  plan_name: string;
  category: string;
  price: number;
  country: string | null;
  features: {
    uploads: number;
    quiz: number;
    flashcards: number;
    chats: number;
    podcasts: number;
  };
}

interface BillingPlanStatus {
  has_subscription: boolean;
  is_pro?: boolean;
  /** Request-IP billing geo from the API — not profile/onboarding country. */
  billing_country?: string;
  /** True when free users in this request geo must Pro-gate YouTube paste. */
  youtube_pro_gate?: boolean;
  /** Backend YOUTUBE_PRO_GATE mode: off | india | all. */
  youtube_pro_gate_mode?: string;
  content_limits?: ApiContentLimits;
  subscription_id?: number;
  plan_id?: number;
  plan_name?: string;
  plan_category?: string;
  auto_renew_enabled?: boolean;
  mandate_status?: string;
  start_date?: string;
  end_date?: string;
  next_billing_date?: string;
  payment_method?: string;
  payment_reference_id?: string;
  is_trial?: boolean;
  trial_start_date?: string;
  trial_end_date?: string;
  trial_available?: boolean;
  trial_days?: number;
  mobile_product_id?: string;
  is_paused?: boolean;
  pause_end_date?: string;
  grace_period_end?: string;
  offers_visible?: boolean;
  cancelled?: boolean;
  cancellation_date?: string;
  cancellation_effective_date?: string;
  cancellation_reason?: string;
  cancelled_by?: string;
  referral?: ReferralSummary | null;
}

export interface PurchaseResult {
  status: 'success' | 'pending' | 'cancelled';
  customerInfo: CustomerInfo | null;
}

type CustomerInfoListener = (info: CustomerInfo) => void;

interface PaymentHistoryItem {
  id: number;
  subscription_plan_id: number;
  plan_name?: string;
  payment_method?: string;
  payment_reference_id?: string;
  transaction_id?: string;
  price: number;
  currency: string;
  status: string;
  action: string;
  event_type?: string;
  payment_date?: string;
  reason?: string;
  meta_data?: Record<string, any>;
}

class BillingPlanService {
  private isInitialized: boolean = false;
  private isConfigured: boolean = false;
  private loggedInUserId: string | null = null;
  private initializePromise: Promise<void> | null = null;

  private hasActiveAccess(customerInfo: CustomerInfo, opts?: { expectedProductId?: string }): boolean {
    const entitlementsActive = customerInfo?.entitlements?.active
      ? Object.keys(customerInfo.entitlements.active).length > 0
      : false;
    if (entitlementsActive) return true;

    const activeSubscriptions = customerInfo?.activeSubscriptions ?? [];
    if (opts?.expectedProductId) {
      return activeSubscriptions.includes(opts.expectedProductId);
    }
    return activeSubscriptions.length > 0;
  }

  async initialize(userId: number): Promise<void> {
    const targetUserId = userId.toString();
    if (this.isInitialized && this.loggedInUserId === targetUserId) return;

    if (this.initializePromise) {
      await this.initializePromise;
      if (this.isInitialized && this.loggedInUserId === targetUserId) return;
    }

    const initPromise = (async () => {
      try {
        const extra = getExtra();
        const apiKey = (
          Platform.OS === 'ios' ? extra.revenueCatIosApiKey : extra.revenueCatAndroidApiKey
        )?.trim();

        if (!apiKey) {
          throw new Error('RevenueCat API key not configured');
        }

        Purchases.setLogLevel(__DEV__ ? Purchases.LOG_LEVEL.DEBUG : Purchases.LOG_LEVEL.ERROR);
        if (!this.isConfigured) {
          await Purchases.configure({ apiKey });
          this.isConfigured = true;
        }

        if (this.loggedInUserId && this.loggedInUserId !== targetUserId) {
          try {
            await Purchases.logOut();
          } catch {
            
          }
        }

        await Purchases.logIn(targetUserId);

        this.isInitialized = true;
        this.loggedInUserId = targetUserId;
      } catch (error) {
        console.error('Failed to initialize RevenueCat:', error);
        throw error;
      }
    })();

    this.initializePromise = initPromise;
    try {
      await initPromise;
    } finally {
      if (this.initializePromise === initPromise) {
        this.initializePromise = null;
      }
    }
  }

  async reset(): Promise<void> {
    if (this.initializePromise) {
      try {
        await this.initializePromise;
      } catch {
        
      }
    }

    if (!this.isConfigured) {
      this.isInitialized = false;
      this.loggedInUserId = null;
      return;
    }

    try {
      await Purchases.logOut();
    } catch (error) {
      console.warn('Failed to log out of RevenueCat:', error);
    } finally {
      this.isInitialized = false;
      this.loggedInUserId = null;
      this.initializePromise = null;
    }
  }

  async getAvailableProducts(country?: string): Promise<MobileProduct[]> {
    try {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const response = await apiClient.get<{ success: boolean; products: MobileProduct[]; count: number }>(
        '/api/v1/billing/mobile-products',
        {
          params: { platform },
          timeout: 10000,
        }
      );
      return response.data?.products || [];
    } catch (error) {
      console.error('Failed to get mobile products:', error);
      throw error;
    }
  }

  async getOfferings(): Promise<PurchasesOffering | null> {
    if (!this.isInitialized) {
      throw new Error('BillingPlanService not initialized');
    }

    try {
      const offerings = await Purchases.getOfferings();
      return offerings.current;
    } catch (error) {
      console.error('Failed to get offerings:', error);
      throw error;
    }
  }

  async purchasePackage(packageToPurchase: PurchasesPackage, userId: number): Promise<PurchaseResult> {
    if (!this.isInitialized) {
      throw new Error('BillingPlanService not initialized');
    }

    try {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      const expectedProductId = packageToPurchase.product?.identifier;
      const hasAccess = this.hasActiveAccess(customerInfo, { expectedProductId });

      this.syncBackendStatus(userId);

      return { status: hasAccess ? 'success' : 'pending', customerInfo };
    } catch (error: unknown) {
      const purchasesError = error as PurchasesError;

      if (purchasesError?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return { status: 'cancelled', customerInfo: null };
      }

      if (purchasesError?.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
        return { status: 'pending', customerInfo: null };
      }

      if (purchasesError?.code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
        try {
          const expectedProductId = packageToPurchase.product?.identifier;
          const customerInfo = await Purchases.getCustomerInfo();
          const hasAccess = this.hasActiveAccess(customerInfo, { expectedProductId });
          this.syncBackendStatus(userId);
          return { status: hasAccess ? 'success' : 'pending', customerInfo };
        } catch (infoError) {
          console.warn('Purchase returned already purchased, but failed to fetch customer info:', infoError);
          this.syncBackendStatus(userId);
          return { status: 'success', customerInfo: null };
        }
      }

      console.error('Failed to purchase package:', error);
      throw error;
    }
  }

  async restorePurchases(userId: number): Promise<CustomerInfo> {
    if (!this.isInitialized) {
      throw new Error('BillingPlanService not initialized');
    }

    try {
      const customerInfo = await Purchases.restorePurchases();

      const hasAccess = this.hasActiveAccess(customerInfo);
      if (hasAccess) {
        this.syncBackendStatus(userId);
      }

      return customerInfo;
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      throw error;
    }
  }

  async getBillingPlanStatus(userId: number): Promise<BillingPlanStatus> {
    const response = await apiClient.get<BillingPlanStatus>(
      `/api/v1/billing/status/${userId}`
    );
    return response.data;
  }

  async cancelBillingPlan(userId: number, reason?: string): Promise<{ message: string; instructions?: string }> {
    try {
      const response = await apiClient.post<{ success: boolean; message: string; instructions?: string }>(
        '/api/v1/billing/cancel',
        { user_id: userId, reason },
        { timeout: 10000 }
      );
      return { message: response.data.message, instructions: response.data.instructions };
    } catch (error: unknown) {
      console.error('Failed to cancel subscription:', error);
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : undefined;
      throw new Error(errorMessage || 'Failed to cancel subscription');
    }
  }

  async getPaymentHistory(userId: number, limit: number = 20): Promise<PaymentHistoryItem[]> {
    try {
      const response = await apiClient.get<{ history: PaymentHistoryItem[] }>(
        `/api/v1/billing/history/${userId}`,
        {
          params: { limit },
          timeout: 10000,
        }
      );
      return response.data.history || [];
    } catch (error) {
      console.error('Failed to get payment history:', error);
      return [];
    }
  }

  async openStoreBillingPlanManagement(): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        const url = 'https://apps.apple.com/account/subscriptions';
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          await Linking.openURL('itms-apps://apps.apple.com/account/subscriptions');
        }
      } else {
        const url = 'https://play.google.com/store/account/subscriptions';
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          await Linking.openURL('market://account/subscriptions');
        }
      }
    } catch (error) {
      console.error('Failed to open store subscription management:', error);
      throw new Error('Unable to open subscription management. Please open your device settings.');
    }
  }

  addCustomerInfoListener(listener: CustomerInfoListener): void {
    Purchases.addCustomerInfoUpdateListener(listener);
  }

  removeCustomerInfoListener(listener: CustomerInfoListener): void {
    Purchases.removeCustomerInfoUpdateListener(listener);
  }

  async pollForEntitlement(
    intervalMs: number = 5000,
    timeoutMs: number = 180000,
    expectedProductId?: string
  ): Promise<CustomerInfo | null> {
    if (!this.isInitialized) return null;

    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      try {
        const info = await Purchases.getCustomerInfo();
        if (this.hasActiveAccess(info, { expectedProductId })) {
          return info;
        }
      } catch {
        
      }
    }
    return null;
  }

  async getCustomerInfo(): Promise<CustomerInfo> {
    if (!this.isInitialized) {
      throw new Error('BillingPlanService not initialized');
    }

    try {
      return await Purchases.getCustomerInfo();
    } catch (error) {
      console.error('Failed to get customer info:', error);
      throw error;
    }
  }

  async checkBillingPlanAccess(userId: number): Promise<boolean> {
    try {
      const status = await this.getBillingPlanStatus(userId);
      return status.has_subscription && status.plan_name !== 'Free';
    } catch (error) {
      console.error('Failed to check subscription access:', error);
      return false;
    }
  }

  getStoreName(): string {
    return Platform.OS === 'ios' ? 'App Store' : 'Play Store';
  }

  isIOS(): boolean {
    return Platform.OS === 'ios';
  }

  private syncBackendStatus(userId: number): void {
    this.getBillingPlanStatus(userId).catch(() => { });
  }
}

export const subscriptionService = new BillingPlanService();
export type { MobileProduct, BillingPlanStatus, PaymentHistoryItem };