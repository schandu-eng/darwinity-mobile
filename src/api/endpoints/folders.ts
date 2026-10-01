import apiClient from '../client';
import {
  FolderListResponseSchema,
  CreateFolderResponseSchema,
  GetFolderResponseSchema,
  FolderContentResponseSchema,
  type FolderListResponse,
  type CreateFolderResponse,
  type GetFolderResponse,
  type FolderContentResponse,
} from '../schemas/folders';

const safeParseDev = <T>(schema: { parse: (d: unknown) => T }, data: unknown): T => {
  return schema.parse(data);
};

export const foldersEndpoints = {
  getUserFolders: async (userId: number): Promise<FolderListResponse> => {
    const response = await apiClient.get<FolderListResponse>(`/api/v1/curriculum/user/${userId}`);
    return safeParseDev(FolderListResponseSchema, response.data);
  },

  createFolder: async (name: string, userId: number): Promise<CreateFolderResponse> => {
    const response = await apiClient.post<CreateFolderResponse>('/api/v1/curriculum/create', {
      name,
      user_id: userId,
    });
    return safeParseDev(CreateFolderResponseSchema, response.data);
  },

  getFolder: async (folderId: number): Promise<GetFolderResponse> => {
    const response = await apiClient.get<GetFolderResponse>(`/api/v1/curriculum/${folderId}`);
    return safeParseDev(GetFolderResponseSchema, response.data);
  },

  renameFolder: async (
    folderId: number,
    name: string,
    userId: number
  ): Promise<{ message: string; name: string }> => {
    const response = await apiClient.patch(`/api/v1/curriculum/${folderId}/name`, {
      name,
      user_id: userId,
    });
    return response.data;
  },

  deleteFolder: async (folderId: number, userId: number): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/v1/curriculum/${folderId}`, {
      params: { user_id: userId },
    });
    return response.data;
  },

  getFolderContent: async (folderId: number): Promise<FolderContentResponse> => {
    const response = await apiClient.get<FolderContentResponse>(`/api/v1/curriculum/${folderId}/content`);
    return safeParseDev(FolderContentResponseSchema, response.data);
  },

  addContentToFolder: async (
    contentId: number,
    folderId: number,
    userId: number
  ): Promise<{ message: string; content_id: number; course_id: number }> => {
    const response = await apiClient.post('/api/v1/materials/add-to-course', {
      content_id: contentId,
      course_id: folderId,
      user_id: userId,
    });
    return response.data;
  },

  removeContentFromFolder: async (
    folderId: number,
    contentId: number
  ): Promise<{ message: string }> => {
    const response = await apiClient.delete(`/api/v1/curriculum/${folderId}/content/${contentId}`);
    return response.data;
  },
};
