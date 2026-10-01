import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useAuthStore, useOnboardingDraftStore, useBillingPlanStore } from '@/store';
import type { ProfileStackParamList } from '@/types/navigation';
import { getProfileCompletion, getProfileContextFields } from '@/utils/onboardingLabels';
import { formatBytesLimit } from '@/utils/contentLimits';
import { subscriptionService } from '@/services/subscriptionService';
import { OnboardingIdentityContent } from '@/screens/auth/WelcomeIdentityScreen';
import { OnboardingDetailsContent } from '@/screens/auth/WelcomeDetailsScreen';
import ExportSuccessModal from '@/components/content/ExportSuccessModal';
import SettingsListRow from '@/components/profile/SettingsListRow';
import DeleteAccountRow from '@/components/profile/DeleteAccountRow';

import { Fonts } from '@/config/fonts';

type DetailsNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'AccountDetails'>;

function formatPlanDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const MemberDetailsScreen: React.FC = () => {
  const navigation = useNavigation<DetailsNavigationProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const user = useAuthStore((state) => state.user);
  const resetDraft = useOnboardingDraftStore((state) => state.reset);
  const setPersonalInfo = useOnboardingDraftStore((state) => state.setPersonalInfo);
  const subscriptionStatus = useBillingPlanStore((state) => state.status);
  const isPro = useBillingPlanStore((state) => state.isPro);
  const contentLimits = useBillingPlanStore((state) => state.contentLimits);
  const refreshBillingPlan = useBillingPlanStore((state) => state.refresh);
  const refreshBillingPlanIfStale = useBillingPlanStore((state) => state.refreshIfStale);

  const [preferencesVisible, setPreferencesVisible] = useState(false);
  const [preferencesStep, setPreferencesStep] = useState<'identity' | 'details'>('identity');
  const [preferencesSavedVisible, setPreferencesSavedVisible] = useState(false);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');

  const profileCompletion = useMemo(() => getProfileCompletion(user), [user]);
  const contextFields = useMemo(() => getProfileContextFields(user), [user]);

  const profileRows = useMemo(() => {
    const rows: Array<{
      icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
      label: string;
      value: string;
    }> = [];
    if (user?.name) {
      rows.push({ icon: 'account-outline', label: 'Name', value: user.name });
    }
    if (user?.email) {
      rows.push({ icon: 'email-outline', label: 'Email', value: user.email });
    }
    if (user?.country) {
      rows.push({ icon: 'map-marker-outline', label: 'Country', value: user.country });
    }
    if (user?.phoneNo) {
      rows.push({
        icon: 'phone-outline',
        label: 'Phone',
        value: [user.countryCode, user.phoneNo].filter(Boolean).join(' '),
      });
    }
    if (user?.id) {
      rows.push({ icon: 'identifier', label: 'Account ID', value: String(user.id) });
    }
    return rows;
  }, [user?.name, user?.email, user?.country, user?.countryCode, user?.phoneNo, user?.id]);

  const planDetailRows = useMemo(() => {
    const rows: Array<{
      icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
      label: string;
      value: string;
    }> = [];
    const accessLabel =
      subscriptionStatus?.has_subscription && subscriptionStatus.plan_name !== 'Free'
        ? 'Unlimited'
        : 'Free Plan';
    rows.push({ icon: 'shield-check-outline', label: 'Access', value: accessLabel });
    if (!subscriptionStatus) return rows;
    if (subscriptionStatus.plan_name) {
      rows.push({ icon: 'star-circle-outline', label: 'Plan', value: subscriptionStatus.plan_name });
    }
    if (subscriptionStatus.is_trial) {
      const trialCancelled = subscriptionStatus.cancelled === true
        || subscriptionStatus.auto_renew_enabled === false
      rows.push({
        icon: 'clock-outline',
        label: trialCancelled ? 'Access until' : 'Trial ends',
        value: formatPlanDate(subscriptionStatus.trial_end_date)
          || (trialCancelled ? 'Cancelled' : 'Active trial'),
      });
    }
    const nextBill = formatPlanDate(subscriptionStatus.next_billing_date);
    if (nextBill) {
      rows.push({ icon: 'calendar-month-outline', label: 'Next billing', value: nextBill });
    }
    if (typeof subscriptionStatus.auto_renew_enabled === 'boolean') {
      rows.push({
        icon: 'autorenew',
        label: 'Auto-renew',
        value: subscriptionStatus.auto_renew_enabled ? 'On' : 'Off',
      });
    }
    if (subscriptionStatus.payment_method) {
      rows.push({
        icon: 'wallet-outline',
        label: 'Payment',
        value: subscriptionStatus.payment_method,
      });
    }
    if (subscriptionStatus.cancelled) {
      rows.push({
        icon: 'cancel',
        label: 'Cancellation',
        value: formatPlanDate(subscriptionStatus.cancellation_effective_date) || 'Scheduled',
      });
    }
    if (!isPro) {
      rows.push({
        icon: 'upload-outline',
        label: 'Upload limit',
        value: formatBytesLimit(contentLimits.maxUploadBytes),
      });
    }
    return rows;
  }, [subscriptionStatus, isPro, contentLimits.maxUploadBytes]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      void refreshBillingPlanIfStale();
    }, [user?.id, refreshBillingPlanIfStale])
  );

  const handleOpenPreferences = useCallback(() => {
    if (!user?.email || !user?.name) {
      Alert.alert('Missing Details', 'Please make sure your profile has name and email.');
      return;
    }
    resetDraft();
    setPersonalInfo({
      email: user.email,
      name: user.name,
      phoneNo: user.phoneNo,
      countryCode: user.countryCode,
      country: user.country,
    });
    setPreferencesStep('identity');
    setPreferencesVisible(true);
  }, [user, resetDraft, setPersonalInfo]);

  const handleClosePreferences = useCallback(() => {
    setPreferencesVisible(false);
  }, []);

  const handlePreferencesSaved = useCallback(() => {
    setPreferencesVisible(false);
    setPreferencesSavedVisible(true);
  }, []);

  const handleManageBillingPlan = useCallback(() => {
    navigation.navigate('BillingPlanSettings');
  }, [navigation]);

  const handleRestorePurchases = useCallback(async () => {
    if (!user?.id || isRestoringPurchases) return;

    setIsRestoringPurchases(true);
    try {
      await subscriptionService.initialize(user.id);
      const customerInfo = await subscriptionService.restorePurchases(user.id);

      const hasActiveAccess =
        Object.keys(customerInfo.entitlements.active).length > 0 ||
        (customerInfo.activeSubscriptions ?? []).length > 0;
      if (!hasActiveAccess) {
        setSuccessModalMessage('No active subscriptions were found to restore.');
        setSuccessModalVisible(true);
        return;
      }

      await refreshBillingPlan({ force: true });
      setSuccessModalMessage('Purchases restored successfully');
      setSuccessModalVisible(true);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to restore purchases';
      if (errorMessage.includes('cancelled')) return;

      Alert.alert('Restore Failed', errorMessage, [{ text: 'OK' }]);
    } finally {
      setIsRestoringPurchases(false);
    }
  }, [user?.id, isRestoringPurchases, refreshBillingPlan]);

  const renderPreferencesStep = () => {
    if (preferencesStep === 'identity') {
      return (
        <OnboardingIdentityContent
          onContinue={() => setPreferencesStep('details')}
          onBack={handleClosePreferences}
        />
      );
    }
    return (
      <OnboardingDetailsContent
        preferencesMode
        onComplete={handlePreferencesSaved}
        onBack={() => setPreferencesStep('identity')}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!profileCompletion.isComplete && user?.id ? (
          <TouchableOpacity
            onPress={handleOpenPreferences}
            style={styles.completionRow}
            activeOpacity={0.7}
          >
            <View style={[styles.completionRing, { borderColor: theme.colors.primary }]}>
              <Text style={[styles.completionPercent, { color: theme.colors.primary }]}>
                {profileCompletion.percent}%
              </Text>
            </View>
            <View style={styles.completionCopy}>
              <Text style={[styles.completionTitle, { color: theme.colors.onSurface }]}>
                Complete your profile
              </Text>
              <Text style={[styles.completionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                {profileCompletion.filled} of {profileCompletion.total} details filled
                {profileCompletion.missing.length
                  ? ` · Missing ${profileCompletion.missing.map((item) => item.label).join(', ')}`
                  : ''}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={18} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
        ) : null}

        {profileRows.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionHeader, { color: theme.colors.onSurface }]}>
              Profile
            </Text>
            {profileRows.map((row) => (
              <SettingsListRow
                key={row.label}
                icon={row.icon}
                label={row.label}
                rightText={row.value}
                showChevron={false}
                showDivider={false}
                theme={theme}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.colors.onSurface }]}>
            Learning preferences
          </Text>
          {contextFields.length > 0 ? (
            contextFields.map((field, index) => (
              <SettingsListRow
                key={field.label}
                icon={index === 0 ? 'school-outline' : 'information-outline'}
                label={field.label}
                rightText={field.value}
                onPress={handleOpenPreferences}
                showChevron
                showDivider={false}
                theme={theme}
              />
            ))
          ) : (
            <View style={styles.emptyRow}>
              <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                No preferences saved yet.
              </Text>
            </View>
          )}
          <SettingsListRow
            icon="pencil-outline"
            label="Change preferences"
            onPress={handleOpenPreferences}
            showChevron
            showDivider={false}
            theme={theme}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.colors.onSurface }]}>
            Subscription
          </Text>
          {planDetailRows.map((row) => (
            <SettingsListRow
              key={row.label}
              icon={row.icon}
              label={row.label}
              rightText={row.label === 'Access' ? undefined : row.value}
              rightNode={
                row.label === 'Access' ? (
                  <Text style={[styles.accessValue, { color: theme.colors.onSurfaceVariant }]}>
                    {row.value}
                  </Text>
                ) : null
              }
              showChevron={false}
              showDivider={false}
              theme={theme}
            />
          ))}
          <SettingsListRow
            icon="credit-card-outline"
            label="Billing & rewards"
            onPress={handleManageBillingPlan}
            showChevron
            showDivider={false}
            theme={theme}
          />
          <SettingsListRow
            icon="refresh"
            label="Restore purchases"
            onPress={handleRestorePurchases}
            disabled={isRestoringPurchases}
            showChevron={!isRestoringPurchases}
            rightNode={
              isRestoringPurchases ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : null
            }
            showDivider={false}
            theme={theme}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionHeader, { color: theme.colors.onSurface }]}>
            Account
          </Text>
          <DeleteAccountRow theme={theme} />
        </View>
      </ScrollView>

      <Modal visible={preferencesVisible} animationType="slide" onRequestClose={handleClosePreferences}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          {renderPreferencesStep()}
        </View>
      </Modal>
      <ExportSuccessModal
        visible={preferencesSavedVisible}
        title="Preferences Saved"
        message="Preferences saved successfully"
        onClose={() => setPreferencesSavedVisible(false)}
      />
      <ExportSuccessModal
        visible={successModalVisible}
        message={successModalMessage}
        onClose={() => setSuccessModalVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
  },
  completionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 12,
    gap: 14,
  },
  completionRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionPercent: {
    fontSize: 12,
    fontFamily: Fonts.ui.semiBold,
  },
  completionCopy: {
    flex: 1,
  },
  completionTitle: {
    fontSize: 16,
    fontFamily: Fonts.ui.regular,
    marginBottom: 2,
  },
  completionSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
    lineHeight: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 15,
    fontFamily: Fonts.ui.semiBold,
    marginBottom: 4,
    marginTop: 8,
  },
  emptyRow: {
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.ui.regular,
  },
  accessValue: {
    fontSize: 14,
    fontFamily: Fonts.ui.regular,
  },
  modalContainer: {
    flex: 1,
  },
});

export default MemberDetailsScreen;
