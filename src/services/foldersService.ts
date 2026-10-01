import { foldersEndpoints } from '@/api/endpoints/folders';
import type { Folder, FolderContentItem } from '@/api/schemas/folders';

const errorMessage = (error: any, fallback: string): string =>
  error?.response?.data?.detail || error?.message || fallback;

export const foldersService = {
  getUserFolders: async (
    userId: number
  ): Promise<{ success: boolean; data?: Folder[]; message?: string }> => {
    try {
      const { courses } = await foldersEndpoints.getUserFolders(userId);
      // API still returns { courses }; expose as folders.
      return { success: true, data: courses };
    } catch (error: any) {
      return { success: false, message: errorMessage(error, 'Failed to fetch folders') };
    }
  },

  createFolder: async (
    name: string,
    userId: number
  ): Promise<{ success: boolean; data?: Folder; message?: string }> => {
    try {
      const { course } = await foldersEndpoints.createFolder(name, userId);
      // API still returns { course }; treat as folder.
      return { success: true, data: course };
    } catch (error: any) {
      return { success: false, message: errorMessage(error, 'Failed to create folder') };
    }
  },

  getFolder: async (
    folderId: number
  ): Promise<{ success: boolean; data?: Folder; message?: string }> => {
    try {
      const { course } = await foldersEndpoints.getFolder(folderId);
      return { success: true, data: course };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { success: false, message: 'Folder not found' };
      }
      return { success: false, message: errorMessage(error, 'Failed to fetch folder') };
    }
  },

  renameFolder: async (
    folderId: number,
    name: string,
    userId: number
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      await foldersEndpoints.renameFolder(folderId, name, userId);
      return { success: true };
    } catch (error: any) {
      return { success: false, message: errorMessage(error, 'Failed to rename folder') };
    }
  },

  deleteFolder: async (
    folderId: number,
    userId: number
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      await foldersEndpoints.deleteFolder(folderId, userId);
      return { success: true };
    } catch (error: any) {
      return { success: false, message: errorMessage(error, 'Failed to delete folder') };
    }
  },

  getFolderContent: async (
    folderId: number
  ): Promise<{ success: boolean; data?: FolderContentItem[]; message?: string }> => {
    try {
      const { content } = await foldersEndpoints.getFolderContent(folderId);
      return { success: true, data: content };
    } catch (error: any) {
      return { success: false, message: errorMessage(error, 'Failed to fetch folder content') };
    }
  },

  addContentToFolder: async (
    contentId: number,
    folderId: number,
    userId: number
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      await foldersEndpoints.addContentToFolder(contentId, folderId, userId);
      return { success: true };
    } catch (error: any) {
      return { success: false, message: errorMessage(error, 'Failed to add note to folder') };
    }
  },

  removeContentFromFolder: async (
    folderId: number,
    contentId: number
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      await foldersEndpoints.removeContentFromFolder(folderId, contentId);
      return { success: true };
    } catch (error: any) {
      return { success: false, message: errorMessage(error, 'Failed to remove note from folder') };
    }
  },
};
