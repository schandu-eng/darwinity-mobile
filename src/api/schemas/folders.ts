import { z } from 'zod';
import { ContentTypeSchema } from './content';

export const FolderSchema = z.object({
  id: z.number(),
  name: z.string(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  content_count: z.number().optional(),
});

export const FolderListResponseSchema = z.object({
  courses: z.array(FolderSchema),
});

export const CreateFolderResponseSchema = z.object({
  course: FolderSchema,
  message: z.string().optional(),
});

export const GetFolderResponseSchema = z.object({
  course: FolderSchema,
});

export const FolderContentItemSchema = z.object({
  id: z.number(),
  title: z.string(),
  source_key: z.string().nullable().optional(),
  content_type: ContentTypeSchema,
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  added_to_course_at: z.string().nullable().optional(),
  order_index: z.number().optional(),
});

export const FolderContentResponseSchema = z.object({
  content: z.array(FolderContentItemSchema),
});

export type Folder = z.infer<typeof FolderSchema>;
export type FolderListResponse = z.infer<typeof FolderListResponseSchema>;
export type CreateFolderResponse = z.infer<typeof CreateFolderResponseSchema>;
export type GetFolderResponse = z.infer<typeof GetFolderResponseSchema>;
export type FolderContentItem = z.infer<typeof FolderContentItemSchema>;
export type FolderContentResponse = z.infer<typeof FolderContentResponseSchema>;
