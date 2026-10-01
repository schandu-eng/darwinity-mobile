import { create } from 'zustand';

export const INTAKE_FAILURE_SUPPORT_HINT_COPY = 'Contact support here';

interface IntakeFailureSupportHintState {
  hintVisible: boolean;
  showIntakeFailureSupportHint: () => void;
  hideIntakeFailureSupportHint: () => void;
}

export const useIntakeFailureSupportHintStore = create<IntakeFailureSupportHintState>((set) => ({
  hintVisible: false,
  showIntakeFailureSupportHint: () => set({ hintVisible: true }),
  hideIntakeFailureSupportHint: () => set({ hintVisible: false }),
}));

export function notifyIntakeFailureSupportHint() {
  useIntakeFailureSupportHintStore.getState().showIntakeFailureSupportHint();
}
