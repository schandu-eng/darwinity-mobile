import apiClient from '../client';
import {
  ExamTargetListResponseSchema,
  ExamTargetResponseSchema,
  ExamSessionListResponseSchema,
  ExamSessionResponseSchema,
  type ExamTargetDetail,
  type ExamTargetSummary,
  type ExamEvalSession,
  type ExamEvalSessionSummary,
} from '../schemas/testPrep';

export const testPrepEndpoints = {
  listTargets: async (userId: number): Promise<{ targets: ExamTargetSummary[] }> => {
    const response = await apiClient.get('/api/v1/test-prep/targets', {
      params: { user_id: userId },
    });
    return ExamTargetListResponseSchema.parse(response.data);
  },

  getTarget: async (targetId: number, userId: number): Promise<{ target: ExamTargetDetail }> => {
    const response = await apiClient.get(`/api/v1/test-prep/targets/${targetId}`, {
      params: { user_id: userId },
    });
    return ExamTargetResponseSchema.parse(response.data);
  },

  createTarget: async (body: {
    userId: number;
    name: string;
    description?: string | null;
    examDate?: string | null;
  }): Promise<{ target: ExamTargetDetail }> => {
    const response = await apiClient.post('/api/v1/test-prep/targets', {
      user_id: body.userId,
      name: body.name,
      description: body.description || null,
      exam_date: body.examDate || null,
    });
    return ExamTargetResponseSchema.parse(response.data);
  },

  deleteTarget: async (targetId: number, userId: number): Promise<void> => {
    await apiClient.delete(`/api/v1/test-prep/targets/${targetId}`, {
      params: { user_id: userId },
    });
  },

  savePyqs: async (
    targetId: number,
    userId: number,
    pyqsText: string
  ): Promise<{ target: ExamTargetDetail }> => {
    const response = await apiClient.put(`/api/v1/test-prep/targets/${targetId}/pyqs`, {
      user_id: userId,
      pyqs_text: pyqsText,
    });
    return ExamTargetResponseSchema.parse(response.data);
  },

  addContent: async (
    targetId: number,
    userId: number,
    contentId: number
  ): Promise<{ target: ExamTargetDetail }> => {
    const response = await apiClient.post(`/api/v1/test-prep/targets/${targetId}/content`, {
      user_id: userId,
      content_id: contentId,
    });
    return ExamTargetResponseSchema.parse(response.data);
  },

  addFolder: async (
    targetId: number,
    userId: number,
    folderId: number
  ): Promise<{ target: ExamTargetDetail }> => {
    const response = await apiClient.post(`/api/v1/test-prep/targets/${targetId}/folders`, {
      user_id: userId,
      course_id: folderId,
    });
    return ExamTargetResponseSchema.parse(response.data);
  },

  removeContent: async (
    targetId: number,
    userId: number,
    contentId: number
  ): Promise<void> => {
    await apiClient.delete(`/api/v1/test-prep/targets/${targetId}/content/${contentId}`, {
      params: { user_id: userId },
    });
  },

  removeFolder: async (
    targetId: number,
    userId: number,
    folderId: number
  ): Promise<void> => {
    await apiClient.delete(`/api/v1/test-prep/targets/${targetId}/folders/${folderId}`, {
      params: { user_id: userId },
    });
  },

  startEvaluate: async (
    targetId: number,
    body: {
      userId: number;
      evalType: string;
      questionCount: number;
      difficulty: string;
    }
  ): Promise<{ session: ExamEvalSession }> => {
    const response = await apiClient.post(`/api/v1/test-prep/targets/${targetId}/evaluate`, {
      user_id: body.userId,
      eval_type: body.evalType,
      question_count: body.questionCount,
      difficulty: body.difficulty,
    });
    return ExamSessionResponseSchema.parse(response.data);
  },

  listSessions: async (
    targetId: number,
    userId: number
  ): Promise<{ sessions: ExamEvalSessionSummary[] }> => {
    const response = await apiClient.get(`/api/v1/test-prep/targets/${targetId}/sessions`, {
      params: { user_id: userId },
    });
    return ExamSessionListResponseSchema.parse(response.data);
  },

  getSession: async (sessionId: number, userId: number): Promise<{ session: ExamEvalSession }> => {
    const response = await apiClient.get(`/api/v1/test-prep/sessions/${sessionId}`, {
      params: { user_id: userId },
    });
    return ExamSessionResponseSchema.parse(response.data);
  },

  submitEvaluate: async (
    sessionId: number,
    userId: number,
    answers: Array<{ index: number; answer: string }>
  ): Promise<{ session: ExamEvalSession }> => {
    const response = await apiClient.post(`/api/v1/test-prep/sessions/${sessionId}/submit`, {
      user_id: userId,
      answers,
    });
    return ExamSessionResponseSchema.parse(response.data);
  },
};
