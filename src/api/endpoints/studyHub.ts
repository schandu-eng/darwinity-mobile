import apiClient from '../client';
import {
  GenerateCardDecksResponseSchema,
  GeneratePodcastResponseSchema,
  QuizSessionResponseSchema,
  QuizSetListSchema,
  QuizStarredItemSchema,
  QuizStarredListSchema,
  StudyGameItemsResponseSchema,
  type GenerateCardDecksRequest,
  type GenerateCardDecksResponse,
  type GeneratePodcastRequest,
  type GeneratePodcastResponse,
  type QuizSessionQuestion,
  type QuizSessionResponse,
  type QuizSet,
  type QuizSetList,
  type QuizStarredItem,
  type QuizStarredList,
  type StudyGameItemsResponse,
} from '../schemas/studyHub';

export const learningEndpoints = {
  generateCardDecks: async (data: GenerateCardDecksRequest): Promise<GenerateCardDecksResponse> => {
    const response = await apiClient.post<GenerateCardDecksResponse>(
      '/api/v1/materials/generate-flashcards',
      data
    );
    return GenerateCardDecksResponseSchema.parse(response.data);
  },

  getQuizSession: async (contentId: number, userId: number): Promise<QuizSessionResponse> => {
    const response = await apiClient.get<QuizSessionResponse>(
      `/api/v1/assessments/session?content_id=${contentId}&user_id=${userId}`
    );
    return QuizSessionResponseSchema.parse(response.data);
  },

  startQuizSession: async (
    contentId: number,
    userId: number,
    config: object,
    forceNew = false
  ): Promise<QuizSessionResponse> => {
    const response = await apiClient.post<QuizSessionResponse>(
      '/api/v1/assessments/session/start',
      {
        content_id: contentId,
        user_id: userId,
        config,
        force_new: forceNew,
      },
      { timeout: 60_000 }
    );
    return QuizSessionResponseSchema.parse(response.data);
  },

  listQuizSessions: async (contentId: number, userId: number): Promise<{ items: QuizSet[]; free_quota?: QuizSetList['free_quota'] }> => {
    const response = await apiClient.get<{ items?: QuizSet[] }>(
      `/api/v1/assessments/sessions?content_id=${contentId}&user_id=${userId}`
    );
    const parsed = QuizSetListSchema.parse(response.data);
    return { items: parsed.items || [], free_quota: parsed.free_quota };
  },

  reactivateQuizSession: async (
    sessionId: number,
    userId: number
  ): Promise<QuizSessionResponse> => {
    const response = await apiClient.post<QuizSessionResponse>(
      `/api/v1/assessments/session/${sessionId}/reactivate`,
      { user_id: userId }
    );
    return QuizSessionResponseSchema.parse(response.data);
  },

  nextQuizQuestion: async (
    sessionId: number,
    userId: number,
    answer: string | null,
    questionId: number | null,
    options?: { gradeOnly?: boolean }
  ): Promise<QuizSessionResponse> => {
    const response = await apiClient.post<QuizSessionResponse>(
      `/api/v1/assessments/session/${sessionId}/next`,
      {
        user_id: userId,
        answer,
        question_id: questionId,
        ...(options?.gradeOnly ? { grade_only: true } : {}),
      }
    );
    return QuizSessionResponseSchema.parse(response.data);
  },

  updateQuizConfig: async (
    sessionId: number,
    userId: number,
    config: object,
    keepQuestionId?: number | null
  ): Promise<QuizSessionResponse> => {
    const response = await apiClient.post<QuizSessionResponse>(
      `/api/v1/assessments/session/${sessionId}/config`,
      {
        user_id: userId,
        config,
        keep_question_id: keepQuestionId ?? null,
      }
    );
    return QuizSessionResponseSchema.parse(response.data);
  },

  resetQuizSession: async (
    sessionId: number,
    userId: number
  ): Promise<QuizSessionResponse> => {
    const response = await apiClient.post<QuizSessionResponse>(
      `/api/v1/assessments/session/${sessionId}/reset`,
      { user_id: userId }
    );
    return QuizSessionResponseSchema.parse(response.data);
  },

  preGenerateQuizQuestion: async (sessionId: number, userId: number): Promise<void> => {
    await apiClient.post(`/api/v1/assessments/session/${sessionId}/pre-generate`, {
      user_id: userId,
    });
  },

  completeQuizSession: async (
    sessionId: number,
    userId: number
  ): Promise<QuizSessionResponse> => {
    const response = await apiClient.post<QuizSessionResponse>(
      `/api/v1/assessments/session/${sessionId}/complete`,
      { user_id: userId }
    );
    return QuizSessionResponseSchema.parse(response.data);
  },

  reviewQuizSession: async (
    sessionId: number,
    userId: number
  ): Promise<QuizSessionResponse> => {
    const response = await apiClient.get<QuizSessionResponse>(
      `/api/v1/assessments/session/${sessionId}/review?user_id=${userId}`
    );
    return QuizSessionResponseSchema.parse(response.data);
  },

  listStarredQuizQuestions: async (
    contentId: number,
    userId: number
  ): Promise<QuizStarredList> => {
    const response = await apiClient.get<QuizStarredList>(
      `/api/v1/assessments/starred?content_id=${contentId}&user_id=${userId}`
    );
    return QuizStarredListSchema.parse(response.data);
  },

  starQuizQuestion: async (
    contentId: number,
    userId: number,
    question: QuizSessionQuestion | Record<string, unknown>,
    topicId?: number | null
  ): Promise<QuizStarredItem> => {
    const response = await apiClient.post<QuizStarredItem>('/api/v1/assessments/starred', {
      content_id: contentId,
      user_id: userId,
      question,
      topic_id: topicId ?? undefined,
    });
    return QuizStarredItemSchema.parse(response.data);
  },

  unstarQuizQuestion: async (starredId: number, userId: number): Promise<{ ok: boolean }> => {
    const response = await apiClient.delete<{ ok: boolean }>(
      `/api/v1/assessments/starred/${starredId}?user_id=${userId}`
    );
    return response.data;
  },

  generatePodcast: async (data: GeneratePodcastRequest): Promise<GeneratePodcastResponse> => {
    const response = await apiClient.post<GeneratePodcastResponse>(
      '/api/v1/materials/generate-podcast',
      data
    );
    return GeneratePodcastResponseSchema.parse(response.data);
  },

  generateStudyGameItems: async (
    contentId: number,
    userId: number,
    count = 16
  ): Promise<StudyGameItemsResponse> => {
    const response = await apiClient.post<StudyGameItemsResponse>(
      '/api/v1/study-games/items',
      { content_id: contentId, user_id: userId, count },
      { timeout: 120000 }
    );
    return StudyGameItemsResponseSchema.parse(response.data);
  },
};
