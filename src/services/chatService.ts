import { chatEndpoints } from '@/api/endpoints/chat';
import type { ChatMessage, ChatResponse } from '@/api/schemas/chat';

export const studyChatService = {
  askQuestion: async (
    message: string,
    contentId: number,
    userId: number,
    context?: string | null,
    history?: ChatMessage[]
  ): Promise<{ success: boolean; data?: ChatResponse; message?: string }> => {
    try {
      const data = await chatEndpoints.askQuestion({
        message,
        content_id: contentId,
        user_id: userId,
        context: context || null,
        history: history || [],
      });
      return { success: true, data };
    } catch (error: any) {
      if (error.response?.status === 403) {
        return {
          success: false,
          message: error.response?.data?.detail || 'Unable to send message',
        };
      }
      return {
        success: false,
        message: error.response?.data?.detail || error.message || 'Failed to send message',
      };
    }
  },
};
