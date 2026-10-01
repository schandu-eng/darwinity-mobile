import { useEffect, useState } from 'react';
import { subscribeTourCompleted } from './featureNewEvents';
import { isTourCompleted } from './tourStorage';

/** True once `tourId` has been completed (including later in this session). */
export default function useTourCompleted(tourId: string) {
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!tourId) return undefined;

    let cancelled = false;

    void isTourCompleted(tourId).then((value) => {
      if (!cancelled) setCompleted(value);
    });

    const unsubscribe = subscribeTourCompleted((completedTourId) => {
      if (completedTourId === tourId) {
        setCompleted(true);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [tourId]);

  return completed;
}
