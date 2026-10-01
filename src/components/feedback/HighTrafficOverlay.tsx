import React, { useCallback, useEffect, useState } from 'react';
import { clearHighTraffic, probeApiReady, subscribeHighTraffic } from '@/utils/highTraffic';
import { API_BASE_URL } from '@/utils/constants';
import AlertModal from '@/components/ui/AlertModal';

export default function HighTrafficOverlay() {
  const [visible, setVisible] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => subscribeHighTraffic(setVisible), []);

  const onRetry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const ready = await probeApiReady(API_BASE_URL);
      if (ready) clearHighTraffic();
    } finally {
      setRetrying(false);
    }
  }, [retrying]);

  return (
    <AlertModal
      visible={visible}
      title="We're getting a lot of traffic"
      message="Please come back in a few minutes. Your notes are safe."
      actionText={retrying ? 'Checking…' : 'Try again'}
      onClose={onRetry}
    />
  );
}
