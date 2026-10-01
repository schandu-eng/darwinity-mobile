import apiClient from '../client';
import {
  ContentListResponseSchema,
  ContentDetailSchema,
  JobStatusSchema,
  PodcastUrlSchema,
  FlashcardsResponseSchema,
  type ContentListResponse,
  type ContentDetail,
  type JobStatus,
  type PodcastUrlResponse,
  type FlashcardsResponse,
} from '../schemas/content';

const safeParseDev = <T>(schema: { parse: (d: unknown) => T }, data: unknown): T => {
  return schema.parse(data);
};

export const contentEndpoints = {
  getUserContent: async (
    userId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<ContentListResponse> => {
    const response = await apiClient.get<ContentListResponse>('/api/v1/materials/user-content', {
      params: { user_id: userId, page, limit },
    });
    return safeParseDev(ContentListResponseSchema, response.data);
  },

  getContentById: async (contentId: number, userId?: number): Promise<ContentDetail> => {
    const params: Record<string, string | number | boolean> = {
      include_transcript: false,
      include_flashcards: false,
      compact: true,
    };
    if (userId != null) params.user_id = userId;
    const response = await apiClient.get<ContentDetail>(`/api/v1/materials/content/${contentId}`, {
      params,
    });
    return safeParseDev(ContentDetailSchema, response.data);
  },

  getJobStatus: async (jobId: string): Promise<JobStatus> => {
    const response = await apiClient.get<JobStatus>(`/api/v1/materials/job-status/${jobId}`);
    return safeParseDev(JobStatusSchema, response.data);
  },

  getUserJobs: async (
    userId: number,
    jobType?: string,
    contentId?: number
  ): Promise<{ jobs: JobStatus[] }> => {
    const params: Record<string, string | number> = {};
    if (jobType) params.job_type = jobType;
    if (contentId !== undefined) params.content_id = contentId;
    const response = await apiClient.get<{ jobs: JobStatus[] }>(`/api/v1/materials/user-jobs/${userId}`, {
      params,
    });
    return response.data;
  },

  updateContentTitle: async (contentId: number, title: string): Promise<{ status: string; message: string; title: string }> => {
    const response = await apiClient.patch(`/api/v1/materials/content/${contentId}/title`, { title });
    return response.data;
  },

  retryNotes: async (contentId: number, userId: number): Promise<{ job_id: string; status: string; message: string }> => {
    const response = await apiClient.post('/api/v1/materials/retry-notes', {
      content_id: contentId,
      user_id: userId,
    });
    return response.data;
  },

  deleteContent: async (contentId: number, userId: number): Promise<{ status: string; deleted_universal?: boolean }> => {
    const response = await apiClient.delete(`/api/v1/materials/content/${contentId}`, {
      params: { user_id: userId },
    });
    return response.data;
  },

  getPodcastUrl: async (contentId: number, userId?: number): Promise<PodcastUrlResponse> => {
    const params: Record<string, number> = {};
    if (userId != null) params.user_id = userId;
    const response = await apiClient.get<PodcastUrlResponse>(
      `/api/v1/materials/content/${contentId}/podcast-url`,
      { params }
    );
    return safeParseDev(PodcastUrlSchema, response.data);
  },

  getCardDecks: async (contentId: number, userId?: number): Promise<FlashcardsResponse> => {
    const params: Record<string, number> = {};
    if (userId != null) params.user_id = userId;
    const response = await apiClient.get<FlashcardsResponse>(
      `/api/v1/materials/content/${contentId}/flashcards`,
      { params }
    );
    return safeParseDev(FlashcardsResponseSchema, response.data);
  },
};
