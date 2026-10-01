/**
 * Same 3 families as web `src/frontend/darwinity/src/config/darwinityFonts.js`:
 *   display = Syne  (marketing / display headlines)
 *   body    = DM Sans (marketing copy)
 *   ui      = Outfit (app chrome, notes, everything else)
 *
 * Native RN cannot pick a weight from one family name, so callers use the
 * loaded face (`Outfit-SemiBold`). Expo web also registers those face names.
 */
export const FONT_DISPLAY = 'Syne' as const;
export const FONT_BODY = 'DMSans' as const;
export const FONT_UI = 'Outfit' as const;

export const Fonts = {
  display: {
    medium: 'Syne-Medium',
    semiBold: 'Syne-SemiBold',
    bold: 'Syne-Bold',
    extraBold: 'Syne-ExtraBold',
  },
  body: {
    regular: 'DMSans',
    medium: 'DMSans-Medium',
    semiBold: 'DMSans-SemiBold',
    bold: 'DMSans-Bold',
  },
  ui: {
    regular: 'Outfit',
    medium: 'Outfit-Medium',
    semiBold: 'Outfit-SemiBold',
    bold: 'Outfit-Bold',
    extraBold: 'Outfit-ExtraBold',
  },
} as const;

type UiWeight = 400 | 500 | 600 | 700 | 800;

export function outfitFamily(weight: UiWeight = 400): string {
  if (weight >= 800) return Fonts.ui.extraBold;
  if (weight >= 700) return Fonts.ui.bold;
  if (weight >= 600) return Fonts.ui.semiBold;
  if (weight >= 500) return Fonts.ui.medium;
  return Fonts.ui.regular;
}
