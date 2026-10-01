import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { authEndpoints, type DeletionEligibility } from '@/api/endpoints/auth';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import { useAuthStore } from '@/store';
import type { ProfileStackParamList } from '@/types/navigation';
import { clearLocalDeviceState } from '@/utils/clearLocalSession';
import { toUserFacingError } from '@/utils/userFacingError';

const BLOCKED_FALLBACK =
  "Your subscription's auto-pay is still active. Please cancel your subscription before deleting your account.";

function eligibilityFromError(error: unknown): DeletionEligibility | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null;
  const detail = error.response.data?.detail;
  if (detail && typeof detail === 'object' && !Array.isArray(detail) && 'blocked' in detail) {
    return detail as DeletionEligibility;
  }
  return null;
}

export function useDeleteAccount() {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const logout = useAuthStore((state) => state.logout);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [blockedVisible, setBlockedVisible] = useState(false);
  const [blockedReason, setBlockedReason] = useState(BLOCKED_FALLBACK);
  const [warning, setWarning] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const showBlocked = useCallback((reason?: string | null) => {
    setBlockedReason(reason?.trim() || BLOCKED_FALLBACK);
    setBlockedVisible(true);
  }, []);

  const open = useCallback(async () => {
    if (isOpening || isDeleting) return;
    analytics.track(EVENTS.ACCOUNT_DELETE_STARTED);
    setIsOpening(true);
    try {
      const eligibility = await authEndpoints.getDeletionEligibility();
      if (eligibility.blocked) {
        showBlocked(eligibility.reason);
        return;
      }
      setWarning(eligibility.warning ?? null);
      setConfirmVisible(true);
    } catch (error) {
      analytics.track(EVENTS.ACCOUNT_DELETE_FAILED, { stage: 'eligibility' });
      Alert.alert(
        'Could not delete account',
        toUserFacingError(error, 'Check your connection and try again.'),
      );
    } finally {
      setIsOpening(false);
    }
  }, [isDeleting, isOpening, showBlocked]);

  const closeConfirm = useCallback(() => {
    if (isDeleting) return;
    setConfirmVisible(false);
  }, [isDeleting]);

  const closeBlocked = useCallback(() => {
    setBlockedVisible(false);
  }, []);

  const goToBilling = useCallback(() => {
    setBlockedVisible(false);
    navigation.navigate('BillingPlanSettings');
  }, [navigation]);

  const confirmDelete = useCallback(async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await authEndpoints.deleteAccount();
      analytics.track(EVENTS.ACCOUNT_DELETE_COMPLETED);
      setConfirmVisible(false);
      await clearLocalDeviceState();
      await logout();
    } catch (error) {
      const blocked = eligibilityFromError(error);
      if (blocked?.blocked) {
        setConfirmVisible(false);
        showBlocked(blocked.reason);
        return;
      }
      analytics.track(EVENTS.ACCOUNT_DELETE_FAILED, { stage: 'delete' });
      Alert.alert(
        'Could not delete account',
        toUserFacingError(error, 'Check your connection and try again.'),
      );
    } finally {
      setIsDeleting(false);
    }
  }, [isDeleting, logout, showBlocked]);

  const confirmMessage = warning
    ? `${warning} This permanently removes your notes, flashcards, quizzes, and podcasts. This cannot be undone.`
    : 'This permanently removes your notes, flashcards, quizzes, and podcasts. This cannot be undone.';

  return {
    open,
    isOpening,
    confirmVisible,
    confirmMessage,
    closeConfirm,
    confirmDelete,
    isDeleting,
    blockedVisible,
    blockedReason,
    closeBlocked,
    goToBilling,
  };
}
