import { create } from 'zustand';
import {
  getStudyMaterialPageOpenedAt,
  getFeedbackPromptShown,
  setStudyMaterialPageOpenedAt,
  setFeedbackPromptShown,
  clearStudyMaterialPageOpenedAt,
} from '@/utils/feedbackPromptStorage';

interface FeedbackPromptState {
  isInitialized: boolean;
  contentPromptShown: boolean;
  contentViewerOpenedAt: number | null;
  initialize: () => Promise<void>;
  markContentViewed: () => Promise<void>;
  markContentPromptShown: () => Promise<void>;
  clearStudyMaterialPageOpened: () => Promise<void>;
}

const PLATFORM = 'mobile';

export const useFeedbackPromptStore = create<FeedbackPromptState>((set, get) => ({
  isInitialized: false,
  contentPromptShown: false,
  contentViewerOpenedAt: null,
  initialize: async () => {
    if (get().isInitialized) return;
    const [shown, openedAt] = await Promise.all([
      getFeedbackPromptShown('content', PLATFORM),
      getStudyMaterialPageOpenedAt(PLATFORM),
    ]);
    set({
      isInitialized: true,
      contentPromptShown: shown,
      contentViewerOpenedAt: openedAt,
    });
  },
  markContentViewed: async () => {
    const now = Date.now();
    set({ contentViewerOpenedAt: now });
    await setStudyMaterialPageOpenedAt(PLATFORM);
  },
  markContentPromptShown: async () => {
    set({ contentPromptShown: true });
    await setFeedbackPromptShown('content', PLATFORM);
  },
  clearStudyMaterialPageOpened: async () => {
    set({ contentViewerOpenedAt: null });
    await clearStudyMaterialPageOpenedAt(PLATFORM);
  },
}));
