import { z } from 'zod';

/** Coerce API numbers; never fail the whole list on a stringy count. */
function toNum(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function toNumNull(value: unknown): number | null | undefined {
  if (value === null) return null;
  return toNum(value);
}

const optNum = z.unknown().transform(toNum);
const optNumNull = z.unknown().transform(toNumNull);
const jsonRecord = z.unknown().transform((value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
});

const previewEntry = z.object({
  label: z.coerce.string(),
  due_at: z.string().nullable().optional(),
});

export const FlashcardV2Schema = z.object({
  id: optNum,
  position: optNum,
  topic_id: optNumNull,
  front: z.coerce.string(),
  back: z.coerce.string(),
  hint: z.coerce.string().optional(),
  is_starred: z.coerce.boolean().optional(),
  due_at: z.string().nullable().optional(),
  repetitions: optNum,
  interval_days: optNum,
  learning_step: optNum,
  queue_status: z.string().optional(),
  rating_previews: z.record(z.string(), previewEntry).optional(),
});

export type FlashcardV2 = z.infer<typeof FlashcardV2Schema> & {
  _inSessionRequeue?: boolean;
};

export const CardDeckPayloadSchema = z.object({
  deck_id: optNumNull,
  title: z.string().nullable().optional(),
  is_starred_collection: z.coerce.boolean().optional(),
  generation_config: jsonRecord,
  flashcards: z.array(FlashcardV2Schema),
  due_count: optNum,
  new_count: optNum,
  total_count: optNum,
  study_queue_count: optNumNull,
  new_remaining_today: optNum,
});

export type CardDeckPayload = z.infer<typeof CardDeckPayloadSchema>;

export const CardDeckSummarySchema = z.object({
  deck_id: z.unknown().transform((value) => {
    const n = toNum(value);
    if (n == null) throw new Error('deck_id required');
    return n;
  }),
  title: z.string().nullable().optional(),
  total_count: optNum,
  due_count: optNum,
  new_count: optNum,
  study_queue_count: optNum,
  card_count: optNumNull,
  generation_config: jsonRecord,
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});

export type CardDeckSummary = z.infer<typeof CardDeckSummarySchema>;

export const CardDeckStarredSummarySchema = z.object({
  total_count: optNum,
  study_queue_count: optNum,
});

export const CardDeckListSchema = z.object({
  items: z.array(CardDeckSummarySchema),
  starred: CardDeckStarredSummarySchema.optional(),
  has_created_any_deck: z.coerce.boolean().optional(),
});

export type CardDeckList = z.infer<typeof CardDeckListSchema>;

export function parseCardDeckList(data: unknown): CardDeckList {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid deck list');
  }
  const raw = data as {
    items?: unknown;
    starred?: CardDeckList['starred'];
    has_created_any_deck?: unknown;
  };
  const items = Array.isArray(raw.items) ? raw.items : [];
  const coerced = items
    .map((item) => CardDeckSummarySchema.safeParse(item))
    .filter((item): item is { success: true; data: CardDeckSummary } => item.success)
    .map((item) => item.data);
  return {
    items: coerced,
    starred: raw.starred,
    has_created_any_deck: Boolean(raw.has_created_any_deck) || coerced.length > 0,
  };
}

export function parseCardDeckPayload(data: unknown): CardDeckPayload {
  const parsed = CardDeckPayloadSchema.safeParse(data);
  if (parsed.success) return parsed.data;
  if (!data || typeof data !== 'object') throw parsed.error;
  const raw = data as { flashcards?: unknown };
  const cards = Array.isArray(raw.flashcards)
    ? raw.flashcards
        .map((card) => FlashcardV2Schema.safeParse(card))
        .filter((card): card is { success: true; data: FlashcardV2 } => card.success)
        .map((card) => card.data)
    : [];
  return {
    ...(data as CardDeckPayload),
    flashcards: cards,
  };
}

export const StudyQueuePayloadSchema = z.object({
  queue: z.array(FlashcardV2Schema),
  due_count: optNum,
  new_count: optNum,
  study_queue_count: optNum,
  new_remaining_today: optNum,
});

export type StudyQueuePayload = z.infer<typeof StudyQueuePayloadSchema>;

export const ReviewCardDeckResponseSchema = z.object({
  card: FlashcardV2Schema,
  requeue_now: z.coerce.boolean(),
  rating_previews: z.record(z.string(), previewEntry).optional(),
});

export type ReviewCardDeckResponse = z.infer<typeof ReviewCardDeckResponseSchema>;

export const GradePreviewsResponseSchema = z.object({
  rating_previews: z.record(z.string(), previewEntry),
});

export type GradePreviewsResponse = z.infer<typeof GradePreviewsResponseSchema>;

export const GenerateCardDecksV2RequestSchema = z.object({
  content_id: z.number(),
  user_id: z.number(),
  chapter_ids: z.array(z.number()).nullable().optional(),
  regenerate: z.boolean().optional(),
  append: z.boolean().optional(),
  create_new: z.boolean().optional(),
  deck_id: z.number().nullable().optional(),
  title: z.string().nullable().optional(),
  card_count: z.number().optional(),
  special_instructions: z.string().nullable().optional(),
});

export type GenerateCardDecksV2Request = z.infer<typeof GenerateCardDecksV2RequestSchema>;

export const GenerateCardDecksV2ResponseSchema = z.object({
  job_id: z.string().optional(),
  status: z.string().optional(),
  message: z.string().optional(),
});

export type GenerateCardDecksV2Response = z.infer<typeof GenerateCardDecksV2ResponseSchema>;

export const ReelTopicSchema = z.object({
  id: z.unknown().transform((value) => toNum(value) ?? 0),
  title: z.coerce.string(),
});

export const ReelFeedItemSchema = z.object({
  deck_id: z.unknown().transform((value) => toNum(value) ?? 0),
  content_id: z.unknown().transform((value) => toNum(value) ?? 0),
  title: z.coerce.string(),
  note_title: z.string().optional(),
  deck_title: z.string().optional(),
  card_count: optNum,
  due_count: optNum,
  new_count: optNum,
  study_queue_count: optNum,
  topics: z.array(ReelTopicSchema).optional(),
  in_feed: z.coerce.boolean().optional(),
  topic_ids: z.array(z.number()).nullable().optional(),
});

export type ReelFeedItem = z.infer<typeof ReelFeedItemSchema>;

export const ReelFeedPayloadSchema = z.object({
  items: z.array(ReelFeedItemSchema),
  due_count: optNum,
  new_count: optNum,
  study_queue_count: optNum,
  feed_count: optNum,
});

export type ReelFeedPayload = z.infer<typeof ReelFeedPayloadSchema>;

export const ReelCardDeckV2Schema = FlashcardV2Schema.extend({
  content_id: optNum,
  content_title: z.string().optional(),
  deck_id: optNumNull,
  deck_title: z.string().nullable().optional(),
});

export type ReelCardDeckV2 = z.infer<typeof ReelCardDeckV2Schema> & {
  _inSessionRequeue?: boolean;
};

export const ReelQueuePayloadSchema = z.object({
  queue: z.array(ReelCardDeckV2Schema),
  due_count: optNum,
  new_count: optNum,
  study_queue_count: optNum,
  new_remaining_today: optNum,
});

export type ReelQueuePayload = z.infer<typeof ReelQueuePayloadSchema>;
