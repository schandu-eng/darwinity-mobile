import apiClient from '../client';
import { UploadResponseSchema } from '../schemas/upload';
import type { UploadResponse } from '../schemas/upload';
import axios from 'axios';

export const IN_APP_RECORDING_SOURCE = 'in_app_recording';
export type AudioSource = typeof IN_APP_RECORDING_SOURCE;

async function putFileToPresignedUrl(
  uploadUrl: string,
  fileUri: string,
  contentType: string,
  onUploadProgress?: (pct: number) => void
): Promise<void> {
  const fileResponse = await fetch(fileUri);
  const blob = await fileResponse.blob();

  await axios.put(uploadUrl, blob, {
    headers: {
      'Content-Type': contentType,
    },
    timeout: 900000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    transformRequest: [(data) => data],
    onUploadProgress: (event) => {
      if (!onUploadProgress || !event.total || event.total <= 0) return;
      const pct = Math.min(100, Math.max(0, Math.round((event.loaded / event.total) * 100)));
      onUploadProgress(pct);
    },
  });
}

async function completeDirectUpload(payload: {
  s3_key: string;
  filename: string;
  kind: 'pdf' | 'audio';
  course_id?: number | null;
  source?: string | null;
}): Promise<UploadResponse> {
  const response = await apiClient.post<UploadResponse>('/api/v1/materials/upload/complete', payload, {
    timeout: 120000,
  });
  return UploadResponseSchema.parse(response.data);
}

async function tryDirectUpload(opts: {
  kind: 'pdf' | 'audio';
  file: { uri: string; name: string; mimeType?: string; size?: number };
  folderId?: number;
  source?: AudioSource;
}): Promise<UploadResponse | null> {
  const { kind, file, folderId, source } = opts;
  if (!file?.uri || !file?.name) return null;

  const sizeBytes = typeof file.size === 'number' && file.size > 0 ? file.size : 1;

  try {
    const presign = await apiClient.post<{
      upload_url: string;
      s3_key: string;
      content_type: string;
    }>(
      '/api/v1/materials/upload/presign',
      {
        filename: file.name,
        kind,
        size_bytes: sizeBytes,
        content_type: file.mimeType,
      },
      { timeout: 30000 }
    );

    const { upload_url, s3_key, content_type } = presign.data || {};
    if (!upload_url || !s3_key || !content_type) return null;

    await putFileToPresignedUrl(upload_url, file.uri, content_type);

    return await completeDirectUpload({
      s3_key,
      filename: file.name,
      kind,
      course_id: folderId ?? null,
      source: source ?? null,
    });
  } catch (err: any) {
    const status = err?.response?.status;
    const code = err?.response?.data?.detail?.code || err?.response?.data?.code;
    if (status === 402 || status === 403 || code === 'upgrade_required') {
      throw err;
    }
    console.warn('Direct S3 upload failed; falling back to proxy multipart', err);
    return null;
  }
}

export const uploadEndpoints = {
  uploadPDF: async (file: any, userId: number, folderId?: number): Promise<UploadResponse> => {
    const direct = await tryDirectUpload({
      kind: 'pdf',
      file: {
        uri: file.uri,
        name: file.name || 'document.pdf',
        mimeType: file.mimeType || 'application/pdf',
        size: file.size,
      },
      folderId,
    });
    if (direct) return direct;

    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      name: file.name || 'document.pdf',
      type: file.mimeType || 'application/pdf',
    } as any);
    formData.append('user_id', userId.toString());
    if (folderId != null) formData.append('course_id', folderId.toString());

    const response = await apiClient.post<UploadResponse>('/api/v1/materials/process-pdf', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 900000,
    });

    return UploadResponseSchema.parse(response.data);
  },

  processYouTube: async (url: string, userId: number, folderId?: number): Promise<UploadResponse> => {
    if (folderId != null) {
      const response = await apiClient.post<UploadResponse>(`/api/v1/curriculum/${folderId}/add-content`, {
        url,
        user_id: userId,
        course_id: folderId,
        content_type: 'youtube',
      });
      return UploadResponseSchema.parse(response.data);
    }

    const response = await apiClient.post<UploadResponse>('/api/v1/materials/process-video', {
      url,
      user_id: userId,
    });

    return UploadResponseSchema.parse(response.data);
  },

  uploadAudio: async (
    file: any,
    userId: number,
    source?: AudioSource,
    folderId?: number
  ): Promise<UploadResponse> => {

    const hasSegments = Array.isArray(file?.segments) && file.segments.length > 0;
    if (!hasSegments && file?.uri && file?.name) {
      const direct = await tryDirectUpload({
        kind: 'audio',
        file: {
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType || 'audio/mp4',
          size: file.size,
        },
        folderId,
        source,
      });
      if (direct) return direct;
    }

    const formData = new FormData();
    const mimeType: string = file?.mimeType || 'audio/mp4';

    if (hasSegments) {
      file.segments.forEach((seg: any) => {
        if (!seg?.uri || !seg?.name) {
          throw new Error('Each audio segment requires uri and name');
        }
        formData.append('segments', {
          uri: seg.uri,
          name: seg.name,
          type: mimeType,
        } as any);
      });
    } else {
      if (!file?.uri || !file?.name || !file?.mimeType) {
        throw new Error('Audio upload requires uri, name, and mimeType');
      }
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
      } as any);
    }
    formData.append('user_id', userId.toString());
    if (source) formData.append('source', source);
    if (folderId != null) formData.append('course_id', folderId.toString());

    const response = await apiClient.post<UploadResponse>('/api/v1/materials/process-audio-recording', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 900000,
    });
    return UploadResponseSchema.parse(response.data);
  },
};
