import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { testPrepService } from '@/services/testPrepService';

export const TEST_PREP_TARGETS_KEY = 'test-prep-targets';
export const TEST_PREP_TARGET_KEY = 'test-prep-target';
export const TEST_PREP_SESSIONS_KEY = 'test-prep-sessions';
export const TEST_PREP_REVISE_KEY = 'test-prep-revise';

export const useExamTargets = (userId: number | null) => {
  return useQuery({
    queryKey: [TEST_PREP_TARGETS_KEY, userId],
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');
      const result = await testPrepService.listTargets(userId);
      if (!result.success) throw new Error(result.message || 'Failed to load exam targets');
      return result.data || [];
    },
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
  });
};

export const useExamTarget = (targetId: number | null, userId: number | null) => {
  return useQuery({
    queryKey: [TEST_PREP_TARGET_KEY, targetId, userId],
    queryFn: async () => {
      if (!targetId || !userId) throw new Error('Target and user are required');
      const result = await testPrepService.getTarget(targetId, userId);
      if (!result.success) throw new Error(result.message || 'Failed to load exam target');
      return result.data!;
    },
    enabled: Boolean(targetId && userId),
    staleTime: 30 * 1000,
  });
};

export const useExamSessions = (targetId: number | null, userId: number | null) => {
  return useQuery({
    queryKey: [TEST_PREP_SESSIONS_KEY, targetId, userId],
    queryFn: async () => {
      if (!targetId || !userId) throw new Error('Target and user are required');
      const result = await testPrepService.listSessions(targetId, userId);
      if (!result.success) throw new Error(result.message || 'Failed to load practices');
      return result.data || [];
    },
    enabled: Boolean(targetId && userId),
    staleTime: 15 * 1000,
  });
};

export const useExamReviseSummary = (targetId: number | null, userId: number | null) => {
  return useQuery({
    queryKey: [TEST_PREP_REVISE_KEY, targetId, userId],
    queryFn: async () => {
      if (!targetId || !userId) throw new Error('Target and user are required');
      const result = await testPrepService.getReviseSummary(targetId, userId);
      if (!result.success) throw new Error(result.message || 'Failed to load revise summary');
      return result.data!;
    },
    enabled: Boolean(targetId && userId),
    staleTime: 30 * 1000,
  });
};

export const useInvalidateExamPrep = () => {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: [TEST_PREP_TARGETS_KEY] });
    queryClient.invalidateQueries({ queryKey: [TEST_PREP_TARGET_KEY] });
    queryClient.invalidateQueries({ queryKey: [TEST_PREP_SESSIONS_KEY] });
    queryClient.invalidateQueries({ queryKey: [TEST_PREP_REVISE_KEY] });
  };
};

export const useDeleteExamTarget = () => {
  const invalidate = useInvalidateExamPrep();
  return useMutation({
    mutationFn: ({ targetId, userId }: { targetId: number; userId: number }) =>
      testPrepService.deleteTarget(targetId, userId),
    onSuccess: invalidate,
  });
};
