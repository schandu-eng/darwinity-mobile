import apiClient from '../client';
import {
  GenerateCardDecksV2RequestSchema,
  GenerateCardDecksV2ResponseSchema,
  ReelFeedPayloadSchema,
  ReelQueuePayloadSchema,
  GradePreviewsResponseSchema,
  ReviewCardDeckResponseSchema,
  StudyQueuePayloadSchema,
  parseCardDeckList,
  parseCardDeckPayload,
  type CardDeckList,
  type CardDeckPayload,
  type GenerateCardDecksV2Request,
  type GenerateCardDecksV2Response,
  type ReelFeedPayload,
  type ReelQueuePayload,
  type GradePreviewsResponse,
  type ReviewCardDeckResponse,
  type StudyQueuePayload,
} from '../schemas/cardDecksV2';

export const cardDecksV2Endpoints = {
  generateCardDecks: async (
    data: GenerateCardDecksV2Request
  ): Promise<GenerateCardDecksV2Response> => {
    const body = GenerateCardDecksV2RequestSchema.parse(data);
    const response = await apiClient.post<GenerateCardDecksV2Response>(
      '/api/v1/decks/generate-flashcards',
      body
    );
    return GenerateCardDecksV2ResponseSchema.parse(response.data);
  },

  listDecks: async (contentId: number, userId: number): Promise<CardDeckList> => {
    const response = await apiClient.get<CardDeckList>(
      `/api/v1/decks/content/${contentId}/flashcards/decks`,
      { params: { user_id: userId } }
    );
    return parseCardDeckList(response.data);
  },

  getStarred: async (contentId: number, userId: number): Promise<CardDeckPayload> => {
    const response = await apiClient.get<CardDeckPayload>(
      `/api/v1/decks/content/${contentId}/flashcards/starred`,
      { params: { user_id: userId } }
    );
    return parseCardDeckPayload(response.data);
  },

  createDeck: async (
    contentId: number,
    userId: number,
    title?: string | null
  ): Promise<CardDeckPayload> => {
    const response = await apiClient.post<CardDeckPayload>(
      `/api/v1/decks/content/${contentId}/flashcards/decks`,
      { user_id: userId, title: title || null }
    );
    return parseCardDeckPayload(response.data);
  },

  renameDeck: async (
    contentId: number,
    deckId: number,
    userId: number,
    title: string
  ): Promise<CardDeckPayload> => {
    const response = await apiClient.patch<CardDeckPayload>(
      `/api/v1/decks/content/${contentId}/flashcards/decks/${deckId}`,
      { user_id: userId, title }
    );
    return parseCardDeckPayload(response.data);
  },

  saveDeck: async (
    contentId: number,
    userId: number,
    flashcards: Array<{ front: string; back: string; hint?: string; topic_id?: number | null }>,
    deckId?: number | null
  ): Promise<CardDeckPayload> => {
    const response = await apiClient.put<CardDeckPayload>(
      `/api/v1/decks/content/${contentId}/flashcards`,
      { user_id: userId, flashcards, deck_id: deckId ?? null }
    );
    return parseCardDeckPayload(response.data);
  },

  deleteDeck: async (contentId: number, deckId: number, userId: number): Promise<{ ok: boolean }> => {
    const response = await apiClient.delete<{ ok: boolean }>(
      `/api/v1/decks/content/${contentId}/flashcards/decks/${deckId}`,
      { params: { user_id: userId } }
    );
    return response.data;
  },

  getDeck: async (
    contentId: number,
    userId: number,
    deckId?: number | null
  ): Promise<CardDeckPayload> => {
    const params: Record<string, number> = { user_id: userId };
    if (deckId != null) params.deck_id = deckId;
    const response = await apiClient.get<CardDeckPayload>(
      `/api/v1/decks/content/${contentId}/flashcards`,
      { params }
    );
    return parseCardDeckPayload(response.data);
  },

  getStudyQueue: async (
    contentId: number,
    userId: number,
    options: { chapterIds?: number[]; starredOnly?: boolean; deckId?: number | null } = {}
  ): Promise<StudyQueuePayload> => {
    const params: Record<string, string | number | boolean> = { user_id: userId };
    if (options.starredOnly) params.starred_only = true;
    if (options.chapterIds?.length) params.chapter_ids = options.chapterIds.join(',');
    if (options.deckId != null) params.deck_id = options.deckId;
    const response = await apiClient.get<StudyQueuePayload>(
      `/api/v1/decks/content/${contentId}/flashcards/study-queue`,
      { params }
    );
    return StudyQueuePayloadSchema.parse(response.data);
  },

  getGradePreviews: async (
    contentId: number,
    cardId: number,
    userId: number,
    deckId?: number | null
  ): Promise<GradePreviewsResponse> => {
    const params: Record<string, number> = { user_id: userId };
    if (deckId != null) params.deck_id = deckId;
    const response = await apiClient.get<GradePreviewsResponse>(
      `/api/v1/decks/content/${contentId}/flashcards/${cardId}/grade-previews`,
      { params }
    );
    return GradePreviewsResponseSchema.parse(response.data);
  },

  reviewCard: async (
    contentId: number,
    cardId: number,
    userId: number,
    rating: number,
    deckId?: number | null
  ): Promise<ReviewCardDeckResponse> => {
    const response = await apiClient.post<ReviewCardDeckResponse>(
      `/api/v1/decks/content/${contentId}/flashcards/${cardId}/review`,
      { user_id: userId, rating, deck_id: deckId ?? null }
    );
    return ReviewCardDeckResponseSchema.parse(response.data);
  },

  toggleStar: async (
    contentId: number,
    cardId: number,
    userId: number,
    deckId?: number | null
  ): Promise<{ is_starred: boolean }> => {
    const response = await apiClient.patch<{ is_starred: boolean }>(
      `/api/v1/decks/content/${contentId}/flashcards/${cardId}/star`,
      { user_id: userId, deck_id: deckId ?? null }
    );
    return response.data;
  },

  getReelFeed: async (userId: number): Promise<ReelFeedPayload> => {
    const response = await apiClient.get<ReelFeedPayload>('/api/v1/decks/flashcards/reel-feed', {
      params: { user_id: userId },
    });
    return ReelFeedPayloadSchema.parse(response.data);
  },

  saveReelFeed: async (
    userId: number,
    items: Array<{ deck_id: number; content_id?: number; topic_ids: number[] | null }>
  ): Promise<ReelFeedPayload> => {
    const response = await apiClient.put<ReelFeedPayload>('/api/v1/decks/flashcards/reel-feed', {
      user_id: userId,
      items,
    });
    return ReelFeedPayloadSchema.parse(response.data);
  },

  getReelQueue: async (userId: number): Promise<ReelQueuePayload> => {
    const response = await apiClient.get<ReelQueuePayload>('/api/v1/decks/flashcards/reel-queue', {
      params: { user_id: userId },
    });
    return ReelQueuePayloadSchema.parse(response.data);
  },
};
