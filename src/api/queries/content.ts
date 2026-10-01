import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { contentService } from '@/services/contentService';
import { useAuthStore } from '@/store/memberAuthStore';
import { queryClient } from '@/api/queryClient';
import { JOB_POLL_BASE_MS, jobStatusRefetchIntervalMs } from '@/utils/jobPollSchedule';

const CONTENT_QUERY_KEY = 'content';
const JOB_STATUS_QUERY_KEY = 'job-status';
const PODCAST_URL_QUERY_KEY = 'podcast-url';
const CARD_DECKS_QUERY_KEY = 'flashcards';

export function contentDetailQueryKey(contentId: number | null, userId: number | null) {
  return [CONTENT_QUERY_KEY, 'detail', contentId, userId] as const;
}

export function prefetchContentDetail(contentId: number, userId: number | null) {
  if (!contentId || !userId) return;
  return queryClient.prefetchQuery({
    queryKey: contentDetailQueryKey(contentId, userId),
    queryFn: () => contentService.getContentById(contentId, userId),
    staleTime: 5 * 60 * 1000,
  });
}

export const useUserContent = (userId: number | null, limit: number = 10) => {
  return useInfiniteQuery({
    queryKey: [CONTENT_QUERY_KEY, 'list', userId, limit],
    queryFn: async ({ pageParam = 1 }) => {
      if (!userId) throw new Error('User ID is required');
      const result = await contentService.getUserContent(userId, pageParam, limit);
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Failed to fetch content');
      }
      return result;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage?.data) return undefined;
      const { page, pages } = lastPage.data;
      return page < pages ? page + 1 : undefined;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    initialPageParam: 1,
  });
};

export const useContent = (contentId: number | null) => {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const authLoading = useAuthStore((s) => s.isLoading);

  return useQuery({
    queryKey: contentDetailQueryKey(contentId, userId),
    queryFn: () => {
      if (!contentId) throw new Error('Content ID is required');
      return contentService.getContentById(contentId, userId ?? undefined);
    },
    enabled: !!contentId && !authLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const usePodcastUrl = (contentId: number | null) => {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const authLoading = useAuthStore((s) => s.isLoading);

  return useQuery({
    queryKey: [PODCAST_URL_QUERY_KEY, contentId, userId],
    queryFn: () => {
      if (!contentId) throw new Error('Content ID is required');
      return contentService.getPodcastUrl(contentId, userId ?? undefined);
    },
    enabled: !!contentId && !authLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useCardDecks = (contentId: number | null) => {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const authLoading = useAuthStore((s) => s.isLoading);

  return useQuery({
    queryKey: [CARD_DECKS_QUERY_KEY, contentId, userId],
    queryFn: () => {
      if (!contentId) throw new Error('Content ID is required');
      return contentService.getCardDecks(contentId, userId ?? undefined);
    },
    enabled: !!contentId && !authLoading,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useJobStatus = (jobId: string | null, options?: { refetchInterval?: number }) => {
  return useQuery({
    queryKey: [JOB_STATUS_QUERY_KEY, jobId],
    queryFn: () => {
      if (!jobId) throw new Error('Job ID is required');
      return contentService.getJobStatus(jobId);
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      if (!jobId) return false;
      return jobStatusRefetchIntervalMs(
        query as Parameters<typeof jobStatusRefetchIntervalMs>[0],
        options?.refetchInterval ?? JOB_POLL_BASE_MS
      );
    },
    staleTime: 0,
  });
};
