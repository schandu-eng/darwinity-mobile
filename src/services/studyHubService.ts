import { learningEndpoints } from '@/api/endpoints/studyHub';
import type {
  GenerateCardDecksResponse,
  GeneratePodcastResponse,
  StudyGameItemsResponse,
} from '@/api/schemas/studyHub';

export const learningService = {
  generateCardDecks: async (
    contentId: number,
    userId: number,
    chapterIds?: number[] | null,
    regenerate?: boolean
  ): Promise<{ success: boolean; data?: GenerateCardDecksResponse; message?: string }> => {
    try {
      const data = await learningEndpoints.generateCardDecks({
        content_id: contentId,
        user_id: userId,
        chapter_ids: chapterIds || null,
        regenerate: regenerate || false,
      });
      return { success: true, data };
    } catch (error: any) {
      if (error.response?.status === 403) {
        return {
          success: false,
          message: error.response?.data?.detail || 'Unable to generate flashcards',
        };
      }
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to generate flashcards',
      };
    }
  },

  generatePodcast: async (
    contentId: number,
    userId: number,
    chapterIds?: number[] | null
  ): Promise<{ success: boolean; data?: GeneratePodcastResponse; message?: string }> => {
    try {
      const data = await learningEndpoints.generatePodcast({
        content_id: contentId,
        user_id: userId,
        chapter_ids: chapterIds || null,
      });
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to generate podcast',
      };
    }
  },

  generateStudyGameItems: async (
    contentId: number,
    userId: number,
    count = 16
  ): Promise<{ success: boolean; data?: StudyGameItemsResponse; message?: string }> => {
    try {
      const data = await learningEndpoints.generateStudyGameItems(contentId, userId, count);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to generate game questions',
      };
    }
  },
};

