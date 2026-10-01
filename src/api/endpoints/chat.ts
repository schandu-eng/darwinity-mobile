import apiClient from '../client';
import {
  ChatResponseSchema,
  type ChatRequest,
  type ChatResponse,
} from '../schemas/chat';

export const chatEndpoints = {
  askQuestion: async (data: ChatRequest): Promise<ChatResponse> => {
    const response = await apiClient.post<ChatResponse>('/api/v1/assistant/ask', data);
    return ChatResponseSchema.parse(response.data);
  },
};
