import React, { useEffect, useRef, useState } from 'react';
import FeedbackModal from './FeedbackModal';
import { useFeedbackPromptStore } from '@/store/feedbackPromptStore';

const CHECK_INTERVAL_MS = 60 * 1000;
const DELAY_MS = 5 * 60 * 1000;

const ContentFeedbackChecker: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const initialize = useFeedbackPromptStore((state) => state.initialize);
  const contentPromptShown = useFeedbackPromptStore((state) => state.contentPromptShown);
  const contentViewerOpenedAt = useFeedbackPromptStore((state) => state.contentViewerOpenedAt);
  const markContentPromptShown = useFeedbackPromptStore((state) => state.markContentPromptShown);
  const clearStudyMaterialPageOpened = useFeedbackPromptStore((state) => state.clearStudyMaterialPageOpened);
  const lastPromptedAtRef = useRef<number | null>(null);

  useEffect(() => {
    initialize().catch(() => {});
  }, [initialize]);

  useEffect(() => {
    const check = async () => {
      if (contentPromptShown) return;
      const openedAt = contentViewerOpenedAt;
      if (!openedAt || Date.now() - openedAt < DELAY_MS) return;
      if (lastPromptedAtRef.current && Date.now() - lastPromptedAtRef.current < CHECK_INTERVAL_MS) return;
      lastPromptedAtRef.current = Date.now();
      await markContentPromptShown();
      await clearStudyMaterialPageOpened();
      setShowModal(true);
    };

    const id = setInterval(() => {
      check().catch(() => {});
    }, CHECK_INTERVAL_MS);
    check().catch(() => {});

    return () => clearInterval(id);
  }, [contentPromptShown, contentViewerOpenedAt, markContentPromptShown, clearStudyMaterialPageOpened]);

  return (
    <FeedbackModal
      visible={showModal}
      onClose={() => setShowModal(false)}
      source="mobile_after_content"
    />
  );
};

export default ContentFeedbackChecker;
