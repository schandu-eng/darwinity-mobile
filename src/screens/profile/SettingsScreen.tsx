import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Share, Switch } from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore, useBillingPlanStore, useThemeStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import type { ProfileStackParamList } from '@/types/navigation';
import FeedbackModal from '@/components/feedback/FeedbackModal';
import ConfirmModal from '@/components/ui/ConfirmModal';
import SettingsListRow from '@/components/profile/SettingsListRow';
import ProfileCard from '@/components/profile/ProfileCard';
import { InkPanelGradient } from '@/components/brand/InkPanelGradient';
import { checkAndApplyUpdatesWithNotification } from '@/utils/updateManager';
import { referralEndpoints, type ReferralSummary } from '@/api/endpoints/referral';
import { REFERRAL_FLOW_ENABLED, referralSignupUrl } from '@/utils/referral';
import { getUpgradeCtaCopy, isTrialAvailableFromStatus, trialDaysFromStatus } from '@/utils/trialAvailability';
import { getInitials, getProfileCompletion } from '@/utils/onboardingLabels';
import { toUserFacingError } from '@/utils/userFacingError';
import { BRAND_COLORS, BRAND_NAME } from '@/config/brand';
import Constants from 'expo-constants';
import DeleteAccountRow from '@/components/profile/DeleteAccountRow';
import { clearLocalDeviceState } from '@/utils/clearLocalSession';

import { Fonts } from '@/config/fonts';
import { X } from '@/icons';
import { ICON_STROKE } from '@/config/icons';

type SettingsNavigationProp = NativeStackNavigationProp<ProfileStackParamList, 'Settings'>;

