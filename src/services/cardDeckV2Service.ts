import { cardDecksV2Endpoints } from '@/api/endpoints/cardDecksV2';
import type {
  CardDeckList,
  CardDeckPayload,
  GenerateCardDecksV2Response,
  ReelFeedPayload,
  ReelQueuePayload,
  GradePreviewsResponse,
  ReviewCardDeckResponse,
  StudyQueuePayload,
} from '@/api/schemas/cardDecksV2';

type ServiceResult<T> = { success: boolean; data?: T; message?: string };

export const cardDeckV2Service = {
  generateCardDecks: async (
    contentId: number,
    userId: number,
    options: {
      chapterIds?: number[] | null;
      regenerate?: boolean;
      append?: boolean;
      createNew?: boolean;
      deckId?: number | null;
      title?: string | null;
      cardCount?: number;
      specialInstructions?: string | null;
    } = {}
  ): Promise<ServiceResult<GenerateCardDecksV2Response>> => {
    try {
      const data = await cardDecksV2Endpoints.generateCardDecks({
        content_id: contentId,
        user_id: userId,
        chapter_ids: options.chapterIds ?? null,
        regenerate: options.regenerate ?? false,
        append: options.append ?? false,
        create_new: options.createNew ?? false,
        deck_id: options.deckId ?? null,
        title: options.title ?? null,
        card_count: options.cardCount,
        special_instructions: options.specialInstructions?.trim() || null,
      });
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to generate flashcards',
      };
    }
  },

  listDecks: async (contentId: number, userId: number): Promise<ServiceResult<CardDeckList>> => {
    try {
      const data = await cardDecksV2Endpoints.listDecks(contentId, userId);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to load flashcard sets',
      };
    }
  },

  createDeck: async (
    contentId: number,
    userId: number,
    title?: string | null
  ): Promise<ServiceResult<CardDeckPayload>> => {
    try {
      const data = await cardDecksV2Endpoints.createDeck(contentId, userId, title);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to create flashcard set',
      };
    }
  },

  renameDeck: async (
    contentId: number,
    deckId: number,
    userId: number,
    title: string
  ): Promise<ServiceResult<CardDeckPayload>> => {
    try {
      const data = await cardDecksV2Endpoints.renameDeck(contentId, deckId, userId, title);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to rename flashcard set',
      };
    }
  },

  saveDeck: async (
    contentId: number,
    userId: number,
    flashcards: Array<{ front: string; back: string; hint?: string; topic_id?: number | null }>,
    deckId?: number | null
  ): Promise<ServiceResult<CardDeckPayload>> => {
    try {
      const data = await cardDecksV2Endpoints.saveDeck(contentId, userId, flashcards, deckId);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to save flashcards',
      };
    }
  },

  getStarred: async (
    contentId: number,
    userId: number
  ): Promise<ServiceResult<CardDeckPayload>> => {
    try {
      const data = await cardDecksV2Endpoints.getStarred(contentId, userId);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to load starred flashcards',
      };
    }
  },

  deleteDeck: async (
    contentId: number,
    deckId: number,
    userId: number
  ): Promise<ServiceResult<{ ok: boolean }>> => {
    try {
      const data = await cardDecksV2Endpoints.deleteDeck(contentId, deckId, userId);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to delete flashcard set',
      };
    }
  },

  getDeck: async (
    contentId: number,
    userId: number,
    deckId?: number | null
  ): Promise<ServiceResult<CardDeckPayload>> => {
    try {
      const data = await cardDecksV2Endpoints.getDeck(contentId, userId, deckId);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to load flashcards',
      };
    }
  },

  getStudyQueue: async (
    contentId: number,
    userId: number,
    options: { chapterIds?: number[]; starredOnly?: boolean; deckId?: number | null } = {}
  ): Promise<ServiceResult<StudyQueuePayload>> => {
    try {
      const data = await cardDecksV2Endpoints.getStudyQueue(contentId, userId, options);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to load study queue',
      };
    }
  },

  getGradePreviews: async (
    contentId: number,
    cardId: number,
    userId: number,
    deckId?: number | null
  ): Promise<ServiceResult<GradePreviewsResponse>> => {
    try {
      const data = await cardDecksV2Endpoints.getGradePreviews(contentId, cardId, userId, deckId);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to load grade previews',
      };
    }
  },

  reviewCard: async (
    contentId: number,
    cardId: number,
    userId: number,
    rating: number,
    deckId?: number | null
  ): Promise<ServiceResult<ReviewCardDeckResponse>> => {
    try {
      const data = await cardDecksV2Endpoints.reviewCard(contentId, cardId, userId, rating, deckId);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to save review',
      };
    }
  },

  toggleStar: async (
    contentId: number,
    cardId: number,
    userId: number,
    deckId?: number | null
  ): Promise<ServiceResult<{ is_starred: boolean }>> => {
    try {
      const data = await cardDecksV2Endpoints.toggleStar(contentId, cardId, userId, deckId);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to toggle star',
      };
    }
  },

  getReelFeed: async (userId: number): Promise<ServiceResult<ReelFeedPayload>> => {
    try {
      const data = await cardDecksV2Endpoints.getReelFeed(userId);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to load reel feed',
      };
    }
  },

  saveReelFeed: async (
    userId: number,
    items: Array<{ deck_id: number; content_id?: number; topic_ids: number[] | null }>
  ): Promise<ServiceResult<ReelFeedPayload>> => {
    try {
      const data = await cardDecksV2Endpoints.saveReelFeed(userId, items);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to save reel feed',
      };
    }
  },

  getReelQueue: async (userId: number): Promise<ServiceResult<ReelQueuePayload>> => {
    try {
      const data = await cardDecksV2Endpoints.getReelQueue(userId);
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to load reel queue',
      };
    }
  },
};
