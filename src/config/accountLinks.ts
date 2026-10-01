import { SITE_ORIGIN } from '@/config/brand';

const origin = SITE_ORIGIN.replace(/\/$/, '');

export const ACCOUNT_LINKS = {
  website: `${origin}/`,
  support: `${origin}/support`,
  faq: `${origin}/faq`,
  terms: `${origin}/terms-of-service`,
  privacy: `${origin}/privacy-notice`,
  deleteAccount: `${origin}/delete-account`,
  manageSubscription: `${origin}/account/subscription`,
  eula: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/',
} as const;
