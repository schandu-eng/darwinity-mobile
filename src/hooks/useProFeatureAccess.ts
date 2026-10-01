import { useBillingPlanStore } from '@/store';

/** Pro paid plans and an active free trial both unlock gated study features. */
export function useProFeatureAccess() {
  const isPro = useBillingPlanStore((s) => s.isPro);
  const isTrial = useBillingPlanStore((s) => Boolean(s.status?.is_trial));
  const isLoading = useBillingPlanStore((s) => s.isLoading);
  const status = useBillingPlanStore((s) => s.status);
  const allowed = Boolean(isPro || isTrial);
  const locked = !allowed && (Boolean(status) || !isLoading);
  return { allowed, locked, isLoading, status };
}

export const STUDY_GAMES_UPGRADE_MESSAGE =
  'Games are included with Pro. Upgrade to unlock them.';
export const STUDY_GAMES_LIMIT_TYPE = 'study_games';

export const PODCAST_UPGRADE_MESSAGE =
  'Podcasts are included with Pro. Upgrade to unlock them.';
export const PODCAST_LIMIT_TYPE = 'podcast';

export const FLASHCARDS_UPGRADE_MESSAGE =
  'Flashcards are included with Pro. Upgrade to unlock them.';
export const FLASHCARDS_LIMIT_TYPE = 'flashcards';

export const QUIZ_UPGRADE_MESSAGE =
  'You have used your 5 free quiz questions on this note. Upgrade for unlimited quizzes.';
export const QUIZ_LIMIT_TYPE = 'quiz';

export const CHAT_UPGRADE_MESSAGE =
  'AI chat is included with Pro. Upgrade to unlock it.';
export const CHAT_LIMIT_TYPE = 'chat';

export const YOUTUBE_UPGRADE_MESSAGE =
  'YouTube paste is included with Pro. Upgrade to unlock it.';
export const YOUTUBE_LIMIT_TYPE = 'youtube';

/**
 * YouTube paste Pro gate — driven by backend YOUTUBE_PRO_GATE via status.youtube_pro_gate.
 * Never uses profile/onboarding country.
 */
export function useYoutubePasteAccess() {
  const access = useProFeatureAccess();
  const geoCountry = useBillingPlanStore((s) => s.status?.billing_country ?? null);
  const gateApplies = useBillingPlanStore((s) => Boolean(s.status?.youtube_pro_gate));
  const gateMode = useBillingPlanStore((s) => s.status?.youtube_pro_gate_mode ?? null);
  const locked = Boolean(access.locked && gateApplies);
  return {
    ...access,
    geoCountry,
    gateApplies,
    gateMode,
    indiaMarket: gateApplies,
    locked,
    allowed: !locked,
  };
}
