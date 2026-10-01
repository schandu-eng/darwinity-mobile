import { uploadEndpoints } from '@/api/endpoints/upload';
import type { AudioSource } from '@/api/endpoints/upload';
import type { UploadResponse } from '@/api/schemas/upload';
import {
  extractAxiosErrorPayload,
  formatApiErrorDetail,
  handleApiError,
} from '@/utils/subscriptionErrorHandler';

type UploadResult = {
  success: boolean;
  data?: UploadResponse;
  message?: string;
  limitReached?: boolean;
};

function handleUploadError(error: unknown, fallback: string): UploadResult {
  const { status, detail } = extractAxiosErrorPayload(error);
  if (handleApiError(status, { detail })) {
    return { success: false, limitReached: true };
  }
  return {
    success: false,
    message: formatApiErrorDetail(detail, fallback),
  };
}

export const uploadService = {
  uploadPDF: async (
    file: any,
    userId: number,
    folderId?: number
  ): Promise<UploadResult> => {
    try {
      const data = await uploadEndpoints.uploadPDF(file, userId, folderId);
      return { success: true, data };
    } catch (error: unknown) {
      return handleUploadError(error, 'Failed to upload PDF');
    }
  },

  processYouTube: async (
    url: string,
    userId: number,
    folderId?: number
  ): Promise<UploadResult> => {
    try {
      const data = await uploadEndpoints.processYouTube(url, userId, folderId);
      return { success: true, data };
    } catch (error: unknown) {
      return handleUploadError(error, 'Failed to process YouTube video');
    }
  },

  uploadAudio: async (
    file: any,
    userId: number,
    source?: AudioSource,
    folderId?: number
  ): Promise<UploadResult> => {
    try {
      const data = await uploadEndpoints.uploadAudio(file, userId, source, folderId);
      return { success: true, data };
    } catch (error: unknown) {
      return handleUploadError(error, 'Failed to upload audio');
    }
  },
};
