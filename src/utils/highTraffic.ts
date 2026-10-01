const DB_UNAVAILABLE_RE = /database temporarily unavailable/i;
const AUTH_TIMEOUT_PATH_RE = /\/auth\/user\/(login|register|google|magic)/i;

let active = false;
const listeners = new Set<(value: boolean) => void>();

function emit() {
  listeners.forEach((fn) => fn(active));
}

export function subscribeHighTraffic(fn: (value: boolean) => void): () => void {
  listeners.add(fn);
  fn(active);
  return () => {
    listeners.delete(fn);
  };
}

export function reportHighTraffic(): void {
  if (active) return;
  active = true;
  emit();
}

export function clearHighTraffic(): void {
  if (!active) return;
  active = false;
  emit();
}

function extractDetail(error: unknown): string {
  const err = error as {
    response?: { data?: { detail?: unknown } };
    detail?: unknown;
  };
  const fromAxios = err?.response?.data?.detail;
  if (typeof fromAxios === 'string') return fromAxios;
  if (typeof err?.detail === 'string') return err.detail;
  return '';
}

export function isDbUnavailableError(error: unknown): boolean {
  const detail = extractDetail(error);
  return typeof detail === 'string' && DB_UNAVAILABLE_RE.test(detail);
}

export function isAuthRequestTimeout(error: unknown): boolean {
  const err = error as {
    response?: unknown;
    code?: string;
    message?: string;
    config?: { url?: string; baseURL?: string };
  };
  if (!err || err.response) return false;
  const url = `${err.config?.baseURL || ''}${err.config?.url || ''}`;
  if (!AUTH_TIMEOUT_PATH_RE.test(url)) return false;
  const code = err.code || '';
  return code === 'ECONNABORTED' || code === 'ERR_CANCELED' || /timeout/i.test(err.message || '');
}

export function noticeHighTrafficError(error: unknown): boolean {
  if (isDbUnavailableError(error) || isAuthRequestTimeout(error)) {
    reportHighTraffic();
    return true;
  }
  return false;
}

export async function probeApiReady(apiOrigin: string): Promise<boolean> {
  const origin = String(apiOrigin || '').replace(/\/$/, '');
  if (!origin) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${origin}/ready`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
