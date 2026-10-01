import axios from 'axios';
import { testPrepEndpoints } from '@/api/endpoints/testPrep';
import type {
  ExamTargetDetail,
  ExamTargetSummary,
  ExamEvalSession,
  ExamEvalSessionSummary,
} from '@/api/schemas/testPrep';

const errorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

export const testPrepService = {
  listTargets: async (
    userId: number
  ): Promise<{ success: boolean; data?: ExamTargetSummary[]; message?: string }> => {
    try {
      const { targets } = await testPrepEndpoints.listTargets(userId);
      return { success: true, data: targets };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Failed to load exam targets') };
    }
  },

  getTarget: async (
    targetId: number,
    userId: number
  ): Promise<{ success: boolean; data?: ExamTargetDetail; message?: string }> => {
    try {
      const { target } = await testPrepEndpoints.getTarget(targetId, userId);
      return { success: true, data: target };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Failed to load exam target') };
    }
  },

  createTarget: async (body: {
    userId: number;
    name: string;
    description?: string | null;
    examDate?: string | null;
  }): Promise<{ success: boolean; data?: ExamTargetDetail; message?: string }> => {
    try {
      const { target } = await testPrepEndpoints.createTarget(body);
      return { success: true, data: target };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Failed to create exam target') };
    }
  },

  deleteTarget: async (
    targetId: number,
    userId: number
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      await testPrepEndpoints.deleteTarget(targetId, userId);
      return { success: true };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Failed to delete exam target') };
    }
  },

  savePyqs: async (
    targetId: number,
    userId: number,
    pyqsText: string
  ): Promise<{ success: boolean; data?: ExamTargetDetail; message?: string }> => {
    try {
      const { target } = await testPrepEndpoints.savePyqs(targetId, userId, pyqsText);
      return { success: true, data: target };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Failed to save PYQs') };
    }
  },

  addContent: async (
    targetId: number,
    userId: number,
    contentId: number
  ): Promise<{ success: boolean; data?: ExamTargetDetail; message?: string }> => {
    try {
      const { target } = await testPrepEndpoints.addContent(targetId, userId, contentId);
      return { success: true, data: target };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Failed to add note') };
    }
  },

  addFolder: async (
    targetId: number,
    userId: number,
    folderId: number
  ): Promise<{ success: boolean; data?: ExamTargetDetail; message?: string }> => {
    try {
      const { target } = await testPrepEndpoints.addFolder(targetId, userId, folderId);
      return { success: true, data: target };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Failed to add folder') };
    }
  },

  removeContent: async (
    targetId: number,
    userId: number,
    contentId: number
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      await testPrepEndpoints.removeContent(targetId, userId, contentId);
      return { success: true };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Failed to remove note') };
    }
  },

  removeFolder: async (
    targetId: number,
    userId: number,
    folderId: number
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      await testPrepEndpoints.removeFolder(targetId, userId, folderId);
      return { success: true };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Failed to remove folder') };
    }
  },

  startEvaluate: async (
    targetId: number,
    body: { userId: number; evalType: string; questionCount: number; difficulty: string }
  ): Promise<{ success: boolean; data?: ExamEvalSession; message?: string }> => {
    try {
      const { session } = await testPrepEndpoints.startEvaluate(targetId, body);
      return { success: true, data: session };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Failed to start practice') };
    }
  },

  listSessions: async (
    targetId: number,
    userId: number
  ): Promise<{ success: boolean; data?: ExamEvalSessionSummary[]; message?: string }> => {
    try {
      const { sessions } = await testPrepEndpoints.listSessions(targetId, userId);
      return { success: true, data: sessions };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Failed to load tests') };
    }
  },

  getSession: async (
    sessionId: number,
    userId: number
  ): Promise<{ success: boolean; data?: ExamEvalSession; message?: string }> => {
    try {
      const { session } = await testPrepEndpoints.getSession(sessionId, userId);
      return { success: true, data: session };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Failed to open test') };
    }
  },

  submitEvaluate: async (
    sessionId: number,
    userId: number,
    answers: Array<{ index: number; answer: string }>
  ): Promise<{ success: boolean; data?: ExamEvalSession; message?: string }> => {
    try {
      const { session } = await testPrepEndpoints.submitEvaluate(sessionId, userId, answers);
      return { success: true, data: session };
    } catch (error) {
      return { success: false, message: errorMessage(error, 'Failed to submit test') };
    }
  },
};
