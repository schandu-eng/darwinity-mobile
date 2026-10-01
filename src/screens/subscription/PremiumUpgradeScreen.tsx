import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  BackHandler,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Linking,
  Animated,
  TextInput,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore, useBillingPlanStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import type { ProfileStackParamList } from '@/types/navigation';
import { subscriptionService } from '@/services/subscriptionService';
import type { MobileProduct } from '@/services/subscriptionService';
import { subscriptionEndpoints } from '@/api/endpoints/subscription';
import { referralEndpoints } from '@/api/endpoints/referral';
import { REFERRAL_FLOW_ENABLED } from '@/utils/referral';
import Purchases, { PurchasesOffering, PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import AlertModal from '@/components/ui/AlertModal';
import { ShinyUpgradeButton } from '@/components/subscription/ShinyUpgradeButton';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import { isTrialAvailableFromStatus, trialDaysFromStatus, formatTrialDuration } from '@/utils/trialAvailability';

import { Fonts } from '@/config/fonts';
import { ACCOUNT_LINKS } from '@/config/accountLinks';

type UpgradeNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'Upgrade'>;

const PRIVACY_URL = ACCOUNT_LINKS.privacy;
const TERMS_OF_USE_EULA_URL = ACCOUNT_LINKS.eula;
const PENDING_POLL_INTERVAL = 5000;
const PENDING_TIMEOUT = 180000;

const PRO_FEATURES = [
  { title: 'Unlimited uploads', detail: 'PDFs, lectures & notes' },
  { title: 'Unlimited flashcards', detail: 'Practice until it sticks' },
  { title: 'AI tutor in every note', detail: 'Ask anything anytime' },
  { title: 'Unlimited podcasts', detail: 'Review between classes' },
] as const;

function formatApiDetail(detail: unknown, fallback = 'Invalid code'): string {
  if (detail == null || detail === '') return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const parts = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) {
          return String((item as { msg?: string }).msg || '');
        }
        return '';
      })
      .filter(Boolean);
    return parts.length ? parts.join('. ') : fallback;
  }
  if (typeof detail === 'object' && detail !== null) {
    const obj = detail as { msg?: string; message?: string; detail?: string };
    return obj.msg || obj.message || obj.detail || fallback;
  }
  return fallback;
}

