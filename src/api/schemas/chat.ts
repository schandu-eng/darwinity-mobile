import { z } from 'zod';

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string().nullable().optional(),
  contextText: z.string().nullable().optional(),
  retrieval_successful: z.boolean().optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  message: z.string(),
  content_id: z.number(),
  user_id: z.number(),
  context: z.string().nullable().optional(),
  page_context: z.string().nullable().optional(),
  history: z.array(ChatMessageSchema).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  response: z.string(),
  source_documents: z.array(z.any()).optional(),
  retrieval_successful: z.boolean().optional(),
  error_code: z.string().nullable().optional(),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;
