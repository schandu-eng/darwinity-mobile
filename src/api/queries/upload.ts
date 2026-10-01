import { useMutation } from '@tanstack/react-query';
import { uploadService } from '@/services/uploadService';
import type { AudioSource } from '@/api/endpoints/upload';

export const useUploadPDF = () => {
  return useMutation({
    mutationFn: ({ file, userId, folderId }: { file: any; userId: number; folderId?: number }) =>
      uploadService.uploadPDF(file, userId, folderId),
  });
};

export const useProcessYouTube = () => {
  return useMutation({
    mutationFn: ({ url, userId, folderId }: { url: string; userId: number; folderId?: number }) =>
      uploadService.processYouTube(url, userId, folderId),
  });
};

export const useUploadAudio = () => {
  return useMutation({
    mutationFn: ({
      file,
      userId,
      source,
      folderId,
    }: {
      file: any;
      userId: number;
      source?: AudioSource;
      folderId?: number;
    }) => uploadService.uploadAudio(file, userId, source, folderId),
  });
};
