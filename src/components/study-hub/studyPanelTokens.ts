import { Fonts } from '@/config/fonts';
import { BRAND_COLORS } from '@/config/brand';

/** Phone-web study panel tokens (neutral paper / zinc). */
export const STUDY_PAPER = BRAND_COLORS.paper;
export const STUDY_PAPER_DARK = '#09090B';
export const STUDY_INK = '#1A2F23';
export const STUDY_GROWTH = '#3F6B4F';
export const STUDY_ZINC_500 = '#71717A';
export const STUDY_ZINC_400 = '#A1A1AA';
export const STUDY_ZINC_900 = '#18181B';
export const STUDY_BORDER = 'rgba(24, 24, 27, 0.1)';
export const STUDY_BORDER_DARK = 'rgba(255, 255, 255, 0.1)';

export const studyTitleStyle = {
  fontFamily: Fonts.ui.semiBold,
  fontSize: 30,
  letterSpacing: -0.6,
  lineHeight: 36,
};

export const studySubStyle = {
  fontFamily: Fonts.ui.regular,
  fontSize: 14,
  lineHeight: 20,
  marginTop: 8,
  maxWidth: 420,
};
