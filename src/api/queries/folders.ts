import { useQuery } from '@tanstack/react-query';
import { foldersService } from '@/services/foldersService';

export const FOLDERS_QUERY_KEY = 'folders';

export const useUserFolders = (userId: number | null) => {
  return useQuery({
    queryKey: [FOLDERS_QUERY_KEY, 'list', userId],
    queryFn: () => {
      if (!userId) throw new Error('User ID is required');
      return foldersService.getUserFolders(userId);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useFolderContent = (folderId: number | null) => {
  return useQuery({
    queryKey: [FOLDERS_QUERY_KEY, 'content', folderId],
    queryFn: () => {
      if (!folderId) throw new Error('Folder ID is required');
      return foldersService.getFolderContent(folderId);
    },
    enabled: !!folderId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
