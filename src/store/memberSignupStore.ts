import { create } from 'zustand';

export interface OnboardingEnums {
  onboardingCategories: string[];
  graduateProgramTypes: string[];
  professionalSectors: string[];
  acquisitionSources: string[];
}

export interface OnboardingDraft {
  email: string;
  token?: string;
  name: string;
  phoneNo?: string;
  countryCode?: string;
  country?: string;
  preferredLanguage?: string;
  category: string;
  undergraduateCourse?: string | null;
  graduateProgram?: string | null;
  graduateProgramOtherDesc?: string | null;
  graduateCourse?: string | null;
  middleSchoolInterest?: string | null;
  highSchoolInterest?: string | null;
  professionalSector?: string | null;
  professionalSectorOtherDesc?: string | null;
  otherBackgroundDesc?: string | null;
  acquisitionSource?: string | null;
}

interface OnboardingDraftState extends OnboardingDraft {
  enums: OnboardingEnums | null;
  setPersonalInfo: (payload: {
    email: string;
    token?: string;
    name: string;
    phoneNo?: string;
    countryCode?: string;
    country?: string;
  }) => void;
  setCategory: (category: string) => void;
  setDetails: (payload: Partial<OnboardingDraft>) => void;
  setAcquisition: (acquisitionSource: string | null) => void;
  setEnums: (enums: OnboardingEnums) => void;
  reset: () => void;
}

const initialDraft: OnboardingDraft = {
  email: '',
  token: undefined,
  name: '',
  phoneNo: '',
  countryCode: '',
  country: '',
  preferredLanguage: 'en',
  category: '',
  undergraduateCourse: null,
  graduateProgram: null,
  graduateProgramOtherDesc: null,
  graduateCourse: null,
  middleSchoolInterest: null,
  highSchoolInterest: null,
  professionalSector: null,
  professionalSectorOtherDesc: null,
  otherBackgroundDesc: null,
  acquisitionSource: null,
};

export const useOnboardingDraftStore = create<OnboardingDraftState>((set) => ({
  ...initialDraft,
  enums: null,
  setPersonalInfo: (payload) => set((state) => ({
    ...state,
    email: payload.email,
    token: payload.token,
    name: payload.name,
    phoneNo: payload.phoneNo ?? state.phoneNo,
    countryCode: payload.countryCode ?? state.countryCode,
    country: payload.country ?? state.country,
  })),
  setCategory: (category) => set({ category }),
  setDetails: (payload) => set((state) => ({ ...state, ...payload })),
  setAcquisition: (acquisitionSource) => set({ acquisitionSource }),
  setEnums: (enums) => set({ enums }),
  reset: () => set({ ...initialDraft, enums: null }),
}));
