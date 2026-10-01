import { z } from 'zod';

export const FlashcardSchema = z.object({
  front: z.string(),
  back: z.string(),
  hint: z.string().optional(),
});

export type Flashcard = z.infer<typeof FlashcardSchema>;

export const FlashcardListSchema = z.object({
  flashcards: z.array(FlashcardSchema),
});

export type FlashcardList = z.infer<typeof FlashcardListSchema>;

export const GenerateCardDecksRequestSchema = z.object({
  content_id: z.number(),
  user_id: z.number(),
  chapter_ids: z.array(z.number()).nullable().optional(),
  regenerate: z.boolean().optional(),
});

export type GenerateCardDecksRequest = z.infer<typeof GenerateCardDecksRequestSchema>;

export const GenerateCardDecksResponseSchema = z.object({
  job_id: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  message: z.string(),
});

export type GenerateCardDecksResponse = z.infer<typeof GenerateCardDecksResponseSchema>;

export const QuizSessionQuestionSchema = z.object({
  question: z.string(),
  question_type: z.string().optional(),
  options: z.array(z.string()).nullable().optional(),
  correct_answer: z.string().optional().nullable(),
  explanation: z.string().optional().nullable(),
  topic: z.string().optional().nullable(),
}).passthrough();

export type QuizSessionQuestion = z.infer<typeof QuizSessionQuestionSchema>;

export const QuizSessionHistoryItemSchema = z.object({
  id: z.number(),
  topic_id: z.number().nullable().optional(),
  question: QuizSessionQuestionSchema,
  user_answer: z.string().nullable().optional(),
  is_correct: z.boolean().nullable().optional(),
  content_hash: z.string().optional().nullable(),
});

export type QuizSessionHistoryItem = z.infer<typeof QuizSessionHistoryItemSchema>;

export const QuizGradeSchema = z.object({
  question_id: z.number(),
  is_correct: z.boolean().nullable().optional(),
  user_answer: z.string().optional().nullable(),
  correct_answer: z.string().optional().nullable(),
  explanation: z.string().optional().nullable(),
});

export type QuizGrade = z.infer<typeof QuizGradeSchema>;

export const QuizSessionResponseSchema = z.object({
  session_id: z.number().nullable().optional(),
  status: z.string().nullable().optional(),
  question: QuizSessionQuestionSchema.nullable().optional(),
  question_id: z.number().nullable().optional(),
  position: z.number().optional(),
  total: z.number().optional(),
  question_count: z.number().optional(),
  answered_count: z.number().optional(),
  config: z.record(z.string(), z.any()).nullable().optional(),
  history: z.array(QuizSessionHistoryItemSchema).optional(),
  current_question: QuizSessionQuestionSchema.nullable().optional(),
  current_question_id: z.number().nullable().optional(),
  grade: QuizGradeSchema.nullable().optional(),
  deadline_at: z.string().nullable().optional(),
  server_now: z.string().nullable().optional(),
  completed: z.boolean().optional(),
  completed_at: z.string().nullable().optional(),
  needs_upgrade: z.boolean().optional(),
  crafting: z.boolean().optional(),
  free_quota: z
    .object({
      unlimited: z.boolean().optional(),
      limit: z.number().nullable().optional(),
      used: z.number().nullable().optional(),
      remaining: z.number().nullable().optional(),
    })
    .nullable()
    .optional(),
  score: z
    .object({
      correct: z.number(),
      answered: z.number(),
      total: z.number().optional(),
      unanswered: z.number().optional(),
    })
    .nullable()
    .optional(),
}).passthrough();

export type QuizSessionResponse = z.infer<typeof QuizSessionResponseSchema>;

export const QuizSetScoreSchema = z.object({
  correct: z.number(),
  answered: z.number(),
  total: z.number().optional(),
  unanswered: z.number().optional(),
});

export const QuizSetSchema = z.object({
  session_id: z.number(),
  status: z.string().nullable().optional(),
  kind: z.enum(['in_progress', 'incomplete', 'completed']).or(z.string()),
  config: z.record(z.string(), z.any()).nullable().optional(),
  answered_count: z.number().optional(),
  question_count: z.number().optional(),
  score: QuizSetScoreSchema.nullable().optional(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  deadline_at: z.string().nullable().optional(),
}).passthrough();

export type QuizSet = z.infer<typeof QuizSetSchema>;

export const QuizSetListSchema = z.object({
  items: z.array(QuizSetSchema),
  free_quota: z.object({
    unlimited: z.boolean().optional(),
    limit: z.number().nullable().optional(),
    used: z.number().nullable().optional(),
    remaining: z.number().nullable().optional(),
  }).optional(),
}).passthrough();

export type QuizSetList = z.infer<typeof QuizSetListSchema>;

export const QuizStarredItemSchema = z.object({
  id: z.number(),
  content_id: z.number().optional(),
  topic_id: z.number().nullable().optional(),
  content_hash: z.string().optional(),
  question: QuizSessionQuestionSchema,
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
}).passthrough();

export type QuizStarredItem = z.infer<typeof QuizStarredItemSchema>;

export const QuizStarredListSchema = z.object({
  items: z.array(QuizStarredItemSchema),
});

export type QuizStarredList = z.infer<typeof QuizStarredListSchema>;

export const GeneratePodcastRequestSchema = z.object({
  content_id: z.number(),
  user_id: z.number(),
  chapter_ids: z.array(z.number()).nullable().optional(),
});

export type GeneratePodcastRequest = z.infer<typeof GeneratePodcastRequestSchema>;

export const GeneratePodcastResponseSchema = z.object({
  job_id: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  message: z.string(),
});

export type GeneratePodcastResponse = z.infer<typeof GeneratePodcastResponseSchema>;

export const StudyGameItemSchema = z.object({
  id: z.string().optional(),
  prompt: z.string(),
  answer: z.string(),
  choices: z.array(z.string()).optional(),
  choiceLabels: z.array(z.string()).optional(),
});

export type StudyGameItem = z.infer<typeof StudyGameItemSchema>;

export const StudyGameItemsResponseSchema = z.object({
  items: z.array(StudyGameItemSchema),
});

export type StudyGameItemsResponse = z.infer<typeof StudyGameItemsResponseSchema>;

