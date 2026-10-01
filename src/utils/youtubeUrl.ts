/** Mirrors backend VideoValidator / _extract_youtube_video_id. */

const YOUTUBE_VIDEO_ID_RE = /^[0-9A-Za-z_-]{11}$/;

export const INVALID_YOUTUBE_URL_MESSAGE =
  'Invalid YouTube URL. Please provide a valid YouTube video link.';

export const UNSUPPORTED_YOUTUBE_CLIP_MESSAGE =
  'YouTube clip links are not supported. Please use a full video link.';

function parseUrl(raw: string): URL | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withProtocol);
  } catch {
    return null;
  }
}

export function extractYouTubeVideoId(url: string): string | null {
  const parsed = parseUrl(url);
  if (!parsed) {
    const fallback = String(url || '').match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:[?&/]|$)/);
    return fallback?.[1] || null;
  }

  const host = (parsed.hostname || '').toLowerCase();
  const path = parsed.pathname || '';

  if (host.includes('youtube.com') && path.startsWith('/clip/')) {
    return null;
  }

  let candidate: string | null = null;
  if (host.includes('youtu.be')) {
    candidate = path.replace(/^\/+/, '').split('/')[0] || null;
  } else if (host.includes('youtube.com')) {
    if (
      path.startsWith('/shorts/')
      || path.startsWith('/live/')
      || path.startsWith('/embed/')
    ) {
      const parts = path.split('/');
      if (parts.length > 2) candidate = parts[2];
    }
    if (!candidate) {
      candidate = parsed.searchParams.get('v');
    }
  }

  if (candidate) {
    candidate = candidate.split('?')[0].split('&')[0];
    if (YOUTUBE_VIDEO_ID_RE.test(candidate)) return candidate;
  }

  const match = String(url || '').match(/(?:v=|\/)([0-9A-Za-z_-]{11})(?:[?&/]|$)/);
  return match?.[1] || null;
}

export function validateYouTubeUrl(url: string): { valid: boolean; message: string } {
  const trimmed = String(url || '').trim();
  if (!trimmed) {
    return { valid: false, message: INVALID_YOUTUBE_URL_MESSAGE };
  }

  const parsed = parseUrl(trimmed);
  if (parsed) {
    const host = (parsed.hostname || '').toLowerCase();
    const path = parsed.pathname || '';
    if (host.includes('youtube.com') && path.startsWith('/clip/')) {
      return { valid: false, message: UNSUPPORTED_YOUTUBE_CLIP_MESSAGE };
    }
  }

  if (!extractYouTubeVideoId(trimmed)) {
    return { valid: false, message: INVALID_YOUTUBE_URL_MESSAGE };
  }

  return { valid: true, message: '' };
}

export function isValidYouTubeUrl(url: string): boolean {
  return validateYouTubeUrl(url).valid;
}
