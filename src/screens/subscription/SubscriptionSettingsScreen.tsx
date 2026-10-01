import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore, useBillingPlanStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import type { ProfileStackParamList } from '@/types/navigation';
import { subscriptionService } from '@/services/subscriptionService';
import type { PaymentHistoryItem } from '@/services/subscriptionService';
import BottomSheet from '@/components/ui/BottomSheet';
import { LoyaltyWalletSection } from '@/features/concentration/RewardsWalletSection';
import { getUpgradeCtaCopy, isTrialAvailableFromStatus, trialDaysFromStatus } from '@/utils/trialAvailability';

import { Fonts } from '@/config/fonts';
import { ACCOUNT_LINKS } from '@/config/accountLinks';

type BillingPlanSettingsNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'BillingPlanSettings'>;

const BillingPlanSettingsScreen: React.FC = () => {
  const navigation = useNavigation<BillingPlanSettingsNavigationProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const { user } = useAuthStore();
  const subscriptionStatus = useBillingPlanStore((state) => state.status);
  const refreshBillingPlan = useBillingPlanStore((state) => state.refresh);
  const [, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCancelling] = useState(false);
  const [isOpeningStore, setIsOpeningStore] = useState(false);
  const [isCancelSheetVisible, setIsCancelSheetVisible] = useState(false);
  const [isRestoreSheetVisible, setIsRestoreSheetVisible] = useState(false);

  const loadData = useCallback(async (showLoader = true) => {
    if (!user?.id) return;

    try {
      if (showLoader) setIsLoading(true);

      const [, history] = await Promise.all([
        refreshBillingPlan({ force: true }),
        subscriptionService.getPaymentHistory(user.id, 10),
      ]);

      setPaymentHistory(history);
    } catch (error) {
      console.error('Failed to load subscription data:', error);
      if (showLoader) {
        Alert.alert('Error', 'Failed to load subscription status. Please try again.');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id, refreshBillingPlan]);

  useFocusEffect(
    useCallback(() => {
      void loadData(false);
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadData(false);
  }, [loadData]);

  const handleGoBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleUpgrade = useCallback(() => {
    navigation.navigate('Upgrade');
  }, [navigation]);

  const handleRestorePurchases = useCallback(async () => {
    if (!user?.id || isRestoring) return;

    setIsRestoring(true);
    try {
      await subscriptionService.initialize(user.id);
      const customerInfo = await subscriptionService.restorePurchases(user.id);

      const hasActiveAccess =
        Object.keys(customerInfo.entitlements.active).length > 0 ||
        (customerInfo.activeSubscriptions ?? []).length > 0;
      if (!hasActiveAccess) {
        Alert.alert(
          'No Active BillingPlans',
          'No active subscriptions were found for this store account.',
          [{ text: 'OK' }]
        );
        return;
      }

      await refreshBillingPlan({ force: true });

      setIsRestoreSheetVisible(true);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to restore purchases';
      if (errorMessage.includes('cancelled')) return;

      Alert.alert(
        'Restore Failed',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setIsRestoring(false);
    }
  }, [user?.id, isRestoring, refreshBillingPlan]);

  const handleDismissRestoreSheet = useCallback(() => {
    setIsRestoreSheetVisible(false);
  }, []);

  const handleManageInStore = useCallback(async () => {
    if (isOpeningStore) return;

    setIsOpeningStore(true);
    try {
      await subscriptionService.openStoreBillingPlanManagement();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to open store';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsOpeningStore(false);
    }
  }, [isOpeningStore]);

  const handleManageOnWebsite = useCallback(async () => {
    try {
      await Linking.openURL(ACCOUNT_LINKS.manageSubscription);
    } catch {
      Alert.alert('Error', 'Unable to open website');
    }
  }, []);

  const cancelUiInfo = useMemo(() => {
    const paymentMethod = subscriptionStatus?.payment_method;
    const isPlayStore = paymentMethod === 'PLAY_STORE' || paymentMethod === 'play_store';
    const isAppStore = paymentMethod === 'APP_STORE' || paymentMethod === 'app_store';
    const isMobile = isPlayStore || isAppStore;

    const storeName = isPlayStore ? 'Play Store' : 'App Store';
    const instructions = isPlayStore
      ? 'Profile → Payments & subscriptions → BillingPlans → Darwinity → Cancel'
      : 'Settings → Apple ID → BillingPlans → Darwinity → Cancel BillingPlan';

    const endDate = subscriptionStatus?.end_date || subscriptionStatus?.next_billing_date;
    let formattedEndDate = 'the end of your billing period';
    if (endDate) {
      try {
        const date = new Date(endDate);
        formattedEndDate = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      } catch {
        formattedEndDate = 'the end of your billing period';
      }
    }

    const title = 'Cancel BillingPlan';
    const body = isMobile
      ? `Your subscription is managed through ${storeName}.`
      : 'Your subscription is managed through our website.';
    const pathLine = isMobile ? `${storeName} → ${instructions}` : null;
    const footer = `Your subscription will remain active until ${formattedEndDate}.`;

    return {
      isMobile,
      isPlayStore,
      storeName,
      title,
      body,
      pathLine,
      footer,
    };
  }, [subscriptionStatus]);

  const handleCancelBillingPlan = useCallback(() => {
    if (!subscriptionStatus?.has_subscription || subscriptionStatus.plan_name === 'Free') return;
    setIsCancelSheetVisible(true);
  }, [subscriptionStatus]);

  const handleDismissCancelSheet = useCallback(() => {
    setIsCancelSheetVisible(false);
  }, []);

  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return 'N/A';
    }
  }, []);

  const getTimeRemaining = useCallback((endDateString?: string) => {
    if (!endDateString) return null;

    const now = new Date().getTime();
    const endDate = new Date(endDateString).getTime();
    const diff = endDate - now;

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} remaining`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} remaining`;
    } else {
      return 'Less than an hour remaining';
    }
  }, []);

  const planDisplayName = useMemo(() => {
    if (!subscriptionStatus?.plan_name) return 'Free Plan';
    if (subscriptionStatus.plan_name === 'Free') return 'Free Plan';
    const category = subscriptionStatus.plan_category;
    if (!category) return subscriptionStatus.plan_name;
    const capitalized = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
    return `${subscriptionStatus.plan_name} (${capitalized})`;
  }, [subscriptionStatus]);

  const paymentMethodDisplay = useMemo(() => {
    if (!subscriptionStatus?.payment_method) return null;
    if (subscriptionStatus.payment_method === 'APP_STORE' || subscriptionStatus.payment_method === 'app_store') return 'App Store';
    if (subscriptionStatus.payment_method === 'PLAY_STORE' || subscriptionStatus.payment_method === 'play_store') return 'Play Store';
    if (subscriptionStatus.payment_method === 'RAZORPAY' || subscriptionStatus.payment_method === 'razorpay') return 'Razorpay';
    return subscriptionStatus.payment_method;
  }, [subscriptionStatus]);

  const isActiveBillingPlan = useMemo(() => {
    return subscriptionStatus?.has_subscription && subscriptionStatus.plan_name !== 'Free';
  }, [subscriptionStatus]);

  const hasUsedTrial = useMemo(() => {
    return !!subscriptionStatus?.trial_start_date;
  }, [subscriptionStatus?.trial_start_date]);

  const trialAvailable = isTrialAvailableFromStatus(subscriptionStatus, user?.country);
  const trialDays = trialDaysFromStatus(subscriptionStatus, user?.country);
  const showTrialCta = trialAvailable && !hasUsedTrial;
  const upgradeCtaCopy = getUpgradeCtaCopy({ trialAvailable: showTrialCta, trialDays });

  const isMobileBillingPlan = useMemo(() => {
    return subscriptionStatus?.payment_method === 'APP_STORE' ||
      subscriptionStatus?.payment_method === 'PLAY_STORE' ||
      subscriptionStatus?.payment_method === 'app_store' ||
      subscriptionStatus?.payment_method === 'play_store';
  }, [subscriptionStatus]);

  const isWebBillingPlan = useMemo(() => {
    return subscriptionStatus?.payment_method === 'RAZORPAY' ||
      subscriptionStatus?.payment_method === 'razorpay';
  }, [subscriptionStatus]);

  const isCancelled = useMemo(() => {
    if (!isActiveBillingPlan) return false;
    if (subscriptionStatus?.cancelled) return true;
    return subscriptionStatus?.auto_renew_enabled === false;
  }, [isActiveBillingPlan, subscriptionStatus?.cancelled, subscriptionStatus?.auto_renew_enabled]);

  const isPaused = useMemo(() => {
    return subscriptionStatus?.is_paused;
  }, [subscriptionStatus]);

  const hasGracePeriod = useMemo(() => {
    return !!subscriptionStatus?.grace_period_end;
  }, [subscriptionStatus]);

  const cancelledAccessUntil = useMemo(() => {
    if (!isCancelled || !isActiveBillingPlan || !subscriptionStatus) return null;
    if (subscriptionStatus.is_trial) {
      return (
        subscriptionStatus.trial_end_date
        || subscriptionStatus.cancellation_effective_date
        || subscriptionStatus.end_date
        || null
      );
    }
    return (
      subscriptionStatus.cancellation_effective_date
      || subscriptionStatus.end_date
      || subscriptionStatus.trial_end_date
      || null
    );
  }, [isCancelled, isActiveBillingPlan, subscriptionStatus]);

  const getStatusBadge = useCallback(() => {
    if (!isActiveBillingPlan) {
      return { label: 'Free', color: theme.colors.surfaceVariant, textColor: theme.colors.onSurfaceVariant };
    }
    if (isPaused) {
      return { label: 'Paused', color: '#FF9800', textColor: '#FFFFFF' };
    }
    if (hasGracePeriod) {
      return { label: 'Grace Period', color: '#FF5722', textColor: '#FFFFFF' };
    }
    if (isCancelled) {
      return { label: subscriptionStatus?.is_trial ? 'Trial Cancelled' : 'Cancelling', color: '#F44336', textColor: '#FFFFFF' };
    }
    if (subscriptionStatus?.is_trial) {
      return { label: 'Trial', color: '#9C27B0', textColor: '#FFFFFF' };
    }
    return { label: 'Active', color: '#4CAF50', textColor: '#FFFFFF' };
  }, [isActiveBillingPlan, isPaused, hasGracePeriod, isCancelled, subscriptionStatus?.is_trial, theme.colors]);

  const statusBadge = getStatusBadge();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleGoBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="close" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
          BillingPlan & rewards
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
              Loading subscription details...
            </Text>
          </View>
        ) : (
          <>
            {}
            <Surface style={[styles.subscriptionCard, { backgroundColor: theme.colors.surface }]}>
              <View style={styles.subscriptionHeader}>
                <View style={styles.planInfo}>
                  <Text style={[styles.planName, { color: theme.colors.onSurface }]}>
                    {planDisplayName}
                  </Text>
                  {paymentMethodDisplay && (
                    <View style={styles.paymentMethodRow}>
                      <Text style={[styles.paymentMethod, { color: theme.colors.onSurfaceVariant }]}>
                        via
                      </Text>
                      {(subscriptionStatus?.payment_method === 'APP_STORE' || subscriptionStatus?.payment_method === 'app_store') && (
                        <MaterialCommunityIcons name="apple" size={14} color={theme.colors.onSurfaceVariant} />
                      )}
                      {(subscriptionStatus?.payment_method === 'PLAY_STORE' || subscriptionStatus?.payment_method === 'play_store') && (
                        <MaterialCommunityIcons name="google-play" size={14} color={theme.colors.onSurfaceVariant} />
                      )}
                      <Text style={[styles.paymentMethod, { color: theme.colors.onSurfaceVariant }]}>
                        {paymentMethodDisplay}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusBadge.color }]}>
                  <Text style={[styles.statusBadgeText, { color: statusBadge.textColor }]}>
                    {statusBadge.label}
                  </Text>
                </View>
              </View>

              {}
              {subscriptionStatus?.is_trial && !isCancelled && subscriptionStatus.trial_end_date && (
                <View style={[styles.infoBanner, { backgroundColor: theme.colors.primaryContainer }]}>
                  <MaterialCommunityIcons
                    name="gift-outline"
                    size={20}
                    color={theme.colors.onPrimaryContainer}
                  />
                  <View style={styles.infoBannerText}>
                    <Text style={[styles.infoBannerTitle, { color: theme.colors.onPrimaryContainer }]}>
                      Free Trial
                    </Text>
                    <Text style={[styles.infoBannerSubtitle, { color: theme.colors.onPrimaryContainer }]}>
                      Ends on {formatDate(subscriptionStatus.trial_end_date)} • {getTimeRemaining(subscriptionStatus.trial_end_date)}
                    </Text>
                  </View>
                </View>
              )}

              {}
              {hasGracePeriod && subscriptionStatus?.grace_period_end && (
                <View style={[styles.warningBanner, { backgroundColor: '#FFF3E0' }]}>
                  <MaterialCommunityIcons
                    name="alert-circle"
                    size={20}
                    color="#E65100"
                  />
                  <View style={styles.infoBannerText}>
                    <Text style={[styles.infoBannerTitle, { color: '#E65100' }]}>
                      Payment Issue
                    </Text>
                    <Text style={[styles.infoBannerSubtitle, { color: '#E65100' }]}>
                      Please update your payment method. Grace period ends {formatDate(subscriptionStatus.grace_period_end)}
                    </Text>
                  </View>
                </View>
              )}

              {}
              {isPaused && subscriptionStatus?.pause_end_date && (
                <View style={[styles.warningBanner, { backgroundColor: '#FFF8E1' }]}>
                  <MaterialCommunityIcons
                    name="pause-circle"
                    size={20}
                    color="#F57F17"
                  />
                  <View style={styles.infoBannerText}>
                    <Text style={[styles.infoBannerTitle, { color: '#F57F17' }]}>
                      BillingPlan Paused
                    </Text>
                    <Text style={[styles.infoBannerSubtitle, { color: '#F57F17' }]}>
                      Will resume on {formatDate(subscriptionStatus.pause_end_date)}
                    </Text>
                  </View>
                </View>
              )}

              {}
              {cancelledAccessUntil && (
                <View style={[styles.warningBanner, { backgroundColor: '#FFEBEE' }]}>
                  <MaterialCommunityIcons
                    name="calendar-clock"
                    size={20}
                    color="#C62828"
                  />
                  <View style={styles.infoBannerText}>
                    <Text style={[styles.infoBannerTitle, { color: '#C62828' }]}>
                      {subscriptionStatus?.is_trial ? 'Trial Cancelled' : 'BillingPlan Ending'}
                    </Text>
                    <Text style={[styles.infoBannerSubtitle, { color: '#C62828' }]}>
                      {subscriptionStatus?.is_trial
                        ? `You won't be charged. Access until ${formatDate(cancelledAccessUntil)} • ${getTimeRemaining(cancelledAccessUntil)}`
                        : `Access until ${formatDate(cancelledAccessUntil)} • ${getTimeRemaining(cancelledAccessUntil)}`}
                    </Text>
                  </View>
                </View>
              )}

              {}
              {isActiveBillingPlan && !isCancelled && subscriptionStatus?.next_billing_date && (
                <View style={styles.billingRow}>
                  <Text style={[styles.billingLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Next billing date
                  </Text>
                  <Text style={[styles.billingValue, { color: theme.colors.onSurface }]}>
                    {formatDate(subscriptionStatus.next_billing_date)}
                  </Text>
                </View>
              )}

              {subscriptionStatus?.start_date && (
                <View style={styles.billingRow}>
                  <Text style={[styles.billingLabel, { color: theme.colors.onSurfaceVariant }]}>
                    Started on
                  </Text>
                  <Text style={[styles.billingValue, { color: theme.colors.onSurface }]}>
                    {formatDate(subscriptionStatus.start_date)}
                  </Text>
                </View>
              )}
            </Surface>

            {}
            {!isActiveBillingPlan && (
              <TouchableOpacity
                onPress={handleUpgrade}
                style={[styles.upgradeButton, { backgroundColor: theme.colors.primary }]}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name={showTrialCta ? 'gift-outline' : 'crown'} size={24} color="#FFFFFF" />
                <Text style={styles.upgradeButtonText}>{upgradeCtaCopy.label}</Text>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            )}

            {}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                ACTIONS
              </Text>

              {}
              {isWebBillingPlan && isActiveBillingPlan && (
                <TouchableOpacity
                  onPress={handleManageOnWebsite}
                  style={[styles.actionButton, { backgroundColor: theme.colors.surface }]}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="open-in-new"
                    size={24}
                    color={theme.colors.primary}
                  />
                  <Text style={[styles.actionButtonText, { color: theme.colors.onSurface }]}>
                    Manage on Website
                  </Text>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={theme.colors.onSurfaceVariant}
                  />
                </TouchableOpacity>
              )}

              {}
              {isMobileBillingPlan && isActiveBillingPlan && (
                <TouchableOpacity
                  onPress={handleManageInStore}
                  style={[styles.actionButton, { backgroundColor: theme.colors.surface }]}
                  activeOpacity={0.7}
                  disabled={isOpeningStore}
                >
                  <MaterialCommunityIcons
                    name={Platform.OS === 'ios' ? 'apple' : 'google-play'}
                    size={24}
                    color={theme.colors.primary}
                  />
                  <Text style={[styles.actionButtonText, { color: theme.colors.onSurface }]}>
                    Manage in {subscriptionService.getStoreName()}
                  </Text>
                  {isOpeningStore ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <MaterialCommunityIcons
                      name="open-in-new"
                      size={20}
                      color={theme.colors.onSurfaceVariant}
                    />
                  )}
                </TouchableOpacity>
              )}

              {}
              <TouchableOpacity
                onPress={handleRestorePurchases}
                style={[styles.actionButton, { backgroundColor: theme.colors.surface }]}
                activeOpacity={0.7}
                disabled={isRestoring}
              >
                <MaterialCommunityIcons
                  name="refresh"
                  size={24}
                  color={theme.colors.primary}
                />
                <Text style={[styles.actionButtonText, { color: theme.colors.onSurface }]}>
                  Restore Purchases
                </Text>
                {isRestoring ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={theme.colors.onSurfaceVariant}
                  />
                )}
              </TouchableOpacity>

              {}
              {isActiveBillingPlan && !isCancelled && (
                <TouchableOpacity
                  onPress={handleCancelBillingPlan}
                  style={[styles.cancelButton, { backgroundColor: theme.colors.surface }]}
                  activeOpacity={0.7}
                  disabled={isCancelling}
                >
                  <MaterialCommunityIcons
                    name="cancel"
                    size={24}
                    color={theme.colors.error}
                  />
                  <Text style={[styles.cancelButtonText, { color: theme.colors.error }]}>
                    Cancel BillingPlan
                  </Text>
                  {isCancelling && (
                    <ActivityIndicator size="small" color={theme.colors.error} />
                  )}
                </TouchableOpacity>
              )}
            </View>

            <LoyaltyWalletSection />

          </>
        )}
      </ScrollView>

      <BottomSheet visible={isCancelSheetVisible} onDismiss={handleDismissCancelSheet}>
        <View style={styles.cancelSheetContent}>
          <View style={styles.cancelSheetHeader}>
            {cancelUiInfo.isMobile ? (
              <View style={[styles.cancelSheetIconWrap, { backgroundColor: theme.colors.surfaceVariant }]}>
                <MaterialCommunityIcons
                  name={cancelUiInfo.isPlayStore ? 'google-play' : 'apple'}
                  size={22}
                  color={theme.colors.primary}
                />
              </View>
            ) : (
              <View style={[styles.cancelSheetIconWrap, { backgroundColor: theme.colors.errorContainer }]}>
                <MaterialCommunityIcons name="cancel" size={22} color={theme.colors.onErrorContainer} />
              </View>
            )}
            <View style={styles.cancelSheetHeaderText}>
              <Text style={[styles.cancelSheetTitle, { color: theme.colors.onSurface }]}>
                {cancelUiInfo.title}
              </Text>
              {cancelUiInfo.isMobile ? (
                <View style={styles.cancelSheetSubtitleRow}>
                  <Text style={[styles.cancelSheetSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    via
                  </Text>
                  <MaterialCommunityIcons
                    name={cancelUiInfo.isPlayStore ? 'google-play' : 'apple'}
                    size={14}
                    color={theme.colors.onSurfaceVariant}
                  />
                  <Text style={[styles.cancelSheetSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    {cancelUiInfo.storeName}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.cancelSheetSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                  {cancelUiInfo.footer}
                </Text>
              )}
            </View>
          </View>

          <Surface style={[styles.cancelSheetCard, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.cancelSheetBody, { color: theme.colors.onSurface }]}>
              {cancelUiInfo.body}
            </Text>
            {cancelUiInfo.pathLine && (
              <View style={[styles.cancelSheetPathBox, { borderColor: theme.colors.outlineVariant }]}>
                <MaterialCommunityIcons name="information-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.cancelSheetPathText, { color: theme.colors.onSurface }]}>
                  {cancelUiInfo.pathLine}
                </Text>
              </View>
            )}
            {!cancelUiInfo.isMobile && (
              <Text style={[styles.cancelSheetHint, { color: theme.colors.onSurfaceVariant }]}>
                If you subscribed on the website, please cancel from the website billing portal or contact support.
              </Text>
            )}
          </Surface>

          <View style={styles.cancelSheetActions}>
            {cancelUiInfo.isMobile && (
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await handleManageInStore();
                    setIsCancelSheetVisible(false);
                  } catch {
                  }
                }}
                activeOpacity={0.85}
                style={[styles.cancelSheetPrimaryButton, { backgroundColor: theme.colors.primary }]}
                disabled={isOpeningStore}
              >
                {isOpeningStore ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialCommunityIcons name="open-in-new" size={18} color="#FFFFFF" />
                )}
                <Text style={styles.cancelSheetPrimaryButtonText}>
                  Open {subscriptionService.getStoreName()}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleDismissCancelSheet}
              activeOpacity={0.85}
              style={[styles.cancelSheetSecondaryButton, { borderColor: theme.colors.outlineVariant }]}
            >
              <Text style={[styles.cancelSheetSecondaryButtonText, { color: theme.colors.onSurface }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>

      <BottomSheet visible={isRestoreSheetVisible} onDismiss={handleDismissRestoreSheet}>
        <View style={styles.restoreSheetContent}>
          <View style={styles.restoreSheetHeader}>
            <View style={[styles.restoreSheetIconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
              <MaterialCommunityIcons
                name="check-circle-outline"
                size={22}
                color={theme.colors.onPrimaryContainer}
              />
            </View>
            <View style={styles.restoreSheetHeaderText}>
              <Text style={[styles.restoreSheetTitle, { color: theme.colors.onSurface }]}>
                BillingPlan restored
              </Text>
              <Text style={[styles.restoreSheetSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                Your purchases have been restored successfully.
              </Text>
            </View>
          </View>

          <Surface style={[styles.restoreSheetCard, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text style={[styles.restoreSheetBody, { color: theme.colors.onSurface }]}>
              If your plan details don’t update immediately, pull down to refresh this screen.
            </Text>
          </Surface>

          <View style={styles.restoreSheetActions}>
            <TouchableOpacity
              onPress={handleDismissRestoreSheet}
              activeOpacity={0.85}
              style={[styles.restoreSheetPrimaryButton, { backgroundColor: theme.colors.primary }]}
            >
              <Text style={styles.restoreSheetPrimaryButtonText}>
                OK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.1,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 300,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: Fonts.ui.regular,
  },
  subscriptionCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  planInfo: {
    flex: 1,
    marginRight: 12,
  },
  planName: {
    fontSize: 22,
    fontFamily: Fonts.ui.bold,
    letterSpacing: 0.1,
    marginBottom: 4,
  },
  paymentMethod: {
    fontSize: 13,
    fontFamily: Fonts.ui.regular,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  infoBannerText: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 14,
    fontFamily: Fonts.ui.semiBold,
    marginBottom: 2,
  },
  infoBannerSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
  },
  billingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  billingLabel: {
    fontSize: 14,
    fontFamily: Fonts.ui.regular,
  },
  billingValue: {
    fontSize: 14,
    fontFamily: Fonts.ui.semiBold,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    marginBottom: 24,
    gap: 12,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: Fonts.ui.bold,
    letterSpacing: 0.3,
    flex: 1,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.ui.medium,
    letterSpacing: 0.1,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(207, 102, 121, 0.3)',
  },
  cancelButtonText: {
    flex: 1,
    fontSize: 16,
    fontFamily: Fonts.ui.medium,
    letterSpacing: 0.1,
  },
  historyCard: {
    borderRadius: 12,
    padding: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  historyItemInfo: {
    flex: 1,
  },
  historyAction: {
    fontSize: 14,
    fontFamily: Fonts.ui.medium,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
  },
  historyAmount: {
    fontSize: 14,
    fontFamily: Fonts.ui.semiBold,
  },
  historyDivider: {
    height: 1,
    marginHorizontal: 12,
  },
  historyRedirectText: {
    fontSize: 13,
    fontFamily: Fonts.ui.regular,
    lineHeight: 20,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  helpSection: {
    paddingHorizontal: 4,
  },
  helpText: {
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
    lineHeight: 18,
    textAlign: 'center',
  },
  cancelSheetContent: {
    gap: 14,
  },
  cancelSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelSheetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelSheetHeaderText: {
    flex: 1,
  },
  cancelSheetTitle: {
    fontSize: 18,
    fontFamily: Fonts.ui.bold,
    letterSpacing: 0.2,
  },
  cancelSheetSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
    lineHeight: 18,
  },
  cancelSheetSubtitleRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cancelSheetCard: {
    borderRadius: 16,
    padding: 14,
  },
  cancelSheetBody: {
    fontSize: 14,
    fontFamily: Fonts.ui.medium,
    lineHeight: 20,
  },
  cancelSheetPathBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  cancelSheetPathText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.ui.semiBold,
    lineHeight: 19,
  },
  cancelSheetHint: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
    lineHeight: 18,
  },
  cancelSheetActions: {
    gap: 10,
    marginTop: 4,
  },
  cancelSheetPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  cancelSheetPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: Fonts.ui.bold,
    letterSpacing: 0.2,
  },
  cancelSheetSecondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  cancelSheetSecondaryButtonText: {
    fontSize: 15,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.2,
  },
  restoreSheetContent: {
    gap: 14,
  },
  restoreSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  restoreSheetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restoreSheetHeaderText: {
    flex: 1,
  },
  restoreSheetTitle: {
    fontSize: 18,
    fontFamily: Fonts.ui.bold,
    letterSpacing: 0.2,
  },
  restoreSheetSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
    lineHeight: 18,
  },
  restoreSheetCard: {
    borderRadius: 16,
    padding: 14,
  },
  restoreSheetBody: {
    fontSize: 13,
    fontFamily: Fonts.ui.medium,
    lineHeight: 19,
  },
  restoreSheetActions: {
    marginTop: 4,
  },
  restoreSheetPrimaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  restoreSheetPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: Fonts.ui.bold,
    letterSpacing: 0.2,
  },
  webBillingPlanContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  webProBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    marginBottom: 32,
    gap: 8,
  },
  webProBadgeText: {
    fontSize: 24,
    fontFamily: Fonts.ui.extraBold,
    letterSpacing: 1,
  },
  webBillingPlanMessageBox: {
    alignItems: 'center',
    marginBottom: 40,
  },
  webIcon: {
    marginBottom: 16,
  },
  webBillingPlanTitle: {
    fontSize: 20,
    fontFamily: Fonts.ui.bold,
    marginBottom: 12,
    textAlign: 'center',
  },
  webBillingPlanMessage: {
    fontSize: 15,
    fontFamily: Fonts.ui.regular,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  goToWebsiteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 8,
  },
  goToWebsiteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Fonts.ui.bold,
  },
});

export default BillingPlanSettingsScreen;