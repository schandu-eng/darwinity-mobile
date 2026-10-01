import { Platform, type ViewStyle } from 'react-native';
import { BRAND_COLORS } from '@/config/brand';
import { boxShadow } from '@/theme/webCompat';

/** Matches web `UserSignin.css` — keep in lockstep with `.dw-auth`. */
export const AUTH_BREAKPOINT = 960;

export const AUTH = {
  ink: '#1A2F23',
  inkDeep: '#122018',
  growth: '#3F6B4F',
  paper: '#F3F1EC',
  paperLift: '#FAF9F6',
  fg: '#09090B',
  muted: '#5C6B62',
  subtle: '#71717A',
  line: 'rgba(26, 47, 35, 0.12)',
  border: 'rgba(26, 47, 35, 0.14)',
  cta: BRAND_COLORS.ink,
  ctaHover: BRAND_COLORS.inkHover,
  ctaFg: '#FAFAFA',
  white: '#FFFFFF',
  washStart: '#EBE7DF',
  error: '#B00020',
  placeholder: 'rgba(92, 107, 98, 0.5)',
  panelFg: '#FAF9F6',
} as const;

export const AUTH_SUPPORT = 'Study tools built from what you were actually taught.';

export const AUTH_FEATURES = [
  { title: 'Notes', detail: 'Lectures, PDFs, YouTube' },
  { title: 'Flashcards', detail: 'Spaced so they stick' },
  { title: 'Quizzes', detail: 'From your real material' },
] as const;

export const AUTH_GRAIN_URI =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

export type AuthPressState = {
  pressed: boolean;
  hovered?: boolean;
};

export const webCursor: ViewStyle =
  Platform.OS === 'web' ? ({ cursor: 'pointer' } as ViewStyle) : {};

export const submitShadow = boxShadow('0 10px 24px rgba(26, 47, 35, 0.18)', {
  shadowColor: BRAND_COLORS.ink,
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.22,
  shadowRadius: 12,
  elevation: 4,
});

export const submitHoverShadow = boxShadow('0 14px 28px rgba(26, 47, 35, 0.22)', {
  shadowColor: BRAND_COLORS.ink,
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.26,
  shadowRadius: 14,
  elevation: 5,
});

export const submitPressedShadow = boxShadow('0 6px 16px rgba(26, 47, 35, 0.16)', {
  shadowColor: BRAND_COLORS.ink,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.16,
  shadowRadius: 8,
  elevation: 2,
});

export const googleShadow = boxShadow(
  '0 1px 2px rgba(18, 32, 24, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
  {
    shadowColor: BRAND_COLORS.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
);

export const googleHoverShadow = boxShadow(
  '0 8px 22px rgba(18, 32, 24, 0.1), 0 0 0 3px rgba(63, 107, 79, 0.12)',
  {
    shadowColor: BRAND_COLORS.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
);

export const panelMarkShadow = boxShadow('0 8px 20px rgba(0, 0, 0, 0.18)', {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.18,
  shadowRadius: 12,
  elevation: 4,
});

export const inputFocusShadow = boxShadow('0 0 0 3px rgba(63, 107, 79, 0.18)', {
  shadowColor: AUTH.growth,
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.22,
  shadowRadius: 4,
  elevation: 0,
});
