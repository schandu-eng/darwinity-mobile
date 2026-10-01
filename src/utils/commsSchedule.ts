export function parseCommsDate(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function isCommsScheduleActive(
  item?: { startsAt?: string; endsAt?: string } | null,
  now: number = Date.now(),
): boolean {
  if (!item) return false;
  const start = parseCommsDate(item.startsAt);
  const end = parseCommsDate(item.endsAt);
  if (start != null && now < start) return false;
  if (end != null && now >= end) return false;
  return true;
}

export function msUntilCommsScheduleChange(
  item?: { startsAt?: string; endsAt?: string } | null,
  now: number = Date.now(),
): number | null {
  if (!item) return null;
  const start = parseCommsDate(item.startsAt);
  const end = parseCommsDate(item.endsAt);
  const waits: number[] = [];
  if (start != null && start > now) waits.push(start - now);
  if (end != null && end > now) waits.push(end - now);
  return waits.length ? Math.min(...waits) : null;
}

export const DEFAULT_SITE_BANNER = {
  enabled: false,
  text: '',
  href: '',
  ctaLabel: '',
  startsAt: '',
  endsAt: '',
};

export const DEFAULT_MAINTENANCE = {
  enabled: false,
  title: 'We are under maintenance',
  body: 'Darwinity is down for planned maintenance. Please come back later.',
  startsAt: '',
  endsAt: '',
};

type ScheduledChrome = {
  enabled?: boolean;
  text?: string;
  title?: string;
  body?: string;
  ctaLabel?: string;
  startsAt?: string;
  endsAt?: string;
};

function mergeScheduled<T extends ScheduledChrome>(fallback: T, overlay?: ScheduledChrome | null): T {
  if (overlay == null || !Object.keys(overlay).length) {
    return { ...fallback, enabled: false };
  }
  return {
    ...fallback,
    ...overlay,
    enabled: overlay.enabled === true,
    startsAt: overlay.startsAt ?? '',
    endsAt: overlay.endsAt ?? '',
  };
}

export function isBackendMaintenanceActive(
  remote?: { chrome?: { maintenance?: ScheduledChrome } } | null,
  now: number = Date.now(),
): boolean {
  const item = remote?.chrome?.maintenance;
  if (!item?.enabled) return false;
  return isCommsScheduleActive(item, now);
}

export function mergePublicChrome(remote?: {
  chrome?: { banner?: ScheduledChrome; maintenance?: ScheduledChrome };
} | null) {
  return {
    banner: mergeScheduled(DEFAULT_SITE_BANNER, remote?.chrome?.banner),
    maintenance: mergeScheduled(DEFAULT_MAINTENANCE, remote?.chrome?.maintenance),
  };
}
