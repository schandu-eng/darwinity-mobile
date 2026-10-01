import { SITE_ORIGIN } from '@/utils/constants';

export { SITE_ORIGIN };

/** Keep in lockstep with web `src/frontend/darwinity/src/config/brand.js`. */
export const BRAND_NAME = 'Darwinity';
export const BRAND_TAGLINE = 'Stop rewriting. Start remembering.';
export const BRAND_EYEBROW = 'From lecture to recall';
export const BRAND_SUPPORT =
  'Upload a lecture, PDF, or YouTube link. Darwinity builds notes, flashcards, and quizzes from the material you were actually taught.';
export const BRAND_CTA = 'Start studying free';

export const BRAND_COLORS = {
  ink: '#1A2F23',
  inkHover: '#243D30',
  /** Deepest stop on the web sign-in brand panel gradient. */
  inkDeep: '#122018',
  growth: '#3F6B4F',
  growthSoft: 'rgba(63, 107, 79, 0.12)',
  /** Soft shell behind study panels (/home paper). Matches web `brand.paper`. */
  paper: '#F1F0EC',
  /** Notes desk — same as paper so shell is one continuous color. */
  notesPage: '#F1F0EC',
  /** Formatting toolbar — muted ink charcoal (complements paper, not jet black). */
  notesToolbar: '#3D4741',
  /** Slightly deeper paper for nested surfaces / chips. */
  paperDeep: '#E8E6E0',
  mute: '#5C6B62',
  /** Destructive / error red (delete, record, focus-away). Tailwind red-600. */
  danger: '#DC2626',
  charcoal: '#09090b',
  charcoalElevated: '#111113',
  white: '#FFFFFF',
  mist: 'rgba(26, 47, 35, 0.06)',
} as const;
