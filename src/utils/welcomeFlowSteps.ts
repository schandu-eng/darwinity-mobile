export const ONBOARDING_STEPS = ['Welcome', 'Trail', 'Arrive'] as const;

export type OnboardingStepName = (typeof ONBOARDING_STEPS)[number];

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length;

export const ONBOARDING_FINAL_STEP = ONBOARDING_STEP_COUNT - 1;

export const onboardingStepIndex = (name: OnboardingStepName): number =>
  ONBOARDING_STEPS.indexOf(name);

export const onboardingProgress = (name: OnboardingStepName): number =>
  (onboardingStepIndex(name) + 1) / ONBOARDING_STEP_COUNT;

export const migrateLegacyOnboardingStep = (step: number): number => {
  if (!Number.isFinite(step) || step < 0) return 0;
  if (step === 0) return 0;
  if (step === 4 || step === 6 || step === 8 || step >= 7) return ONBOARDING_FINAL_STEP;
  return onboardingStepIndex('Trail');
};
