import { z } from 'zod';

export const ExamTargetSummarySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable().optional(),
  exam_date: z.string().nullable().optional(),
  has_pyqs: z.boolean().optional(),
  pyqs_char_count: z.number().optional(),
  content_count: z.number().optional(),
  folder_count: z.number().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

export const ExamLinkedNoteSchema = z.object({
  id: z.number(),
  title: z.string(),
  content_type: z.string().nullable().optional(),
  added_at: z.string().nullable().optional(),
});

export const ExamLinkedFolderSchema = z.object({
  id: z.number(),
  name: z.string(),
  content_count: z.number().optional(),
  added_at: z.string().nullable().optional(),
});

export const ExamTargetDetailSchema = ExamTargetSummarySchema.extend({
  pyqs_text: z.string().optional(),
  contents: z.array(ExamLinkedNoteSchema).optional(),
  folders: z.array(ExamLinkedFolderSchema).optional(),
});

export const ExamEvalQuestionSchema = z.object({
  index: z.number().optional(),
  question: z.string().optional(),
  question_type: z.string().nullable().optional(),
  options: z.array(z.string()).nullable().optional(),
  topic: z.string().nullable().optional(),
  correct_answer: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(),
});

export const ExamEvalAnswerSchema = z.object({
  index: z.number().optional(),
  answer: z.string().optional(),
  is_correct: z.boolean().optional(),
  correct_answer: z.string().nullable().optional(),
  explanation: z.string().nullable().optional(),
});

export const ExamEvalSessionSummarySchema = z.object({
  id: z.number(),
  exam_target_id: z.number().optional(),
  eval_type: z.string().optional(),
  question_count: z.number().optional(),
  difficulty: z.string().optional(),
  status: z.string().optional(),
  score: z.number().nullable().optional(),
  created_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
});

export const ExamEvalSessionSchema = ExamEvalSessionSummarySchema.extend({
  questions: z.array(ExamEvalQuestionSchema).optional(),
  answers: z.array(ExamEvalAnswerSchema).optional(),
  timed: z.boolean().optional(),
  deadline_at: z.string().nullable().optional(),
});

export const ExamTargetListResponseSchema = z.object({
  targets: z.array(ExamTargetSummarySchema),
});

export const ExamTargetResponseSchema = z.object({
  target: ExamTargetDetailSchema,
  message: z.string().optional(),
});

export const ExamSessionListResponseSchema = z.object({
  sessions: z.array(ExamEvalSessionSummarySchema),
});

export const ExamSessionResponseSchema = z.object({
  session: ExamEvalSessionSchema,
});

export type ExamTargetSummary = z.infer<typeof ExamTargetSummarySchema>;
export type ExamTargetDetail = z.infer<typeof ExamTargetDetailSchema>;
export type ExamEvalQuestion = z.infer<typeof ExamEvalQuestionSchema>;
export type ExamEvalSession = z.infer<typeof ExamEvalSessionSchema>;
export type ExamEvalSessionSummary = z.infer<typeof ExamEvalSessionSummarySchema>;
