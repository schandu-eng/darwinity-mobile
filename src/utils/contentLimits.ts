
export const FREE_TIER_LIMITS = {
  maxUploadBytes: 100 * 1024 * 1024,
  maxPdfPagesDigital: 200,
  maxPdfPagesScanned: 50,
  maxVideoDurationSeconds: 2 * 60 * 60,
  maxAudioDurationSeconds: 2 * 60 * 60,
  maxPdfContentTokens: 180000,
} as const;

export type ContentLimits = {
  maxUploadBytes: number;
  maxPdfPagesDigital: number | null;
  maxPdfPagesScanned: number | null;
  maxVideoDurationSeconds: number | null;
  maxAudioDurationSeconds: number | null;
  maxPdfContentTokens: number | null;
};

export interface ApiContentLimits {
  max_upload_bytes?: number | null;
  max_pdf_pages_digital?: number | null;
  max_pdf_pages_scanned?: number | null;
  max_video_duration_seconds?: number | null;
  max_audio_duration_seconds?: number | null;
  max_pdf_content_tokens?: number | null;
}

function pickLimit<T>(apiValue: T | undefined, fallback: T): T {
  return apiValue !== undefined ? apiValue : fallback;
}

export function mergeContentLimitsFromApi(apiLimits?: ApiContentLimits | null): ContentLimits {
  if (!apiLimits) {
    return { ...FREE_TIER_LIMITS };
  }
  return {
    maxUploadBytes: pickLimit(apiLimits.max_upload_bytes, FREE_TIER_LIMITS.maxUploadBytes) ?? FREE_TIER_LIMITS.maxUploadBytes,
    maxPdfPagesDigital: pickLimit(
      apiLimits.max_pdf_pages_digital,
      FREE_TIER_LIMITS.maxPdfPagesDigital,
    ),
    maxPdfPagesScanned: pickLimit(
      apiLimits.max_pdf_pages_scanned,
      FREE_TIER_LIMITS.maxPdfPagesScanned,
    ),
    maxVideoDurationSeconds: pickLimit(
      apiLimits.max_video_duration_seconds,
      FREE_TIER_LIMITS.maxVideoDurationSeconds,
    ),
    maxAudioDurationSeconds: pickLimit(
      apiLimits.max_audio_duration_seconds,
      FREE_TIER_LIMITS.maxAudioDurationSeconds,
    ),
    maxPdfContentTokens: pickLimit(
      apiLimits.max_pdf_content_tokens,
      FREE_TIER_LIMITS.maxPdfContentTokens,
    ),
  };
}

export function formatBytesLimit(bytes: number): string {
  if (bytes >= 1024 ** 3) {
    return `${Math.round(bytes / (1024 ** 3))}GB`;
  }
  return `${Math.round(bytes / (1024 ** 2))}MB`;
}

export function freeUploadSizeExceededMessage(maxUploadBytes: number): string {
  return `File size exceeds ${formatBytesLimit(maxUploadBytes)} on the free plan. Upgrade to Pro to upload larger files.`;
}

export function checkFreeUploadFileSize(
  fileSize: number | undefined,
  isPro: boolean,
  contentLimits: ContentLimits = FREE_TIER_LIMITS,
): string | null {
  if (isPro || !fileSize) {
    return null;
  }
  if (fileSize > contentLimits.maxUploadBytes) {
    return freeUploadSizeExceededMessage(contentLimits.maxUploadBytes);
  }
  return null;
}

export function enforceFreeUploadFileSize(
  fileSize: number | undefined,
  isPro: boolean,
  contentLimits: ContentLimits,
  onUpgrade: (message: string) => void,
): boolean {
  const message = checkFreeUploadFileSize(fileSize, isPro, contentLimits);
  if (message) {
    onUpgrade(message);
    return false;
  }
  return true;
}
