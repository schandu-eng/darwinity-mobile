import { useContext } from 'react';
import { FeatureTourContext } from './FeatureTourContext';

export default function useFeatureTour() {
  const context = useContext(FeatureTourContext);
  if (!context) {
    throw new Error('useFeatureTour must be used within a OnboardingTourProvider');
  }
  return context;
}
