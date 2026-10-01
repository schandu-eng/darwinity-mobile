export const UPGRADE_REQUIRED_CODE = 'upgrade_required';

export type UpgradeRequiredDetail = {
  code: typeof UPGRADE_REQUIRED_CODE;
  message: string;
  limit_type?: string;
};

type PaywallHandler = (payload: { message: string; limitType: string }) => void;

let paywallHandler: PaywallHandler | null = null;

export function registerUpgradePaywallHandler(handler: PaywallHandler | null): void {
  paywallHandler = handler;
}

export function openUpgradePaywall(message: string, limitType = 'content'): boolean {
  if (typeof paywallHandler === 'function') {
    paywallHandler({ message, limitType });
    return true;
  }
  return false;
}

export function paywallSubmessage(limitType: string): string {
  if (limitType === 'study_games') {
    return 'Pro includes study games on your notes.';
  }
  if (limitType === 'exam_prep') {
    return 'Pro includes exam prep from your notes and PYQs.';
  }
  if (limitType === 'podcast') {
    return 'Pro includes podcasts from your notes.';
  }
  if (limitType === 'youtube') {
    return 'Pro includes turning YouTube links into study notes.';
  }
  if (limitType === 'youtube_asr') {
    return 'Most YouTube videos work on Free. A few don’t include text we can use — Pro can still turn those into notes.';
  }
  if (limitType === 'quiz') {
    return 'Free includes 5 questions per note. Pro includes unlimited quizzes.';
  }
  if (limitType === 'chat') {
    return 'Pro includes AI chat on your notes.';
  }
  if (limitType === 'pdf_pages') {
    return 'Free plans allow 200-page PDFs (50 pages if scanned). Upgrade to Pro for larger documents.';
  }
  if (limitType === 'video_duration') {
    return 'Free plans allow YouTube videos up to 2 hours. Upgrade to Pro for longer videos.';
  }
  if (limitType === 'audio_duration') {
    return 'Free plans allow audio recordings up to 2 hours. Upgrade to Pro for longer recordings.';
  }
  if (limitType === 'pdf_tokens') {
    return 'This PDF has too much text for the free plan. Upgrade to Pro to process larger documents.';
  }
  if (limitType === 'monthly_uploads') {
    return 'Free uploads are exhausted. Go Pro for unlimited study notes, quizzes, and chats.';
  }
  return 'Unlock unlimited notes, larger files, podcasts, and study games.';
}

export function parseUpgradeRequiredDetail(detail: unknown): UpgradeRequiredDetail | null {
  if (!detail) {
    return null;
  }
  if (typeof detail === 'object' && !Array.isArray(detail)) {
    const payload = detail as { code?: string; message?: string; limit_type?: string };
    if (payload.code === UPGRADE_REQUIRED_CODE && payload.message) {
      return {
        code: UPGRADE_REQUIRED_CODE,
        message: payload.message,
        limit_type: payload.limit_type,
      };
    }
  }
  if (typeof detail === 'string') {
    const normalized = detail.toLowerCase();
    if (
      normalized.includes('upgrade to pro')
      || normalized.includes('go pro')
      || normalized.includes('upgrade required')
      || normalized.includes('free notes are paused')
      || normalized.includes('free uploads are exhausted')
      || normalized.includes('free uploads are paused')
    ) {
      return { code: UPGRADE_REQUIRED_CODE, message: detail, limit_type: 'content' };
    }
  }
  return null;
}
