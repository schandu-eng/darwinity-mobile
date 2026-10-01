import { SITE_ORIGIN } from '@/config/brand';

/** Friend / own referral codes temporarily off — UI disabled until codes work again. */
export const REFERRAL_FLOW_ENABLED = false;

export function normalizeReferralCode(code: string): string {
  return String(code || '').trim().toUpperCase();
}

export function referralSignupPath(code: string): string {
  const normalized = normalizeReferralCode(code);
  return normalized ? `/member-sign-in?ref=${encodeURIComponent(normalized)}` : '/member-sign-in';
}

export function referralSignupUrl(code: string): string {
  return `${SITE_ORIGIN}${referralSignupPath(code)}`;
}
