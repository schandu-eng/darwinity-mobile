import { getAuthToken } from '@/api/client';
import { API_BASE_URL, SITE_ORIGIN } from '@/utils/constants';

/**
 * Pipeline figures store relative `/api/v1/materials/note-image?key=…` paths.
 * `<Image>` cannot send Bearer tokens, so we exchange those for a presigned S3 URL.
 * Apex/www hosts serve the app shell and 404 `/api/*` — resolve against the FastAPI root.
 */
function hostsFromOrigin(origin: string): Set<string> {
  const hosts = new Set<string>();
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (!host) return hosts;
    hosts.add(host);
    if (host.startsWith('www.')) hosts.add(host.slice(4));
    else if (host !== 'localhost' && !host.startsWith('127.')) hosts.add(`www.${host}`);
  } catch {
    /* ignore invalid origin */
  }
  return hosts;
}

const FRONTEND_API_HOSTS = hostsFromOrigin(SITE_ORIGIN);
const NOTE_IMAGE_PATH_RE = /\/(?:assistant\/)?api\/(?:v1\/materials|learning)\/note-image/i;
const CANONICAL_NOTE_IMAGE_PATH = '/api/v1/materials/note-image';
const PRESIGN_TTL_MS = 45 * 60 * 1000;
const NOTE_IMAGE_RESOLVE_MAX_INFLIGHT = 4;
let resolveInflight = 0;
const resolveWaiters: Array<() => void> = [];

function acquireNoteImageResolveSlot(): Promise<void> {
  if (resolveInflight < NOTE_IMAGE_RESOLVE_MAX_INFLIGHT) {
    resolveInflight += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    resolveWaiters.push(() => {
      resolveInflight += 1;
      resolve();
    });
  });
}

function releaseNoteImageResolveSlot(): void {
  resolveInflight = Math.max(0, resolveInflight - 1);
  const next = resolveWaiters.shift();
  if (next) next();
}

const presignCache = new Map<string, { url: string; expiresAt: number }>();

function apiRoot(): string {
  const root = (API_BASE_URL || '').replace(/\/$/, '');
  try {
    const host = new URL(root).hostname.toLowerCase();
    if (FRONTEND_API_HOSTS.has(host)) return (API_BASE_URL || '').replace(/\/$/, '');
  } catch {
    /* keep root */
  }
  return root;
}

export function isNoteImageUrl(url: string): boolean {
  return typeof url === 'string' && NOTE_IMAGE_PATH_RE.test(url);
}

export function toAbsoluteApiUrl(url: string): string {
  if (!url) return url;
  if (/^(https?:\/\/|data:|blob:|file:)/i.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  const root = apiRoot();
  return root ? `${root}${path}` : path;
}

function pathAndQueryFromNoteImageUrl(url: string): string | null {
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      if (!NOTE_IMAGE_PATH_RE.test(parsed.pathname)) return null;
      return `${CANONICAL_NOTE_IMAGE_PATH}${parsed.search}`;
    } catch {
      return null;
    }
  }
  let path = url.startsWith('/') ? url : `/${url}`;
  if (path.startsWith('/assistant/')) {
    path = path.slice('/assistant'.length);
  }
  const qIndex = path.indexOf('?');
  const pathname = qIndex >= 0 ? path.slice(0, qIndex) : path;
  const search = qIndex >= 0 ? path.slice(qIndex) : '';
  if (!NOTE_IMAGE_PATH_RE.test(pathname)) return null;
  return `${CANONICAL_NOTE_IMAGE_PATH}${search}`;
}

function normalizeNoteImageUrl(url: string): string {
  if (!isNoteImageUrl(url)) return toAbsoluteApiUrl(url);
  const pathAndQuery = pathAndQueryFromNoteImageUrl(url);
  if (!pathAndQuery) return toAbsoluteApiUrl(url);
  const root = apiRoot();
  if (root) return `${root}${pathAndQuery}`;
  try {
    if (/^https?:\/\//i.test(url) && FRONTEND_API_HOSTS.has(new URL(url).hostname.toLowerCase())) {
      const root = (API_BASE_URL || '').replace(/\/$/, '');
      return root ? `${root}${pathAndQuery}` : pathAndQuery;
    }
  } catch {
    /* relative fallback */
  }
  return pathAndQuery;
}

function cacheKeyFor(url: string): string {
  try {
    return new URL(url, 'http://local').searchParams.get('key') || url;
  } catch {
    return url;
  }
}

export async function resolveNoteImageUrl(url: string): Promise<string> {
  const absolute = normalizeNoteImageUrl(url);
  if (!isNoteImageUrl(absolute)) return absolute;

  const cacheKey = cacheKeyFor(absolute);
  const cached = presignCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  await acquireNoteImageResolveSlot();
  try {
    const token = await getAuthToken();
    const sep = absolute.includes('?') ? '&' : '?';
    const resolveUrl = `${absolute}${sep}resolve=1`;

    let res: Response;
    try {
      res = await fetch(resolveUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch {
      return absolute;
    }

    if (!res.ok) return absolute;

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as { url?: unknown };
      const signed = data?.url;
      if (!signed || typeof signed !== 'string') return absolute;
      presignCache.set(cacheKey, { url: signed, expiresAt: Date.now() + PRESIGN_TTL_MS });
      return signed;
    }

    return absolute;
  } finally {
    releaseNoteImageResolveSlot();
  }
}

/** Sync rewrite so Image never sees a relative `/api/...` path (RN-web prefixes `https://`). */
export function rewriteNoteImageUrl(url: string): string {
  return normalizeNoteImageUrl(url);
}

/** Don't paint a proxy URL — Image cannot send Bearer, so wait for the presign. */
export function syncDisplayNoteImageUrl(url: string): string | null {
  if (!url) return null;
  if (isNoteImageUrl(url)) return null;
  return toAbsoluteApiUrl(url);
}

export async function resolveMarkdownImageUri(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (isNoteImageUrl(url)) return resolveNoteImageUrl(url);
  return toAbsoluteApiUrl(url);
}
