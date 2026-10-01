import { contentEndpoints } from '@/api/endpoints/content';
import type {
  ContentListResponse,
  ContentDetail,
  JobStatus,
  PodcastUrlResponse,
  FlashcardsResponse,
} from '@/api/schemas/content';

export const contentService = {
  getUserContent: async (
    userId: number,
    page: number = 1,
    limit: number = 10
  ): Promise<{ success: boolean; data?: ContentListResponse; message?: string }> => {
    try {
      const data = await contentEndpoints.getUserContent(userId, page, limit);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to fetch content',
      };
    }
  },

  getContentById: async (
    contentId: number,
    userId?: number
  ): Promise<{ success: boolean; data?: ContentDetail; message?: string }> => {
    try {
      const data = await contentEndpoints.getContentById(contentId, userId);
      return { success: true, data };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { success: false, message: 'Content not found' };
      }
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to fetch content',
      };
    }
  },

  getJobStatus: async (
    jobId: string
  ): Promise<{ success: boolean; data?: JobStatus; message?: string }> => {
    try {
      const data = await contentEndpoints.getJobStatus(jobId);
      return { success: true, data };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { success: false, message: 'Job not found' };
      }
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to fetch job status',
      };
    }
  },

  getUserJobs: async (
    userId: number,
    jobType?: string,
    contentId?: number
  ): Promise<{ success: boolean; data?: JobStatus[]; message?: string }> => {
    try {
      const { jobs } = await contentEndpoints.getUserJobs(userId, jobType, contentId);
      return { success: true, data: jobs };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to fetch user jobs',
      };
    }
  },

  updateContentTitle: async (
    contentId: number,
    title: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      await contentEndpoints.updateContentTitle(contentId, title);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to update title',
      };
    }
  },

  deleteContent: async (
    contentId: number,
    userId: number
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      await contentEndpoints.deleteContent(contentId, userId);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to delete content',
      };
    }
  },

  getPodcastUrl: async (
    contentId: number,
    userId?: number
  ): Promise<{ success: boolean; data?: PodcastUrlResponse; message?: string }> => {
    try {
      const data = await contentEndpoints.getPodcastUrl(contentId, userId);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to fetch podcast URL',
      };
    }
  },

  getCardDecks: async (
    contentId: number,
    userId?: number
  ): Promise<{ success: boolean; data?: FlashcardsResponse; message?: string }> => {
    try {
      const data = await contentEndpoints.getCardDecks(contentId, userId);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to fetch flashcards',
      };
    }
  },
};
