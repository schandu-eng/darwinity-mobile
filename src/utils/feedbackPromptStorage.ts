import AsyncStorage from '@react-native-async-storage/async-storage';

const FEEDBACK_STATE_KEY = '@darwinity_feedback_state';

interface FeedbackState {
  promptsShown: Record<string, boolean>;
  contentOpenedAt: Record<string, number | null>;
}

const readState = async (): Promise<FeedbackState> => {
  try {
    const raw = await AsyncStorage.getItem(FEEDBACK_STATE_KEY);
    if (raw) return JSON.parse(raw) as FeedbackState;
  } catch {}
  return { promptsShown: {}, contentOpenedAt: {} };
};

const writeState = async (state: FeedbackState): Promise<void> => {
  try {
    await AsyncStorage.setItem(FEEDBACK_STATE_KEY, JSON.stringify(state));
  } catch {}
};

export const getFeedbackPromptShown = async (type: string, platform: string): Promise<boolean> => {
  const state = await readState();
  return state.promptsShown[`${type}_${platform}`] === true;
};

export const setFeedbackPromptShown = async (type: string, platform: string): Promise<void> => {
  const state = await readState();
  state.promptsShown[`${type}_${platform}`] = true;
  await writeState(state);
};

export const getStudyMaterialPageOpenedAt = async (platform: string): Promise<number | null> => {
  const state = await readState();
  return state.contentOpenedAt[platform] ?? null;
};

export const setStudyMaterialPageOpenedAt = async (platform: string): Promise<void> => {
  const state = await readState();
  state.contentOpenedAt[platform] = Date.now();
  await writeState(state);
};

export const clearStudyMaterialPageOpenedAt = async (platform: string): Promise<void> => {
  const state = await readState();
  state.contentOpenedAt[platform] = null;
  await writeState(state);
};
