import { z } from 'zod';

export const UploadResponseSchema = z.object({
  job_id: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  message: z.string(),
});

export const VideoProcessRequestSchema = z.object({
  url: z.string().url(),
  user_id: z.number(),
});

export type UploadResponse = z.infer<typeof UploadResponseSchema>;
export type VideoProcessRequest = z.infer<typeof VideoProcessRequestSchema>;

