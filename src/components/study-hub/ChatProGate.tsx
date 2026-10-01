import React from 'react';
import { MessageCircle } from '@/icons';
import ProFeatureGateCard from '@/components/study-hub/ProFeatureGateCard';

type Props = {
  children?: React.ReactNode;
};

const ChatProGate: React.FC<Props> = ({ children }) => (
  <ProFeatureGateCard
    icon={MessageCircle}
    title="AI chat is a Pro feature"
    body="Ask questions about your notes and get answers grounded in what you uploaded. Included with Pro."
  >
    {children}
  </ProFeatureGateCard>
);

export default ChatProGate;
