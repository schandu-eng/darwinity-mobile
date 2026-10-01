import { createContext } from 'react';
import type { FeatureTourContextValue } from './types';

export const FeatureTourContext = createContext<FeatureTourContextValue | null>(null);
