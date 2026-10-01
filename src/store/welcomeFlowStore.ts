import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETED_KEY = '@darwinity_onboarding_completed';
const ONBOARDING_CURRENT_STEP_KEY = '@darwinity_onboarding_current_step';
const ONBOARDING_STEP_SCHEMA_KEY = '@darwinity_onboarding_step_schema';

const ONBOARDING_STEP_SCHEMA = '5';

interface OnboardingState {
  hasSeenOnboarding: boolean;
  currentStep: number;
  isLoading: boolean;
  setHasSeenOnboarding: (value: boolean) => Promise<void>;
  setCurrentStep: (step: number) => Promise<void>;
  initializeOnboarding: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  hasSeenOnboarding: false,
  currentStep: 0,
  isLoading: true,
  setHasSeenOnboarding: async (value: boolean) => {

    if (!value) {
      await AsyncStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    }
    set({ hasSeenOnboarding: value });
  },
  setCurrentStep: async (step: number) => {
    await AsyncStorage.multiSet([
      [ONBOARDING_CURRENT_STEP_KEY, JSON.stringify(step)],
      [ONBOARDING_STEP_SCHEMA_KEY, ONBOARDING_STEP_SCHEMA],
    ]);
    set({ currentStep: step });
  },
  initializeOnboarding: async () => {
    try {

      await AsyncStorage.multiRemove([
        ONBOARDING_COMPLETED_KEY,
        ONBOARDING_CURRENT_STEP_KEY,
        ONBOARDING_STEP_SCHEMA_KEY,
      ]);
      set({
        hasSeenOnboarding: false,
        currentStep: 0,
        isLoading: false,
      });
    } catch (error) {
      set({
        hasSeenOnboarding: false,
        currentStep: 0,
        isLoading: false,
      });
    }
  },
  completeOnboarding: async () => {

    await AsyncStorage.multiRemove([
      ONBOARDING_COMPLETED_KEY,
      ONBOARDING_CURRENT_STEP_KEY,
      ONBOARDING_STEP_SCHEMA_KEY,
    ]);
    set({ hasSeenOnboarding: true, currentStep: 0 });
  },
  resetOnboarding: async () => {
    await AsyncStorage.multiRemove([
      ONBOARDING_COMPLETED_KEY,
      ONBOARDING_CURRENT_STEP_KEY,
      ONBOARDING_STEP_SCHEMA_KEY,
    ]);
    set({ hasSeenOnboarding: false, currentStep: 0 });
  },
}));
