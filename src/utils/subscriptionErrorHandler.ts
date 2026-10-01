import { openUpgradePaywall, parseUpgradeRequiredDetail } from '@/utils/upgradePaywall';
import { navigateToUpgradePlans } from '@/navigation/navigationRef';

const SUBSCRIPTION_LIMIT_PATTERNS = [
  'upload limit',
  'podcast limit',
  'limit reached',
  'limit exceeded',
];

const SUBSCRIPTION_UPGRADE_PATTERNS = [
  'upgrade to pro',
  'upgrade required',
];

const includesAnyPattern = (text: string, patterns: string[]) =>
  patterns.some((pattern) => text.includes(pattern));

export function isUpgradeRequiredResponse(
  status: number | undefined,
  errorData: { detail?: unknown } | null | undefined,
) {
  if (status !== 403) {
    return null;
  }
  return parseUpgradeRequiredDetail(errorData?.detail);
}

export function isUpgradeRequiredMessage(message: string | undefined | null) {
  if (!message || typeof message !== 'string') {
    return null;
  }
  return parseUpgradeRequiredDetail(message)
    || (includesAnyPattern(message.toLowerCase(), SUBSCRIPTION_UPGRADE_PATTERNS)
      ? { code: 'upgrade_required' as const, message, limit_type: 'content' }
      : null);
}

export function isBillingPlanLimitError(message: string | undefined | null): boolean {
  if (!message || typeof message !== 'string') {
    return false;
  }
  if (isUpgradeRequiredMessage(message)) {
    return true;
  }
  const normalized = message.toLowerCase();
  return (
    includesAnyPattern(normalized, SUBSCRIPTION_LIMIT_PATTERNS)
    || includesAnyPattern(normalized, SUBSCRIPTION_UPGRADE_PATTERNS)
  );
}

export function showUpgradePaywall(message: string, limitType = 'content'): void {
  const opened = openUpgradePaywall(message, limitType);
  if (!opened) {
    navigateToUpgradePlans();
  }
}

export function handleBillingPlanLimitError(
  status: number | undefined,
  errorData: { detail?: unknown } | null | undefined,
): boolean {
  const upgradeDetail = isUpgradeRequiredResponse(status, errorData);
  if (upgradeDetail) {
    showUpgradePaywall(upgradeDetail.message, upgradeDetail.limit_type || 'content');
    return true;
  }

  if (status === 403 && errorData?.detail) {
    const detailText = typeof errorData.detail === 'string'
      ? errorData.detail
      : JSON.stringify(errorData.detail);
    const normalized = detailText.toLowerCase();

    if (
      includesAnyPattern(normalized, SUBSCRIPTION_LIMIT_PATTERNS)
      || includesAnyPattern(normalized, SUBSCRIPTION_UPGRADE_PATTERNS)
    ) {
      showUpgradePaywall(
        typeof errorData.detail === 'string' ? errorData.detail : 'Upload limit reached.',
        'monthly_uploads',
      );
      return true;
    }
  }

  return false;
}

export function formatApiErrorDetail(detail: unknown, fallbackMessage: string): string {
  if (!detail) {
    return fallbackMessage;
  }
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    const firstMessage = detail.find(
      (entry) => typeof entry === 'object' && entry && typeof (entry as { msg?: string }).msg === 'string',
    ) as { msg?: string } | undefined;
    return firstMessage?.msg || fallbackMessage;
  }
  if (typeof detail === 'object' && detail !== null && typeof (detail as { message?: string }).message === 'string') {
    return (detail as { message: string }).message;
  }
  return fallbackMessage;
}

export function handleApiError(
  status: number | undefined,
  errorData: { detail?: unknown } | null | undefined,
  _fallbackMessage = 'An error occurred. Please try again.',
): boolean {
  return handleBillingPlanLimitError(status, errorData);
}

export function handleJobStatusBillingPlanError(userMessage: string | undefined | null): boolean {
  const upgradeDetail = isUpgradeRequiredMessage(userMessage);
  if (upgradeDetail) {
    showUpgradePaywall(upgradeDetail.message, upgradeDetail.limit_type || 'content');
    return true;
  }

  if (!userMessage || typeof userMessage !== 'string') {
    return false;
  }

  const normalized = userMessage.toLowerCase();
  if (
    includesAnyPattern(normalized, SUBSCRIPTION_LIMIT_PATTERNS)
    || includesAnyPattern(normalized, SUBSCRIPTION_UPGRADE_PATTERNS)
  ) {
    showUpgradePaywall(userMessage, 'monthly_uploads');
    return true;
  }

  return false;
}

export type JobStatusLike = {
  status?: string;
  user_message?: string | null;
  result?: { limit_type?: string } | null;
};

export function handleUpgradeRequiredJobStatus(job: JobStatusLike | null | undefined): boolean {
  if (job?.status === 'upgrade_required') {
    showUpgradePaywall(job.user_message || 'Upgrade to Pro to continue.', job.result?.limit_type || 'content');
    return true;
  }
  if (job?.status === 'blocked' || job?.status === 'failed') {
    return handleJobStatusBillingPlanError(job.user_message);
  }
  return false;
}

export function extractAxiosErrorPayload(error: unknown): { status?: number; detail?: unknown } {
  if (!error || typeof error !== 'object') {
    return {};
  }
  const axiosError = error as { response?: { status?: number; data?: { detail?: unknown } } };
  return {
    status: axiosError.response?.status,
    detail: axiosError.response?.data?.detail,
  };
}

export function tryShowLimitPaywall(message: string | undefined | null): boolean {
  const upgradeDetail = isUpgradeRequiredMessage(message);
  if (!upgradeDetail) {
    return false;
  }
  showUpgradePaywall(upgradeDetail.message, upgradeDetail.limit_type || 'content');
  return true;
}
