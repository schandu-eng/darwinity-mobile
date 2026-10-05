import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@/utils/constants';
import { getAuthToken } from '@/api/client';

const STORAGE_KEY = '@darwinity_marketing_attribution';
const ATTR_KEYS = ['via', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

type AttrFields = Partial<Record<(typeof ATTR_KEYS)[number], string>> & {
  campaign_key?: string;
  landing_path?: string;
  captured_at?: string;
};

function normalizeField(value: unknown): string {
  const text = String(value || '').trim();
  return text ? text.slice(0, 128) : '';
}

function buildCampaignKey(fields: AttrFields): string {
  const slug = (value?: string) =>
    normalizeField(value)
      .toLowerCase()
      .replace(/[^a-z0-9_./-]+/g, '_')
      .replace(/^[._/-]+|[._/-]+$/g, '')
      .slice(0, 128);

  const viaKey = slug(fields.via);
  if (viaKey) return viaKey;
  const parts = [slug(fields.utm_source), slug(fields.utm_medium), slug(fields.utm_campaign)].filter(
    Boolean
  );
  return parts.length ? parts.join('/').slice(0, 128) : '';
}

function parseQueryFromUrl(url: string): URLSearchParams {
  try {
    const parsed = new URL(url);
    return parsed.searchParams;
  } catch {
    const qIndex = url.indexOf('?');
    if (qIndex < 0) return new URLSearchParams();
    return new URLSearchParams(url.slice(qIndex + 1));
  }
}

async function readStoredRaw(): Promise<AttrFields | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as AttrFields) : null;
  } catch {
    return null;
  }
}

/** Persist first-touch campaign params from a deep link / URL (does not overwrite). */
export async function persistAttributionFromUrl(url: string | null | undefined): Promise<AttrFields | null> {
  if (!url) return null;
  const existing = await readStoredRaw();
  if (existing?.campaign_key) return existing;

  const params = parseQueryFromUrl(url);
  const fields: AttrFields = {};
  for (const key of ATTR_KEYS) {
    const value = normalizeField(params.get(key));
    if (value) fields[key] = value;
  }

  const campaign_key = buildCampaignKey(fields);
  if (!campaign_key) return null;

  let landing_path = '/';
  try {
    landing_path = new URL(url).pathname || '/';
  } catch {
    landing_path = '/';
  }

  const payload: AttrFields = {
    campaign_key,
    ...fields,
    landing_path: String(landing_path).slice(0, 512),
    captured_at: new Date().toISOString(),
  };

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  return payload;
}

export async function readStoredAttribution(): Promise<AttrFields | null> {
  const stored = await readStoredRaw();
  if (!stored?.campaign_key) return null;
  return stored;
}

export async function clearStoredAttribution(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** POST first-touch attribution after auth. No-ops if nothing stored. */
export async function claimStoredAttribution(tokenOverride?: string | null): Promise<unknown | null> {
  const stored = await readStoredAttribution();
  const token = tokenOverride || (await getAuthToken());
  if (!stored || !token || !API_BASE_URL) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/auth/user/attribution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        via: stored.via || null,
        utm_source: stored.utm_source || null,
        utm_medium: stored.utm_medium || null,
        utm_campaign: stored.utm_campaign || null,
        utm_content: stored.utm_content || null,
        utm_term: stored.utm_term || null,
        landing_path: stored.landing_path || null,
        captured_at: stored.captured_at || null,
      }),
    });
    if (res.ok) {
      await clearStoredAttribution();
      return await res.json();
    }
  } catch {
    /* keep storage for retry */
  }
  return null;
}
