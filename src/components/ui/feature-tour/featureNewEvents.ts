type DismissListener = (featureId: string) => void;
type TourCompletedListener = (tourId: string) => void;

const dismissListeners = new Set<DismissListener>();
const tourCompletedListeners = new Set<TourCompletedListener>();

export function subscribeFeatureNewDismiss(listener: DismissListener): () => void {
  dismissListeners.add(listener);
  return () => {
    dismissListeners.delete(listener);
  };
}

export function emitFeatureNewDismiss(featureId: string): void {
  dismissListeners.forEach((listener) => listener(featureId));
}

export function subscribeTourCompleted(listener: TourCompletedListener): () => void {
  tourCompletedListeners.add(listener);
  return () => {
    tourCompletedListeners.delete(listener);
  };
}

export function emitTourCompleted(tourId: string): void {
  tourCompletedListeners.forEach((listener) => listener(tourId));
}
