import { useMutation } from '@tanstack/react-query';
import { studyChatService } from '@/services/chatService';
import type { ChatMessage } from '@/api/schemas/chat';

export const useChat = () => {
  return useMutation({
    mutationFn: ({
      message,
      contentId,
      userId,
      context,
      history,
    }: {
      message: string;
      contentId: number;
      userId: number;
      context?: string | null;
      history?: ChatMessage[];
    }) => studyChatService.askQuestion(message, contentId, userId, context, history),
  });
};
