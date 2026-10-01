import { z } from 'zod';

const CONTENT_TYPE_MAP: Record<string, 'PDF' | 'YOUTUBE' | 'AUDIO_RECORDING'> = {
  pdf: 'PDF',
  youtube: 'YOUTUBE',
  audio_recording: 'AUDIO_RECORDING',
} as const;

export const ContentTypeSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val : String(val ?? 'pdf')),
  z.string().transform((val) => CONTENT_TYPE_MAP[val.toLowerCase()] ?? 'PDF')
);

export const NotesStatusSchema = z.preprocess(
  (val) => (val == null || val === '' ? 'ready' : val),
  z.enum(['pending', 'ready', 'failed']).catch('ready')
);

export const ContentListItemSchema = z.object({
  id: z.coerce.number(),
  title: z.preprocess((val) => (typeof val === 'string' && val.trim() ? val : 'Untitled'), z.string()),
  notes_status: NotesStatusSchema,
  source_key: z.preprocess((val) => val ?? '', z.string()),
  content_type: ContentTypeSchema,
  has_flashcards: z.coerce.boolean(),
  has_podcast: z.coerce.boolean().optional().default(false),
  has_chapters: z.coerce.boolean(),
  created_at: z.string().nullable(),
  last_opened_at: z.string().nullable(),
  youtube_id: z.string().nullable().optional(),
});

export const ContentListResponseSchema = z.object({
  content: z.array(ContentListItemSchema),
  total: z.coerce.number(),
  page: z.coerce.number(),
  pages: z.coerce.number(),
});

export const ChapterSchema = z.object({
  id: z.number(),
  title: z.string(),
  order: z.number(),
});

export const TopicSchema = z.object({
  id: z.number(),
  title: z.string(),
  order: z.number(),
  note: z.string(),

  note_blocks: z.array(z.any()).nullable().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  start_seconds: z.number().optional(),
  end_seconds: z.number().optional(),
  start_page: z.number().optional(),
  end_page: z.number().optional(),
});

export const ContentDetailSchema = z.object({
  id: z.number(),
  title: z.string(),
  notes_status: NotesStatusSchema,
  document_id: z.number(),
  source_key: z.string(),
  content_type: ContentTypeSchema,
  transcript: z.union([z.string(), z.record(z.string(), z.any())]).nullable(),
  chapters: z.array(ChapterSchema),
  topics: z.array(TopicSchema),
  editor_blocks: z.array(z.any()).nullable(),
  summary: z.union([z.string(), z.record(z.string(), z.any())]).nullable(),
  flashcards: z.any().nullable(),
  podcast_url: z.string().nullable(),
  podcast_script: z.union([z.string(), z.record(z.string(), z.any())]).nullable().optional(),
  podcast_raw_script: z.string().nullable().optional(),
  visuals: z.array(z.any()).nullable().optional(),
  active_job_id: z.string().nullable(),
  vectorstore_path: z.string().nullable(),
  created_at: z.string().nullable(),
  updated_at: z.string().nullable(),
  document: z.object({
    id: z.number(),
    title: z.string(),
    content_type: ContentTypeSchema,
    source_key: z.string(),
    document_details: z
      .object({
        vectorstore_path: z.string().nullable(),
      })
      .nullable(),
  }),
});

export const PodcastUrlSchema = z.object({
  podcast_url: z.string().nullable(),
  podcast_script: z.union([z.string(), z.record(z.string(), z.any())]).nullable().optional(),
});

export const FlashcardsResponseSchema = z.object({
  flashcards: z.any().nullable(),
});

export type FlashcardsResponse = z.infer<typeof FlashcardsResponseSchema>;

export type PodcastUrlResponse = z.infer<typeof PodcastUrlSchema>;

export const JobStatusSchema = z.object({
  id: z.number().optional(),
  job_id: z.string(),
  user_id: z.number(),
  job_type: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'blocked', 'upgrade_required']),
  progress: z.number().optional(),
  content_id: z.number().nullable().optional(),
  result: z.any().nullable().optional(),
  error_message: z.string().nullable().optional(),
  user_message: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
});

export type ContentListItem = z.infer<typeof ContentListItemSchema>;
export type ContentListResponse = z.infer<typeof ContentListResponseSchema>;
export type ContentDetail = z.infer<typeof ContentDetailSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type Topic = z.infer<typeof TopicSchema>;
export type ContentType = z.infer<typeof ContentTypeSchema>;
