import React from 'react';
import { ListChecks } from '@/icons';
import ProFeatureGateCard from '@/components/study-hub/ProFeatureGateCard';

type Props = {
  children?: React.ReactNode;
  compact?: boolean;
};

const QuizProGate: React.FC<Props> = ({ children, compact = false }) => (
  <ProFeatureGateCard
    icon={ListChecks}
    compact={compact}
    title="Continue with Pro"
    body="You've used your 5 free questions on this note. Upgrade to keep quizzing."
  >
    {children}
  </ProFeatureGateCard>
);

export default QuizProGate;
