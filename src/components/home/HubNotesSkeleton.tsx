import React from 'react';
import { PanelSkeleton } from '@/components/ui/skeleton/PanelSkeleton';

type Props = {
  variant?: 'list' | 'grid';
};

/** Home My Notes loading — same chrome as phone-web HubNotesLibrary / PanelSkeleton. */
export const HubNotesSkeleton: React.FC<Props> = ({ variant = 'list' }) => (
  <PanelSkeleton
    variant={variant}
    label="Loading notes"
    hideHeader
    style={{ paddingHorizontal: 0, paddingTop: 8, paddingBottom: 0 }}
  />
);
