import { useContent } from '@/api/queries/content';

function contentHasEffectiveNotes(content: {
  topics?: Array<{ note?: string | null; note_blocks?: unknown[] | null }> | null;
  editor_blocks?: unknown[] | null;
} | null | undefined): boolean {
  if (!content) return false;
  if (Array.isArray(content.editor_blocks) && content.editor_blocks.length > 0) {
    return true;
  }
  const topics = content.topics || [];
  return topics.some((topic) => {
    if ((topic.note || '').trim()) return true;
    return Array.isArray(topic.note_blocks) && topic.note_blocks.length > 0;
  });
}

export function useChatAvailability(contentId: number | null) {
  const { data: contentData, isLoading } = useContent(contentId);
  const content = contentData?.data;
  const isChatAvailable = contentHasEffectiveNotes(content);

  return {
    content,
    isLoading,
    isChatAvailable,
  };
}
