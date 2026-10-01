import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { FeatureTourContext } from './FeatureTourContext';
import OnboardingTourOverlay from './OnboardingTourOverlay';
import { isTourCompleted, markTourCompleted } from './tourStorage';
import type { AnchorView, TourStep } from './types';

type Props = {
  tourId: string;
  steps?: TourStep[];
  autoStart?: boolean;
  autoStartDelay?: number;
  onComplete?: () => void;
  onSkip?: () => void;
  onStepChange?: (step: TourStep, index: number) => void;
  children: React.ReactNode;
};

export default function OnboardingTourProvider({
  tourId,
  steps = [],
  autoStart = false,
  autoStartDelay = 0,
  onComplete,
  onSkip,
  onStepChange,
  children,
}: Props) {
  const anchorsRef = useRef(new Map<string, React.RefObject<AnchorView | null>>());
  const [isActive, setIsActive] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [storageReady, setStorageReady] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);

  const currentStep = steps[currentIndex] ?? null;
  const totalSteps = steps.length;

  const registerAnchor = useCallback((stepId: string, elementRef: React.RefObject<AnchorView | null>) => {
    if (!stepId) return;
    anchorsRef.current.set(stepId, elementRef);
  }, []);

  const unregisterAnchor = useCallback((stepId: string) => {
    if (!stepId) return;
    anchorsRef.current.delete(stepId);
  }, []);

  const getAnchorRef = useCallback((stepId: string) => {
    return anchorsRef.current.get(stepId) ?? null;
  }, []);

  const finishTour = useCallback(async (reason: 'complete' | 'skip') => {
    setIsActive(false);
    setCurrentIndex(0);
    await markTourCompleted(tourId);

    if (reason === 'complete') {
      onComplete?.();
    } else {
      onSkip?.();
    }
  }, [onComplete, onSkip, tourId]);

  const start = useCallback(() => {
    if (!steps.length) return;
    setCurrentIndex(0);
    setIsActive(true);
  }, [steps.length]);

  const stop = useCallback(() => {
    setIsActive(false);
    setCurrentIndex(0);
  }, []);

  const next = useCallback(() => {
    if (currentIndex >= totalSteps - 1) {
      void finishTour('complete');
      return;
    }
    setCurrentIndex((index) => index + 1);
  }, [currentIndex, finishTour, totalSteps]);

  const prev = useCallback(() => {
    setCurrentIndex((index) => Math.max(0, index - 1));
  }, []);

  const skip = useCallback(() => {
    void finishTour('skip');
  }, [finishTour]);

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= totalSteps) return;
    setCurrentIndex(index);
    setIsActive(true);
  }, [totalSteps]);

  useEffect(() => {
    let cancelled = false;

    setStorageReady(false);
    void (async () => {
      const completed = await isTourCompleted(tourId);
      if (cancelled) return;
      setAlreadyCompleted(completed);
      setStorageReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [tourId]);

  useEffect(() => {
    if (!autoStart || !storageReady || alreadyCompleted || !tourId || !steps.length) {
      return undefined;
    }

    const timer = setTimeout(() => {
      start();
    }, autoStartDelay);

    return () => clearTimeout(timer);
  }, [alreadyCompleted, autoStart, autoStartDelay, start, steps.length, storageReady, tourId]);

  useEffect(() => {
    if (!isActive || !currentStep) return;
    onStepChange?.(currentStep, currentIndex);
  }, [currentIndex, currentStep, isActive, onStepChange]);

  const value = useMemo(() => ({
    tourId,
    steps,
    isActive,
    currentIndex,
    currentStep,
    totalSteps,
    start,
    stop,
    next,
    prev,
    skip,
    goTo,
    registerAnchor,
    unregisterAnchor,
    getAnchorRef,
  }), [
    tourId,
    steps,
    isActive,
    currentIndex,
    currentStep,
    totalSteps,
    start,
    stop,
    next,
    prev,
    skip,
    goTo,
    registerAnchor,
    unregisterAnchor,
    getAnchorRef,
  ]);

  return (
    <FeatureTourContext.Provider value={value}>
      <View style={styles.host} collapsable={false}>
        {children}
        <OnboardingTourOverlay />
      </View>
    </FeatureTourContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
});
