export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export type TourStep = {
  id: string;
  title: string;
  body?: string;
  placement?: TourPlacement;
  spotlightPadding?: number;
  
  tab?: string;
};

export type MeasuredRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

export type AnchorView = {
  measureInWindow?: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};

export type FeatureTourContextValue = {
  tourId: string;
  steps: TourStep[];
  isActive: boolean;
  currentIndex: number;
  currentStep: TourStep | null;
  totalSteps: number;
  start: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  goTo: (index: number) => void;
  registerAnchor: (stepId: string, ref: React.RefObject<AnchorView | null>) => void;
  unregisterAnchor: (stepId: string) => void;
  getAnchorRef: (stepId: string) => React.RefObject<AnchorView | null> | null;
};
