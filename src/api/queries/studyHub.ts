import { useMutation, useQueryClient } from '@tanstack/react-query';
import { learningService } from '@/services/studyHubService';
import { useJobStatus } from './content';

export const useGenerateCardDecks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      contentId,
      userId,
      chapterIds,
      regenerate,
    }: {
      contentId: number;
      userId: number;
      chapterIds?: number[] | null;
      regenerate?: boolean;
    }) => learningService.generateCardDecks(contentId, userId, chapterIds, regenerate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
};

export const useFlashcardJobStatus = (jobId: string | null) => {
  return useJobStatus(jobId, { refetchInterval: 5000 });
};

export const useGeneratePodcast = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      contentId,
      userId,
      chapterIds,
    }: {
      contentId: number;
      userId: number;
      chapterIds?: number[] | null;
    }) => learningService.generatePodcast(contentId, userId, chapterIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });
};

export const usePodcastJobStatus = (jobId: string | null) => {
  return useJobStatus(jobId, { refetchInterval: 10000 });
};

