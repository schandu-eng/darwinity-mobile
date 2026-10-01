import { useEffect, useRef, useState } from 'react';
import apiClient from '@/api/client';
import { JOB_POLL_BASE_MS, startAdaptivePoller } from '@/utils/jobPollSchedule';

export type StreamedNote = {
  id: number;
  order: number;
  title: string;
  content: string;
};

const buildContiguousPrefix = (byOrder: Map<number, StreamedNote>): StreamedNote[] =>
  [...byOrder.keys()]
    .sort((a, b) => a - b)
    .map((order) => byOrder.get(order) as StreamedNote);

export const useStreamingNotes = (
  contentId: number | null,
  active: boolean
): StreamedNote[] => {
  const [revealedNotes, setRevealedNotes] = useState<StreamedNote[]>([]);
  const byOrderRef = useRef<Map<number, StreamedNote>>(new Map());
  const cursorRef = useRef(0);

  useEffect(() => {
    if (!active || !contentId) return undefined;

    byOrderRef.current = new Map();
    cursorRef.current = 0;
    setRevealedNotes([]);

    let cancelled = false;

    const stop = startAdaptivePoller(
      async () => {
        if (cancelled) return { done: true };
        try {
          const res = await apiClient.get<{ notes?: StreamedNote[] }>(
            `/api/v1/materials/content/${contentId}/notes/delta`,
            { params: { after_id: cursorRef.current } }
          );
          if (cancelled) return { done: true };

          const incoming = res.data?.notes ?? [];
          if (incoming.length === 0) return { progressed: false };

          for (const note of incoming) {
            byOrderRef.current.set(note.order, note);
            if (note.id > cursorRef.current) cursorRef.current = note.id;
          }
          setRevealedNotes(buildContiguousPrefix(byOrderRef.current));
          return { progressed: true };
        } catch {
          return { progressed: false };
        }
      },
      { baseMs: JOB_POLL_BASE_MS }
    );

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, contentId]);

  return revealedNotes;
};