const LANGUAGE_DISPLAY_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  zh: 'Chinese',
  ja: 'Japanese',
  ar: 'Arabic',
  bn: 'Bengali',
  ta: 'Tamil',
  te: 'Telugu',
  mr: 'Marathi',
  ko: 'Korean',
  it: 'Italian',
  ru: 'Russian',
  id: 'Indonesian',
  th: 'Thai',
  vi: 'Vietnamese',
  uk: 'Ukrainian',
  pl: 'Polish',
  nl: 'Dutch',
  tr: 'Turkish',
  ro: 'Romanian',
};

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsNavigationProp>();
  const insets = useSafeAreaInsets();
  const themeMode = useAppTheme();
  const setThemeMode = useThemeStore((state) => state.setThemeMode);
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const isDark = themeMode === 'dark';
  const { logout, user } = useAuthStore();
  const [feedbackModalVisible, setFeedbackModalVisible] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const subscriptionStatus = useBillingPlanStore((state) => state.status);
  const billingReferral = useBillingPlanStore((state) => state.status?.referral);
  const isPro = useBillingPlanStore((state) => state.isPro);
  const refreshBillingPlanIfStale = useBillingPlanStore((state) => state.refreshIfStale);
  const isLoadingBillingPlan = useBillingPlanStore((state) => state.isLoading);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState(false);
  const [fetchedReferral, setFetchedReferral] = useState<ReferralSummary | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);
  // Referral codes temporarily disabled — own-code share / invite UI.
  const referral = REFERRAL_FLOW_ENABLED
    ? fetchedReferral?.code
      ? fetchedReferral
      : billingReferral?.code
        ? billingReferral
        : null
    : null;
  const referralRef = useRef<ReferralSummary | null>(null);
  const copiedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  referralRef.current = referral;

  useEffect(() => {
    return () => {
      if (copiedResetRef.current) clearTimeout(copiedResetRef.current);
    };
  }, []);

  const handleLogout = useCallback(() => {
    setLogoutConfirmVisible(true);
  }, []);

  const handleRateUs = useCallback(() => {
    setFeedbackModalVisible(true);
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    if (isCheckingUpdate) return;

    setIsCheckingUpdate(true);
    try {
      const result = await checkAndApplyUpdatesWithNotification();
      if (!result.success && result.message !== 'No updates available') {
        Alert.alert('Update Check', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to check for updates. Please try again later.');
      console.error('Update check error:', error);
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [isCheckingUpdate]);

  const handleAccountDetails = useCallback(() => {
    navigation.navigate('AccountDetails');
  }, [navigation]);

  const handleClose = useCallback(() => {
    const parent = navigation.getParent();
    if (parent?.canGoBack()) {
      parent.goBack();
      return;
    }
    navigation.goBack();
  }, [navigation]);

  const handleChangeLanguage = useCallback(() => {
    navigation.navigate('ChangeLanguage');
  }, [navigation]);

  const handleThemeToggle = useCallback(
    (value: boolean) => {
      void setThemeMode(value ? 'dark' : 'light');
    },
    [setThemeMode]
  );

  const handleInviteFriends = useCallback(async () => {
    if (!referral?.code) return;
    const link = referralSignupUrl(referral.code);
    const percent = referral.percent_off;
    const message = percent
      ? `Join me on Darwinity. Use my code ${referral.code} for ${percent}% off: ${link}`
      : `Join me on Darwinity: ${link}`;
    try {
      await Share.share({ message });
    } catch {
      /* user dismissed the sheet */
    }
  }, [referral]);

  const handleCopyReferralCode = useCallback(async () => {
    if (!referral?.code) return;
    try {
      await Clipboard.setStringAsync(referral.code);
      setCodeCopied(true);
      if (copiedResetRef.current) clearTimeout(copiedResetRef.current);
      copiedResetRef.current = setTimeout(() => setCodeCopied(false), 1600);
    } catch {
      Alert.alert('Could not copy', 'Copy the code manually and try again.');
    }
  }, [referral?.code]);

  const handleSendInvite = useCallback(async () => {
    const email = inviteEmail.trim();
    if (!email) {
      setInviteStatus({ tone: 'error', message: 'Enter a friend email to invite' });
      return;
    }
    if (isSendingInvite) return;
    setIsSendingInvite(true);
    setInviteStatus(null);
    try {
      await referralEndpoints.invite(email);
      setInviteEmail('');
      setInviteStatus({ tone: 'success', message: `Invite sent to ${email}` });
    } catch (error) {
      setInviteStatus({
        tone: 'error',
        message: toUserFacingError(error, 'Could not send the invite. Try again in a moment.'),
      });
    } finally {
      setIsSendingInvite(false);
    }
  }, [inviteEmail, isSendingInvite]);

  const handleConfirmLogout = useCallback(async () => {
    setLogoutConfirmVisible(false);
    await clearLocalDeviceState();
    await logout();
  }, [logout]);

  const handleCloseFeedback = useCallback(() => {
    setFeedbackModalVisible(false);
  }, []);

  const languageLabel = useMemo(() => {
    return LANGUAGE_DISPLAY_NAMES[user?.preferredLanguage || 'en'] || 'English';
  }, [user?.preferredLanguage]);

  const contactLine = useMemo(() => {
    if (user?.phoneNo) {
      return [user.countryCode, user.phoneNo].filter(Boolean).join(' ');
    }
    return user?.email || '';
  }, [user?.phoneNo, user?.countryCode, user?.email]);

  const appVersionLabel = useMemo(() => {
    const version = Constants.expoConfig?.version || '1.0.0';
    const build =
      Platform.OS === 'ios'
        ? Constants.expoConfig?.ios?.buildNumber
        : Constants.expoConfig?.android?.versionCode;
    return build ? `${version} (${build})` : version;
  }, []);

  const profileCompletion = useMemo(() => getProfileCompletion(user), [user]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      void refreshBillingPlanIfStale();

      // Referral codes temporarily disabled — skip own-code fetch.
      if (!REFERRAL_FLOW_ENABLED) return;

      if (
        referralRef.current?.code ||
        useBillingPlanStore.getState().status?.referral?.code
      ) {
        return;
      }

      let cancelled = false;
      void referralEndpoints
        .getSummary(user.id)
        .then((data) => {
          if (!cancelled && data?.code) {
            setFetchedReferral(data);
          }
        })
        .catch(() => {});

      return () => {
        cancelled = true;
      };
    }, [user?.id, refreshBillingPlanIfStale])
  );

  const subscriptionBadgeLabel = useMemo(() => {
    if (subscriptionStatus?.has_subscription && subscriptionStatus.plan_name !== 'Free') {
      return 'Unlimited';
    }
    return 'Free Plan';
  }, [subscriptionStatus]);

  const showUpgradeCta = Boolean(user?.id) && subscriptionStatus != null && !isPro;
  const settingsCtaCopy = getUpgradeCtaCopy({
    trialAvailable: isTrialAvailableFromStatus(subscriptionStatus, user?.country),
    trialDays: trialDaysFromStatus(subscriptionStatus, user?.country),
  });

  const handleUpgradeToUnlimited = useCallback(() => {
    navigation.navigate('Upgrade');
  }, [navigation]);

  const ctaLabel = showUpgradeCta ? settingsCtaCopy.label : null;

  const profileReferral =
    REFERRAL_FLOW_ENABLED && referral?.code
      ? {
          code: referral.code,
          percentOff: referral.percent_off,
          inviteEmail,
          onChangeInviteEmail: (value: string) => {
            setInviteEmail(value);
            if (inviteStatus) setInviteStatus(null);
          },
          onSendInvite: handleSendInvite,
          onCopyCode: handleCopyReferralCode,
          onShareInvite: handleInviteFriends,
          isSending: isSendingInvite,
          codeCopied,
          statusMessage: inviteStatus?.message ?? null,
          statusTone: inviteStatus?.tone,
        }
      : null;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? theme.colors.background : BRAND_COLORS.white }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 12) + 8, paddingBottom: 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.closeRow}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
            activeOpacity={0.7}
          >
            <X size={22} strokeWidth={ICON_STROKE} color={theme.colors.onSurface} />
          </TouchableOpacity>
        </View>

        <ProfileCard
          initial={getInitials(user?.name)}
          name={user?.name || 'User'}
          contact={contactLine}
          subscriptionBadgeLabel={subscriptionBadgeLabel}
          isLoadingBillingPlan={isLoadingBillingPlan && !subscriptionStatus}
          languageLabel={languageLabel}
          showCompletionCue={!profileCompletion.isComplete && Boolean(user?.id)}
          completionPercent={profileCompletion.percent}
          referral={profileReferral}
          onPress={handleAccountDetails}
          onChangeLanguage={handleChangeLanguage}
        />

        {ctaLabel ? (
          <TouchableOpacity
            onPress={handleUpgradeToUnlimited}
            style={styles.ctaButton}
            activeOpacity={0.85}
          >
            <InkPanelGradient glow={false} style={StyleSheet.absoluteFill} />
            <Text style={styles.ctaButtonText}>{ctaLabel}</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.group}>
          <Text style={[styles.groupHeadline, { color: theme.colors.onSurfaceVariant }]}>
            App preferences
          </Text>
          <SettingsListRow
            icon="theme-light-dark"
            label="Dark mode"
            showChevron={false}
            theme={theme}
            rightNode={
              <Switch
                value={isDark}
                onValueChange={handleThemeToggle}
                trackColor={{ false: '#D6D3D1', true: BRAND_COLORS.growth }}
                thumbColor={BRAND_COLORS.white}
                ios_backgroundColor="#D6D3D1"
                accessibilityLabel="Dark mode"
              />
            }
          />
          <SettingsListRow
            icon="credit-card-outline"
            label="BillingPlan & rewards"
            onPress={() => navigation.navigate('BillingPlanSettings')}
            showChevron={false}
            theme={theme}
          />
          <SettingsListRow
            icon="message-outline"
            label="Help & support"
            onPress={() => navigation.navigate('HelpSupport')}
            showChevron={false}
            theme={theme}
          />
          <SettingsListRow
            icon="text-box-outline"
            label="About"
            onPress={() => navigation.navigate('About')}
            showChevron={false}
            theme={theme}
          />
          <SettingsListRow
            icon="star-outline"
            label="Rate us"
            onPress={handleRateUs}
            showChevron={false}
            theme={theme}
          />
          <SettingsListRow
            icon={isCheckingUpdate ? 'loading' : 'cloud-download-outline'}
            label={isCheckingUpdate ? 'Checking for updates...' : 'Check for updates'}
            onPress={handleCheckForUpdates}
            disabled={isCheckingUpdate}
            showChevron={false}
            theme={theme}
          />
          <SettingsListRow
            icon="logout"
            label="Log out"
            onPress={handleLogout}
            showChevron={false}
            theme={theme}
          />
          <DeleteAccountRow theme={theme} />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerBrand, { color: theme.colors.onSurfaceVariant }]}>
            {BRAND_NAME}
          </Text>
          <Text style={[styles.footerMeta, { color: theme.colors.onSurfaceVariant }]}>
            Version · {appVersionLabel}
          </Text>
          <Text style={[styles.footerMeta, { color: theme.colors.onSurfaceVariant }]}>
            {Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web'}
          </Text>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={logoutConfirmVisible}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
        onConfirm={handleConfirmLogout}
        onCancel={() => setLogoutConfirmVisible(false)}
        destructive
      />
      <FeedbackModal
        visible={feedbackModalVisible}
        onClose={handleCloseFeedback}
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
    paddingHorizontal: 20,
  },
  closeRow: {
    alignItems: 'flex-end',
    marginBottom: 8,
    marginRight: -4,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 999,
    marginBottom: 12,
    overflow: 'hidden',
  },
  ctaButtonText: {
    color: '#FAF9F6',
    fontSize: 16,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.2,
    zIndex: 1,
  },
  group: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  groupHeadline: {
    fontSize: 12,
    fontFamily: Fonts.ui.medium,
    letterSpacing: 0.2,
    marginTop: 8,
    marginBottom: 2,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 8,
    gap: 4,
  },
  footerBrand: {
    fontSize: 13,
    fontFamily: Fonts.ui.medium,
  },
  footerMeta: {
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
  },
});

export default SettingsScreen;
