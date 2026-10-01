export const USER_FACING_ERROR = {
  generic: 'Something went wrong. Check your connection and try again.',
  timeout: 'This is taking longer than usual. Check your connection and try again.',
  offline: "Couldn't connect. Check your internet and try again.",
  server: "We're having trouble on our side. Try again in a moment.",
} as const;

const TIMEOUT_PATTERN =
  /timeout of \d+ms exceeded|econnaborted|\btimed?\s*out\b|etimedout/i;
const OFFLINE_PATTERN =
  /network error|network request failed|failed to fetch|err_network|err_internet|err_connection|enotfound|econnrefused|offline/i;
const SERVER_PATTERN =
  /internal server error|bad gateway|service unavailable|gateway timeout|status code 5\d\d/i;
const TECHNICAL_PATTERN =
  /\b\d+ms\b|\bE[A-Z]{3,}\b|\bERR_[A-Z_]+\b|status code|axioserror|traceback|^\s*[{[]/i;

function firstString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const nested = firstString(entry);
      if (nested) return nested;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    const record = value as { detail?: unknown; msg?: unknown; message?: unknown };
    return firstString(record.detail ?? record.msg ?? record.message);
  }
  return null;
}

function extractMessage(input: unknown): string | null {
  if (input == null) return null;
  if (typeof input === 'string') return input.trim() || null;
  if (typeof input !== 'object') return null;

  const record = input as {
    response?: { data?: unknown; status?: number };
    message?: unknown;
    code?: unknown;
  };

  const fromResponse = firstString(record.response?.data);
  if (fromResponse) return fromResponse;

  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message.trim();
  }

  if (typeof record.code === 'string' && record.code.trim()) {
    return record.code.trim();
  }

  return firstString(input);
}

function looksLikeHumanCopy(text: string): boolean {
  if (text.length > 180) return false;
  if (TECHNICAL_PATTERN.test(text)) return false;
  return /[a-z]/i.test(text) && text.includes(' ');
}

/** Map API / Axios failures to copy a person can act on. Never leaks timeouts or status codes. */
export function toUserFacingError(
  input: unknown,
  fallback: string = USER_FACING_ERROR.generic,
): string {
  const raw = extractMessage(input);
  if (!raw) return fallback;

  if (TIMEOUT_PATTERN.test(raw)) return USER_FACING_ERROR.timeout;
  if (OFFLINE_PATTERN.test(raw)) return USER_FACING_ERROR.offline;
  if (SERVER_PATTERN.test(raw)) return USER_FACING_ERROR.server;
  if (looksLikeHumanCopy(raw)) return raw;
  return fallback;
}
