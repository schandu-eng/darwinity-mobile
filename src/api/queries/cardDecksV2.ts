import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cardDeckV2Service } from '@/services/cardDeckV2Service';
import { useJobStatus } from './content';

const DECK_QUERY_KEY = 'card-deck-deck-v2';
const DECKS_LIST_QUERY_KEY = 'card-deck-decks-v2';
const REEL_FEED_QUERY_KEY = 'card-deck-reel-feed';
const REEL_QUEUE_QUERY_KEY = 'card-deck-reel-queue';

export const useCardDeckV2 = (
  contentId: number | null,
  userId: number | null,
  deckId?: number | null
) => {
  return useQuery({
    queryKey: [DECK_QUERY_KEY, contentId, userId, deckId ?? null],
    queryFn: async () => {
      if (!contentId || !userId) return null;
      const result = await cardDeckV2Service.getDeck(contentId, userId, deckId);
      if (!result.success) throw new Error(result.message || 'Failed to load flashcards');
      return result.data!;
    },
    enabled: Boolean(contentId && userId && deckId != null),
  });
};

export const useCardDecksListV2 = (contentId: number | null, userId: number | null) => {
  return useQuery({
    queryKey: [DECKS_LIST_QUERY_KEY, contentId, userId],
    queryFn: async () => {
      if (!contentId || !userId) return null;
      const result = await cardDeckV2Service.listDecks(contentId, userId);
      if (!result.success) throw new Error(result.message || 'Failed to load flashcard sets');
      return result.data!;
    },
    enabled: Boolean(contentId && userId),
  });
};

export const useGenerateCardDecksV2 = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      contentId,
      userId,
      chapterIds,
      regenerate,
      append,
      createNew,
      deckId,
      title,
      cardCount,
      specialInstructions,
    }: {
      contentId: number;
      userId: number;
      chapterIds?: number[] | null;
      regenerate?: boolean;
      append?: boolean;
      createNew?: boolean;
      deckId?: number | null;
      title?: string | null;
      cardCount?: number;
      specialInstructions?: string | null;
    }) =>
      cardDeckV2Service.generateCardDecks(contentId, userId, {
        chapterIds,
        regenerate,
        append,
        createNew,
        deckId,
        title,
        cardCount,
        specialInstructions,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [DECK_QUERY_KEY, variables.contentId, variables.userId],
      });
      queryClient.invalidateQueries({
        queryKey: [DECKS_LIST_QUERY_KEY, variables.contentId, variables.userId],
      });
    },
  });
};

export const useCardDeckV2JobStatus = (jobId: string | null) => {
  return useJobStatus(jobId, { refetchInterval: 5000 });
};

export const invalidateCardDeckV2 = (
  queryClient: ReturnType<typeof useQueryClient>,
  contentId: number,
  userId: number
) => {
  queryClient.invalidateQueries({ queryKey: [DECK_QUERY_KEY, contentId, userId] });
  queryClient.invalidateQueries({ queryKey: [DECKS_LIST_QUERY_KEY, contentId, userId] });
};

export const useReelFeed = (userId: number | null) => {
  return useQuery({
    queryKey: [REEL_FEED_QUERY_KEY, userId],
    queryFn: async () => {
      if (!userId) return null;
      const result = await cardDeckV2Service.getReelFeed(userId);
      if (!result.success) throw new Error(result.message || 'Failed to load reel feed');
      return result.data!;
    },
    enabled: Boolean(userId),
  });
};

export const useSaveReelFeed = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      userId,
      items,
    }: {
      userId: number;
      items: Array<{ deck_id: number; content_id?: number; topic_ids: number[] | null }>;
    }) => cardDeckV2Service.saveReelFeed(userId, items),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [REEL_FEED_QUERY_KEY, variables.userId] });
      queryClient.invalidateQueries({ queryKey: [REEL_QUEUE_QUERY_KEY, variables.userId] });
    },
  });
};

export const useReelQueue = (userId: number | null, enabled = true) => {
  return useQuery({
    queryKey: [REEL_QUEUE_QUERY_KEY, userId],
    queryFn: async () => {
      if (!userId) return null;
      const result = await cardDeckV2Service.getReelQueue(userId);
      if (!result.success) throw new Error(result.message || 'Failed to load reel queue');
      return result.data!;
    },
    enabled: Boolean(userId) && enabled,
  });
};