const PremiumUpgradeScreen: React.FC = () => {
  const navigation = useNavigation<UpgradeNavigationProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const { user } = useAuthStore();
  const refreshBillingPlan = useBillingPlanStore((state) => state.refresh);
  const billingStatus = useBillingPlanStore((state) => state.status);
  const trialAvailable = isTrialAvailableFromStatus(billingStatus, user?.country);
  const policyTrialDays = trialDaysFromStatus(billingStatus, user?.country);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [availableProducts, setAvailableProducts] = useState<MobileProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(1));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [alertModal, setAlertModal] = useState({ visible: false, title: '', message: '' });
  const [discountCode, setDiscountCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoPercentOff, setPromoPercentOff] = useState<number | null>(null);
  const [promoKind, setPromoKind] = useState<string | null>(null);
  const [promoError, setPromoError] = useState('');
  const [applyingPromo, setApplyingPromo] = useState(false);
  const unmountedRef = useRef(false);
  const isPendingFlowRef = useRef(false);
  const shouldNavigateBackOnAlertCloseRef = useRef(false);
  const isPurchasingRef = useRef(false);

  useEffect(() => {
    analytics.track(EVENTS.SUBSCRIPTION_PAGE_VIEWED);
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  useEffect(() => {
    isPurchasingRef.current = isPurchasing;
  }, [isPurchasing]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;

      const onBackPress = () => {
        if (isPurchasingRef.current) {
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  useEffect(() => {
    const loadProducts = async () => {
      if (!user?.id) return;

      try {
        setIsLoading(true);
        setLoadError(null);

        if (Platform.OS === 'web') {
          setLoadError('In-app purchases are only available on the mobile app. Please use the iOS or Android app to subscribe.');
          setIsLoading(false);
          return;
        }

        await subscriptionService.initialize(user.id);

        const offerings = await subscriptionService.getOfferings();
        setOffering(offerings);

        const products = await subscriptionService.getAvailableProducts();
        setAvailableProducts(
          (products || []).filter((p) => {
            const name = String(p.plan_name || '').toLowerCase();
            const category = String(p.category || '').toLowerCase();
            return !name.includes('crash') && category !== 'weekly';
          }),
        );
      } catch (error) {
        console.error('Failed to load products:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        if (errorMsg.includes('not configured') || errorMsg.includes('API key')) {
          setLoadError(
            'Subscriptions are not configured for this build. Set REVENUECAT_ANDROID_API_KEY / REVENUECAT_IOS_API_KEY in EAS secrets (or .env.production) and rebuild.',
          );
        } else {
          shouldNavigateBackOnAlertCloseRef.current = false;
          setAlertModal({
            visible: true,
            title: 'Error',
            message: 'Failed to load subscription options. Please try again.',
          });
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadProducts();
  }, [user?.id]);

  const handleGoBack = useCallback(() => {
    if (isPurchasing) return;
    navigation.goBack();
  }, [navigation, isPurchasing]);

  const handleAlertClose = useCallback(() => {
    setAlertModal({ visible: false, title: '', message: '' });
    if (shouldNavigateBackOnAlertCloseRef.current) {
      shouldNavigateBackOnAlertCloseRef.current = false;
      navigation.goBack();
    }
  }, [navigation]);

  const handlePurchaseSuccess = useCallback(() => {
    analytics.track(EVENTS.PAYMENT_COMPLETED, { plan_id: 'pro', plan_name: `Pro ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}`, billing_cycle: selectedPlan, platform: Platform.OS });
    setIsPurchasing(false);
    setPendingMessage(null);
    isPendingFlowRef.current = false;

    if (user?.id) {
      void refreshBillingPlan({ force: true });
    }

    shouldNavigateBackOnAlertCloseRef.current = true;
    setAlertModal({
      visible: true,
      title: 'Success!',
      message: 'Your subscription has been activated. Enjoy unlimited access!',
    });
  }, [user?.id, refreshBillingPlan]);

  const waitForPendingPayment = useCallback(async (expectedProductId?: string) => {
    setPendingMessage('Waiting for payment confirmation...');
    unmountedRef.current = false;

    const hasActiveAccess = (info: CustomerInfo): boolean => {
      const entitlementsActive = info?.entitlements?.active ? Object.keys(info.entitlements.active).length > 0 : false;
      if (entitlementsActive) return true;
      if (expectedProductId) {
        return (info.activeSubscriptions ?? []).includes(expectedProductId);
      }
      return (info.activeSubscriptions ?? []).length > 0;
    };

    let listener: ((info: CustomerInfo) => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanupListener = () => {
      if (listener) {
        try {
          subscriptionService.removeCustomerInfoListener(listener);
        } catch {
          
        }
        listener = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    try {
      const listenerPromise = new Promise<CustomerInfo | null>((resolve) => {
        listener = (info: CustomerInfo) => {
          if (hasActiveAccess(info)) {
            cleanupListener();
            resolve(info);
          }
        };
        subscriptionService.addCustomerInfoListener(listener);

        timeoutId = setTimeout(() => {
          cleanupListener();
          resolve(null);
        }, PENDING_TIMEOUT);
      });

      const pollPromise = subscriptionService.pollForEntitlement(
        PENDING_POLL_INTERVAL,
        PENDING_TIMEOUT,
        expectedProductId
      );

      const result = await Promise.race([listenerPromise, pollPromise]);

      cleanupListener();
      if (unmountedRef.current) return;

      isPendingFlowRef.current = false;

      if (result && hasActiveAccess(result)) {
        handlePurchaseSuccess();
        return;
      }

      setIsPurchasing(false);
      setPendingMessage(null);
      shouldNavigateBackOnAlertCloseRef.current = false;
      setAlertModal({
        visible: true,
        title: 'Payment Pending',
        message: 'Your payment is still being processed. Your subscription will activate automatically once the payment is confirmed. You can close this screen.',
      });
    } catch (error: unknown) {
      cleanupListener();
      if (unmountedRef.current) return;

      isPendingFlowRef.current = false;
      setIsPurchasing(false);
      setPendingMessage(null);
      shouldNavigateBackOnAlertCloseRef.current = false;
      const errorMessage = error instanceof Error ? error.message : 'Failed to confirm payment status';
      setAlertModal({
        visible: true,
        title: 'Confirmation Failed',
        message: `${errorMessage}. Please try “Restore Purchase” or check again in a moment.`,
      });
    }
  }, [handlePurchaseSuccess]);

  const handlePurchase = useCallback(async () => {
    if (!user?.id || !offering || isPurchasing) return;

    analytics.track(EVENTS.UPGRADE_CLICKED, { plan_id: 'pro', plan_name: `Pro ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}`, billing_cycle: selectedPlan, platform: Platform.OS });
    setIsPurchasing(true);
    setPendingMessage(null);
    try {
      const status = await refreshBillingPlan({ force: true });
      const mandateStatus = status?.mandate_status;
      if (typeof mandateStatus === 'string' && mandateStatus.toUpperCase() === 'BILLING_ISSUE') {
        shouldNavigateBackOnAlertCloseRef.current = false;
        setAlertModal({
          visible: true,
          title: 'Billing Issue Detected',
          message: 'Your current subscription has a billing issue. Please resolve or cancel it before purchasing a new plan.',
        });
        return;
      }
      if (status?.plan_id && status.plan_id !== 1) {
        shouldNavigateBackOnAlertCloseRef.current = false;
        setAlertModal({
          visible: true,
          title: 'BillingPlan Active',
          message: 'You already have an active subscription. Please wait for it to end before purchasing a new plan.',
        });
        return;
      }

      const packages = offering.availablePackages;
      const targetPackageType = selectedPlan === 'annual'
        ? Purchases.PACKAGE_TYPE.ANNUAL
        : Purchases.PACKAGE_TYPE.MONTHLY;
      let packageToPurchase: PurchasesPackage | null = packages.find(pkg => pkg.packageType === targetPackageType) || null;

      if (!packageToPurchase) {
        const tokens = selectedPlan === 'annual'
          ? ['annual', 'yearly', 'year']
          : ['monthly', 'month'];
        packageToPurchase = packages.find(pkg => tokens.some(t => pkg.identifier.toLowerCase().includes(t))) || null;
      }

      if (!packageToPurchase) {
        throw new Error('Selected package not available. Please try again later.');
      }

      analytics.track(EVENTS.PAYMENT_INITIATED, { plan_id: 'pro', plan_name: `Pro ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}`, billing_cycle: selectedPlan, platform: Platform.OS, product_id: packageToPurchase.product?.identifier });
      const result = await subscriptionService.purchasePackage(packageToPurchase, user.id);

      if (result.status === 'cancelled') {
        analytics.track(EVENTS.PAYMENT_CANCELLED, { plan_id: 'pro', plan_name: `Pro ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}`, billing_cycle: selectedPlan, platform: Platform.OS });
        return;
      }

      if (result.status === 'success') {
        handlePurchaseSuccess();
        return;
      }

      isPendingFlowRef.current = true;
      void waitForPendingPayment(packageToPurchase.product?.identifier);
      return;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to complete purchase';
      analytics.track(EVENTS.PAYMENT_FAILED, { plan_id: 'pro', plan_name: `Pro ${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)}`, billing_cycle: selectedPlan, platform: Platform.OS, error: errorMessage });
      shouldNavigateBackOnAlertCloseRef.current = false;
      setAlertModal({
        visible: true,
        title: 'Purchase Failed',
        message: errorMessage,
      });
    } finally {
      if (!isPendingFlowRef.current) {
        setIsPurchasing(false);
      }
    }
  }, [user?.id, offering, selectedPlan, isPurchasing, refreshBillingPlan, handlePurchaseSuccess, waitForPendingPayment]);

  const handleRestorePurchases = useCallback(async () => {
    if (!user?.id) return;

    try {
      await subscriptionService.initialize(user.id);
      const customerInfo = await subscriptionService.restorePurchases(user.id);

      const hasActiveAccess =
        Object.keys(customerInfo.entitlements.active).length > 0 ||
        (customerInfo.activeSubscriptions ?? []).length > 0;
      if (!hasActiveAccess) {
        shouldNavigateBackOnAlertCloseRef.current = false;
        setAlertModal({
          visible: true,
          title: 'No Active BillingPlans',
          message: 'No active subscriptions were found for this store account.',
        });
        return;
      }

      void refreshBillingPlan({ force: true });
      shouldNavigateBackOnAlertCloseRef.current = false;
      setAlertModal({
        visible: true,
        title: 'Success',
        message: 'Purchases restored successfully',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to restore purchases';
      if (errorMessage.includes('cancelled')) return;
      shouldNavigateBackOnAlertCloseRef.current = false;
      setAlertModal({
        visible: true,
        title: 'Restore Failed',
        message: errorMessage,
      });
    }
  }, [user?.id, refreshBillingPlan]);

  const formatCurrency = useCallback((amount: number, currency: string = 'INR') => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  }, []);

  const annualProduct = useMemo(() => {
    return availableProducts.find((p) => {
      const category = p.category?.toLowerCase();
      const name = p.plan_name.toLowerCase();
      if (name.includes('crash')) return false;
      return category === 'yearly' || name.includes('year');
    });
  }, [availableProducts]);

  const monthlyProduct = useMemo(() => {
    return availableProducts.find((p) => {
      const category = p.category?.toLowerCase();
      const name = p.plan_name.toLowerCase();
      if (name.includes('crash')) return false;
      return category === 'monthly' || name.includes('month');
    });
  }, [availableProducts]);

  const { annualPackage, monthlyPackage } = useMemo(() => {
    if (!offering?.availablePackages) {
      return { annualPackage: null, monthlyPackage: null };
    }

    const packages = offering.availablePackages.filter((pkg) => {
      if (pkg.packageType === Purchases.PACKAGE_TYPE.WEEKLY) return false;
      const blob = `${pkg.identifier} ${pkg.product?.identifier || ''} ${pkg.product?.title || ''}`.toLowerCase();
      return !blob.includes('crash');
    });

    const annual = packages.find(pkg => pkg.packageType === Purchases.PACKAGE_TYPE.ANNUAL)
      || packages.find(pkg => {
        const identifier = pkg.identifier.toLowerCase();
        return identifier.includes('annual') || identifier.includes('yearly') || identifier.includes('year');
      })
      || null;

    const monthly = packages.find(pkg => pkg.packageType === Purchases.PACKAGE_TYPE.MONTHLY)
      || packages.find(pkg => {
        const identifier = pkg.identifier.toLowerCase();
        return identifier.includes('monthly') || identifier.includes('month');
      })
      || null;

    return { annualPackage: annual, monthlyPackage: monthly };
  }, [offering]);

  const annualPrice = annualPackage?.product?.price ?? annualProduct?.price ?? 0;
  const monthlyPrice = monthlyPackage?.product?.price ?? monthlyProduct?.price ?? 0;
  const annualCurrency = annualPackage?.product?.currencyCode ?? 'INR';
  const monthlyCurrency = monthlyPackage?.product?.currencyCode ?? 'INR';
  const annualPriceString = annualPackage?.product?.priceString ?? (annualPrice > 0 ? formatCurrency(annualPrice, annualCurrency) : '');
  const monthlyPriceString = monthlyPackage?.product?.priceString ?? (monthlyPrice > 0 ? formatCurrency(monthlyPrice, monthlyCurrency) : '');

  const monthlyTotalForYear = monthlyPrice * 12;
  const annualDiscountPercentage = monthlyTotalForYear > 0 && annualPrice > 0 && annualPrice < monthlyTotalForYear
    ? Math.round(((monthlyTotalForYear - annualPrice) / monthlyTotalForYear) * 100)
    : 0;
  const annualMonthlyEquivalent = annualPrice > 0 ? annualPrice / 12 : 0;

  const buildTrialLabel = useCallback((pkg: PurchasesPackage | null): string | null => {
    if (!trialAvailable) return null;
    const introPrice = pkg?.product?.introPrice;
    if (introPrice && introPrice.price === 0) {
      const units = introPrice.periodNumberOfUnits;
      const unit = introPrice.periodUnit;
      if (units && unit) {
        return `${units}-${String(unit).toLowerCase()} free trial`;
      }
    }
    return `${policyTrialDays}-day free trial`;
  }, [trialAvailable, policyTrialDays]);

  const annualTrialLabel = useMemo(() => buildTrialLabel(annualPackage), [annualPackage, buildTrialLabel]);
  const monthlyTrialLabel = useMemo(() => buildTrialLabel(monthlyPackage), [monthlyPackage, buildTrialLabel]);

  const annualHasFreeTrial = !!annualTrialLabel;
  const monthlyHasFreeTrial = !!monthlyTrialLabel;
  const hasFreeTrial = trialAvailable && (selectedPlan === 'annual'
    ? annualHasFreeTrial
    : monthlyHasFreeTrial);

  const trialDuration = useMemo(() => {
    const pkg = selectedPlan === 'annual' ? annualPackage : monthlyPackage;
    const intro = pkg?.product?.introPrice;
    if (intro && intro.price === 0 && intro.periodNumberOfUnits && intro.periodUnit) {
      const units = intro.periodNumberOfUnits;
      const unit = intro.periodUnit;
      return `${units} ${String(unit).toLowerCase()}${units > 1 ? 's' : ''}`;
    }
    return formatTrialDuration(policyTrialDays);
  }, [selectedPlan, annualPackage, monthlyPackage, policyTrialDays]);

  const priceDisclosureText = useMemo(() => {
    const selectedPrice = selectedPlan === 'annual' ? annualPriceString : monthlyPriceString;
    if (!selectedPrice) return null;

    const periodLabel = selectedPlan === 'annual' ? 'year' : 'month';
    if (hasFreeTrial) {
      return `Free for ${trialDuration}, then ${selectedPrice}/${periodLabel}. Cancel anytime.`;
    }
    return `Then ${selectedPrice}/${periodLabel}. Cancel anytime.`;
  }, [selectedPlan, annualPriceString, monthlyPriceString, hasFreeTrial, trialDuration]);

  const openURL = useCallback(async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  }, []);

  const selectedCatalogProduct = selectedPlan === 'annual' ? annualProduct : monthlyProduct;

  useEffect(() => {
    setPromoApplied(false);
    setPromoPercentOff(null);
    setPromoKind(null);
    setPromoError('');
  }, [selectedPlan]);

  const applyDiscountCode = useCallback(async () => {
    // Referral / friend codes temporarily disabled.
    if (!REFERRAL_FLOW_ENABLED) return;
    const code = discountCode.trim().toUpperCase();
    if (!code) {
      setPromoError('Enter a friend or influencer code');
      setPromoApplied(false);
      setPromoPercentOff(null);
      setPromoKind(null);
      return;
    }
    if (!user?.id) {
      setPromoError('Please log in to apply a code');
      return;
    }
    const planId = selectedCatalogProduct?.plan_id;
    if (!planId) {
      setPromoError(isLoading ? 'Plans are still loading — try again in a moment' : 'Select a plan first');
      return;
    }

    setApplyingPromo(true);
    setPromoError('');
    try {
      const data = await subscriptionEndpoints.validatePromo({
        code,
        user_id: user.id,
        plan_id: planId,
      });
      if (data?.valid || data?.percent_off != null) {
        setPromoApplied(true);
        setPromoPercentOff(
          typeof data.percent_off === 'number' ? data.percent_off : null,
        );
        setPromoKind(data.kind ?? null);
        setPromoError('');
        if (data.kind === 'user') {
          try {
            await referralEndpoints.apply({
              user_id: user.id,
              referral_code: code,
            });
          } catch {
            // Attribution is best-effort; validation already succeeded.
          }
        }
      } else {
        setPromoApplied(false);
        setPromoPercentOff(null);
        setPromoKind(null);
        setPromoError(formatApiDetail(data?.detail, 'Invalid code'));
      }
    } catch (error: unknown) {
      setPromoApplied(false);
      setPromoPercentOff(null);
      setPromoKind(null);
      const detail =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
          : undefined;
      setPromoError(formatApiDetail(detail, 'Could not validate code. Try again.'));
    } finally {
      setApplyingPromo(false);
    }
  }, [discountCode, user?.id, selectedCatalogProduct?.plan_id, isLoading]);

  const ctaLabel = hasFreeTrial ? `Try free for ${trialDuration}` : 'Upgrade Now';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleGoBack}
          style={[styles.backButton, isPurchasing && { opacity: 0.4 }]}
          activeOpacity={0.7}
          disabled={isPurchasing}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerBrandWrap} pointerEvents="box-none">
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
            Unlock Pro
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <AlertModal
          visible={alertModal.visible}
          title={alertModal.title}
          message={alertModal.message}
          onClose={handleAlertClose}
        />
        {loadError ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="cellphone" size={64} color={theme.colors.primary} />
            <Text style={[styles.errorTitle, { color: theme.colors.onSurface }]}>
              Mobile App Required
            </Text>
            <Text style={[styles.errorText, { color: theme.colors.onSurfaceVariant }]}>
              {loadError}
            </Text>
            <TouchableOpacity
              onPress={handleGoBack}
              style={[styles.errorButton, { backgroundColor: theme.colors.primary }]}
              activeOpacity={0.85}
            >
              <Text style={styles.errorButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>
            <View style={styles.content}>
              <Text style={[styles.heroTitle, { color: theme.colors.onSurface }]}>
                Unlock Everything with Pro
              </Text>
              <Text style={[styles.heroSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Learn anything — better, faster, no limits.
              </Text>

              <View style={styles.featuresContainer}>
                {PRO_FEATURES.map((feature) => (
                  <View key={feature.title} style={styles.featureItem}>
                    <View style={[styles.checkIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                      <MaterialCommunityIcons name="check" size={13} color={theme.colors.primary} />
                    </View>
                    <View style={styles.featureCopy}>
                      <Text style={[styles.featureTitle, { color: theme.colors.onSurface }]}>
                        {feature.title}
                      </Text>
                      <Text style={[styles.featureDetail, { color: theme.colors.onSurfaceVariant }]}>
                        {feature.detail}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.plansContainer}>
                <TouchableOpacity
                  onPress={() => setSelectedPlan('monthly')}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor:
                        selectedPlan === 'monthly' ? theme.colors.primaryContainer : theme.colors.surface,
                      borderColor:
                        selectedPlan === 'monthly' ? theme.colors.primary : theme.colors.outlineVariant,
                      borderWidth: selectedPlan === 'monthly' ? 1.5 : 1,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.planTitle, { color: theme.colors.onSurface, marginBottom: 6 }]}>Monthly</Text>
                  <Text style={[styles.planPrice, { color: theme.colors.onSurface }]}>
                    {isLoading && !monthlyPriceString
                      ? 'Loading…'
                      : `${monthlyPriceString || formatCurrency(monthlyPrice, monthlyCurrency)}/mo`}
                  </Text>
                  {monthlyTrialLabel ? (
                    <Text style={[styles.planHint, { color: theme.colors.onSurfaceVariant }]}>
                      {monthlyTrialLabel}
                    </Text>
                  ) : null}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setSelectedPlan('annual')}
                  style={[
                    styles.planCard,
                    {
                      backgroundColor:
                        selectedPlan === 'annual' ? theme.colors.primaryContainer : theme.colors.surface,
                      borderColor:
                        selectedPlan === 'annual' ? theme.colors.primary : theme.colors.outlineVariant,
                      borderWidth: selectedPlan === 'annual' ? 1.5 : 1,
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.planHeader}>
                    <Text style={[styles.planTitle, { color: theme.colors.onSurface }]}>Annual</Text>
                    {annualDiscountPercentage > 0 ? (
                      <View style={[styles.discountBadge, { backgroundColor: theme.colors.primary }]}>
                        <Text style={styles.discountText}>{annualDiscountPercentage}% off</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.planPrice, { color: theme.colors.onSurface }]}>
                    {isLoading && !annualPriceString
                      ? 'Loading…'
                      : annualMonthlyEquivalent > 0
                        ? `${formatCurrency(annualMonthlyEquivalent, annualCurrency)}/mo`
                        : `${annualPriceString || formatCurrency(annualPrice, annualCurrency)}/yr`}
                  </Text>
                  {annualMonthlyEquivalent > 0 ? (
                    <Text style={[styles.planHint, { color: theme.colors.onSurfaceVariant }]}>
                      billed yearly
                      {annualTrialLabel ? ` · ${annualTrialLabel}` : ''}
                    </Text>
                  ) : annualTrialLabel ? (
                    <Text style={[styles.planHint, { color: theme.colors.onSurfaceVariant }]}>
                      {annualTrialLabel}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              </View>

              <ShinyUpgradeButton
                label={isLoading ? 'Loading plans…' : ctaLabel}
                onPress={handlePurchase}
                disabled={isPurchasing || isLoading}
                backgroundColor={theme.colors.primary}
                loadingSlot={
                  isPurchasing ? (
                    <View style={styles.purchasingContainer}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      {pendingMessage ? (
                        <Text style={styles.pendingText}>{pendingMessage}</Text>
                      ) : null}
                    </View>
                  ) : undefined
                }
              />

              {priceDisclosureText ? (
                <Text style={[styles.priceDisclosureText, { color: theme.colors.onSurfaceVariant }]}>
                  {priceDisclosureText}
                </Text>
              ) : (
                <Text style={[styles.priceDisclosureText, { color: theme.colors.onSurfaceVariant }]}>
                  Cancel anytime · Secure checkout
                </Text>
              )}

              {/* Referral / friend codes temporarily disabled — codes not working. */}
              {REFERRAL_FLOW_ENABLED ? (
              <View style={styles.promoSection}>
                <Text style={[styles.promoLabel, { color: theme.colors.onSurfaceVariant }]}>
                  Have a friend or influencer code? First purchase only
                </Text>
                <View style={styles.promoRow}>
                  <TextInput
                    value={discountCode}
                    onChangeText={(value) => {
                      setDiscountCode(value.toUpperCase());
                      setPromoApplied(false);
                      setPromoPercentOff(null);
                      setPromoKind(null);
                      setPromoError('');
                    }}
                    placeholder="Friend or influencer code"
                    placeholderTextColor={theme.colors.onSurfaceVariant}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    style={[
                      styles.promoInput,
                      {
                        color: theme.colors.onSurface,
                        backgroundColor: theme.colors.surface,
                        borderColor: promoError
                          ? theme.colors.error
                          : promoApplied
                            ? '#059669'
                            : theme.colors.outlineVariant,
                      },
                    ]}
                  />
                  <TouchableOpacity
                    onPress={applyDiscountCode}
                    disabled={applyingPromo || !discountCode.trim()}
                    style={[
                      styles.promoApply,
                      {
                        backgroundColor: theme.colors.primary,
                        opacity: applyingPromo || !discountCode.trim() ? 0.5 : 1,
                      },
                    ]}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.promoApplyText}>{applyingPromo ? '…' : 'Apply'}</Text>
                  </TouchableOpacity>
                </View>
                {promoError ? (
                  <Text style={[styles.promoFeedback, { color: theme.colors.error }]}>{promoError}</Text>
                ) : null}
                {promoApplied && promoPercentOff != null ? (
                  <Text style={[styles.promoFeedback, { color: '#059669' }]}>
                    {promoPercentOff}% off first purchase applied
                    {promoKind === 'user' ? ` · friend gets ${promoPercentOff}% wallet credit` : ''}
                  </Text>
                ) : null}
              </View>
              ) : null}

              <View style={styles.footerLinks}>
                <TouchableOpacity onPress={() => openURL(TERMS_OF_USE_EULA_URL)} activeOpacity={0.7}>
                  <Text style={[styles.footerLink, { color: theme.colors.onSurfaceVariant }]}>
                    Terms of Use (EULA)
                  </Text>
                </TouchableOpacity>
                <View style={[styles.footerDivider, { backgroundColor: theme.colors.outline }]} />
                <TouchableOpacity onPress={() => openURL(PRIVACY_URL)} activeOpacity={0.7}>
                  <Text style={[styles.footerLink, { color: theme.colors.onSurfaceVariant }]}>
                    Privacy Policy
                  </Text>
                </TouchableOpacity>
                <View style={[styles.footerDivider, { backgroundColor: theme.colors.outline }]} />
                <TouchableOpacity onPress={handleRestorePurchases} activeOpacity={0.7}>
                  <Text style={[styles.footerLink, { color: theme.colors.onSurfaceVariant }]}>
                    Restore Purchase
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 52,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  headerBrandWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 400,
    paddingHorizontal: 32,
    gap: 16,
  },
  errorTitle: {
    fontSize: 22,
    fontFamily: Fonts.ui.bold,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  errorText: {
    fontSize: 15,
    fontFamily: Fonts.ui.regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorButton: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Fonts.ui.semiBold,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  heroTitle: {
    fontSize: 26,
    fontFamily: Fonts.ui.bold,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    fontFamily: Fonts.ui.regular,
    lineHeight: 20,
    marginBottom: 22,
  },
  featuresContainer: {
    gap: 14,
    marginBottom: 22,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  featureCopy: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 15,
    fontFamily: Fonts.ui.semiBold,
    lineHeight: 20,
  },
  featureDetail: {
    fontSize: 13,
    fontFamily: Fonts.ui.regular,
    lineHeight: 18,
  },
  plansContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  planCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 6,
  },
  planTitle: {
    fontSize: 14,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.1,
  },
  discountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.2,
  },
  planPrice: {
    fontSize: 18,
    fontFamily: Fonts.ui.bold,
    letterSpacing: -0.2,
  },
  planHint: {
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
    marginTop: 4,
    lineHeight: 16,
  },
  priceDisclosureText: {
    marginTop: 10,
    marginBottom: 18,
    paddingHorizontal: 8,
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
    textAlign: 'center',
    lineHeight: 18,
  },
  promoSection: {
    marginBottom: 22,
    gap: 8,
  },
  promoLabel: {
    fontSize: 12,
    fontFamily: Fonts.ui.medium,
  },
  promoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  promoInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    fontFamily: Fonts.ui.medium,
  },
  promoApply: {
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoApplyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Fonts.ui.semiBold,
  },
  promoFeedback: {
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
    lineHeight: 17,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  footerLink: {
    fontSize: 13,
    fontFamily: Fonts.ui.regular,
    textDecorationLine: 'underline',
  },
  footerDivider: {
    width: 1,
    height: 14,
  },
  purchasingContainer: {
    alignItems: 'center',
    gap: 6,
  },
  pendingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
    opacity: 0.9,
  },
});

export default PremiumUpgradeScreen;