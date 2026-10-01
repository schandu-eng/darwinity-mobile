import { Platform } from 'react-native';
import { FONT_BODY, FONT_DISPLAY, FONT_UI } from './fonts';

/**
 * Loaded faces — same 3 families / weights as web `darwinityFonts.js`.
 * Keys must stay in lockstep with `Fonts` in `./fonts`.
 */
export const BRAND_FONT_MAP = {
  Syne: require('../../assets/fonts/Syne-Medium.ttf'),
  'Syne-Medium': require('../../assets/fonts/Syne-Medium.ttf'),
  'Syne-SemiBold': require('../../assets/fonts/Syne-SemiBold.ttf'),
  'Syne-Bold': require('../../assets/fonts/Syne-Bold.ttf'),
  'Syne-ExtraBold': require('../../assets/fonts/Syne-ExtraBold.ttf'),

  DMSans: require('../../assets/fonts/DMSans-Regular.ttf'),
  'DMSans-Medium': require('../../assets/fonts/DMSans-Medium.ttf'),
  'DMSans-SemiBold': require('../../assets/fonts/DMSans-SemiBold.ttf'),
  'DMSans-Bold': require('../../assets/fonts/DMSans-Bold.ttf'),

  Outfit: require('../../assets/fonts/Outfit-Regular.ttf'),
  'Outfit-Medium': require('../../assets/fonts/Outfit-Medium.ttf'),
  'Outfit-SemiBold': require('../../assets/fonts/Outfit-SemiBold.ttf'),
  'Outfit-Bold': require('../../assets/fonts/Outfit-Bold.ttf'),
  'Outfit-ExtraBold': require('../../assets/fonts/Outfit-ExtraBold.ttf'),
};

type FontModule = string | number | { uri?: string; default?: string };

function assetUrl(mod: FontModule): string {
  if (typeof mod === 'string') return mod;
  if (typeof mod === 'object' && mod) return mod.uri || mod.default || '';
  return '';
}

const WEB_FACES: { family: string; weight: number; mod: FontModule }[] = [
  { family: FONT_DISPLAY, weight: 500, mod: BRAND_FONT_MAP['Syne-Medium'] },
  { family: FONT_DISPLAY, weight: 600, mod: BRAND_FONT_MAP['Syne-SemiBold'] },
  { family: FONT_DISPLAY, weight: 700, mod: BRAND_FONT_MAP['Syne-Bold'] },
  { family: FONT_DISPLAY, weight: 800, mod: BRAND_FONT_MAP['Syne-ExtraBold'] },

  { family: FONT_BODY, weight: 400, mod: BRAND_FONT_MAP.DMSans },
  { family: FONT_BODY, weight: 500, mod: BRAND_FONT_MAP['DMSans-Medium'] },
  { family: FONT_BODY, weight: 600, mod: BRAND_FONT_MAP['DMSans-SemiBold'] },
  { family: FONT_BODY, weight: 700, mod: BRAND_FONT_MAP['DMSans-Bold'] },

  { family: 'DM Sans', weight: 400, mod: BRAND_FONT_MAP.DMSans },
  { family: 'DM Sans', weight: 500, mod: BRAND_FONT_MAP['DMSans-Medium'] },
  { family: 'DM Sans', weight: 600, mod: BRAND_FONT_MAP['DMSans-SemiBold'] },
  { family: 'DM Sans', weight: 700, mod: BRAND_FONT_MAP['DMSans-Bold'] },

  { family: FONT_UI, weight: 400, mod: BRAND_FONT_MAP.Outfit },
  { family: FONT_UI, weight: 500, mod: BRAND_FONT_MAP['Outfit-Medium'] },
  { family: FONT_UI, weight: 600, mod: BRAND_FONT_MAP['Outfit-SemiBold'] },
  { family: FONT_UI, weight: 700, mod: BRAND_FONT_MAP['Outfit-Bold'] },
  { family: FONT_UI, weight: 800, mod: BRAND_FONT_MAP['Outfit-ExtraBold'] },
];

/** Make `font-family: Outfit; font-weight: 600` resolve like darwinity.com (Expo web). */
export function injectBrandFontCss() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('dw-brand-fonts')) return;

  const weightFaces = WEB_FACES.map(({ family, weight, mod }) => {
    const url = assetUrl(mod);
    if (!url) return '';
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url('${url}') format('truetype');}`;
  }).filter(Boolean);

  const namedFaces = Object.entries(BRAND_FONT_MAP).map(([name, mod]) => {
    const url = assetUrl(mod);
    if (!url) return '';
    return `@font-face{font-family:'${name}';font-style:normal;font-weight:400;font-display:swap;src:url('${url}') format('truetype');}`;
  }).filter(Boolean);

  const el = document.createElement('style');
  el.id = 'dw-brand-fonts';
  el.textContent = [
    ...weightFaces,
    ...namedFaces,
    `html,body{font-family:${FONT_UI},system-ui,sans-serif;font-weight:400;font-synthesis:none;letter-spacing:0;}`,
  ].join('\n');
  document.head.appendChild(el);
}
