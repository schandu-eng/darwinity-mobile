const FLAG_CDN_BASE = 'https://flagcdn.com';
const FLAG_CDN_SIZE = '24x18';

export const flagUrlFromCountryCode = (code?: string): string => {
  if (!code) return '';
  const normalized = code.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(normalized)) return '';
  return `${FLAG_CDN_BASE}/${FLAG_CDN_SIZE}/${normalized}.png`;
};

const LANGUAGE_TO_COUNTRY: Record<string, string> = {
  en: 'US',
  hi: 'IN',
  es: 'ES',
  fr: 'FR',
  de: 'DE',
  pt: 'BR',
  zh: 'CN',
  ja: 'JP',
  ar: 'EG',
  bn: 'BD',
  ta: 'IN',
  te: 'IN',
  mr: 'IN',
  ko: 'KR',
  it: 'IT',
  ru: 'RU',
  id: 'ID',
  th: 'TH',
  vi: 'VN',
  uk: 'UA',
  pl: 'PL',
  nl: 'NL',
  tr: 'TR',
  ro: 'RO',
};

export const flagUrlForLanguageCode = (code?: string): string => {
  if (!code) return '';
  const countryCode = LANGUAGE_TO_COUNTRY[code.toLowerCase()];
  return flagUrlFromCountryCode(countryCode);
};
