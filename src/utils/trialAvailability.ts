/** Global kill switch: no new trials in any market (CTAs, splash, onboarding).
 *  Keep in sync with backend/payments/trial_policy.py TRIALS_OFFERED.
 */
export const TRIALS_OFFERED = false;
export const INDIA_TRIAL_ENABLED = false;

const INDIA_ALIASES = new Set(['india', 'in', 'ind']);
const NO_TRIAL_ALIASES = new Set([
  // South Asia
  'pakistan', 'pk',
  'sri lanka', 'srilanka', 'lk',
  'nepal', 'np',
  'bangladesh', 'bd',
  'maldives', 'mv',
  // Africa
  'nigeria', 'ng',
  'kenya', 'ke',
  'south africa', 'southafrica', 'za',
  'egypt', 'eg',
  'ghana', 'gh',
  'ethiopia', 'et',
  'uganda', 'ug',
  'tanzania, united republic of tanzania', 'tanzania', 'tz',
  'algeria', 'dz',
  'morocco', 'ma',
  'sudan', 'sd',
  'somalia', 'so',
  'zambia', 'zm',
  'mauritius', 'mu',
]);

function countryKey(country?: string | null): string {
  return String(country || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

export function isIndiaBillingCountry(country?: string | null): boolean {
  const raw = countryKey(country);
  return INDIA_ALIASES.has(raw) || raw.startsWith('india ');
}

export function isNoTrialBillingCountry(country?: string | null): boolean {
  return NO_TRIAL_ALIASES.has(countryKey(country));
}

export function isTrialOfferedForCountry(country?: string | null): boolean {
  if (!TRIALS_OFFERED) return false;
  const raw = String(country || '').trim();
  if (!raw) return INDIA_TRIAL_ENABLED;
  if (isIndiaBillingCountry(raw)) return INDIA_TRIAL_ENABLED;
  if (isNoTrialBillingCountry(raw)) return false;
  return true;
}

export function trialDaysForCountry(country?: string | null): number {
  if (!isTrialOfferedForCountry(country)) return 0;
  return 1;
}

export function formatTrialDuration(days?: number): string {
  const n = Number(days) > 0 ? Number(days) : 1;
  return n === 1 ? '1 day' : `${n} days`;
}

export function trialDaysFromStatus(
  status?: { trial_days?: number } | null,
  country?: string | null,
): number {
  if (!isTrialOfferedForCountry(country)) return 0;
  if (typeof status?.trial_days === 'number' && status.trial_days > 0) {
    return status.trial_days;
  }
  return trialDaysForCountry(country);
}

export function isTrialAvailableFromStatus(
  status?: {
    trial_available?: boolean;
    trial_start_date?: string | null;
  } | null,
  country?: string | null,
): boolean {
  if (!TRIALS_OFFERED) return false;
  const raw = String(country || '').trim();
  if (raw && !isTrialOfferedForCountry(raw)) return false;
  if (typeof status?.trial_available === 'boolean') return status.trial_available;
  if (!status) return false;
  if (!isTrialOfferedForCountry(country)) return false;
  return !status.trial_start_date;
}

export function getUpgradeCtaCopy({
  trialAvailable,
  trialDays,
}: {
  trialAvailable?: boolean;
  trialDays?: number;
} = {}): {
  mode: 'trial' | 'upgrade';
  label: string;
  shortLabel: string;
  hint: string;
} {
  const days = Number(trialDays) > 0 ? Number(trialDays) : 1;
  if (TRIALS_OFFERED && trialAvailable) {
    return {
      mode: 'trial',
      label: `Try free for ${formatTrialDuration(days)}`,
      shortLabel: 'Free trial',
      hint: 'No charge today',
    };
  }
  return {
    mode: 'upgrade',
    label: 'Go Pro now',
    shortLabel: 'Unlock Pro',
    hint: 'Unlimited notes — no free leftover',
  };
}
