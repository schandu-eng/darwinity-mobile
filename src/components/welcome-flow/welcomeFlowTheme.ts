
import { BRAND_COLORS } from '@/config/brand';

export const ONBOARDING_LIGHT = {
  paper: BRAND_COLORS.paper,
  paperDeep: BRAND_COLORS.paperDeep,
  white: BRAND_COLORS.white,
  ink: BRAND_COLORS.ink,
  inkHover: BRAND_COLORS.inkHover,
  growth: BRAND_COLORS.growth,
  growthSoft: BRAND_COLORS.growthSoft,
  mute: BRAND_COLORS.mute,
  mist: BRAND_COLORS.mist,
  border: 'rgba(26, 47, 35, 0.1)',
  borderSoft: 'rgba(26, 47, 35, 0.07)',
  surface: BRAND_COLORS.white,
  onSurface: BRAND_COLORS.ink,
  onSurfaceVariant: BRAND_COLORS.mute,
  primary: BRAND_COLORS.growth,
  dangerSoft: 'rgba(176, 0, 32, 0.1)',
  danger: '#9B2C2C',
} as const;

export const ONBOARDING_GRADIENT: [string, string, string] = [
  '#EBE7DF',
  BRAND_COLORS.paper,
  '#FAF9F6',
];
