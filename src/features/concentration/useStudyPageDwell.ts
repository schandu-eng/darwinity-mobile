import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useAuthStore } from '@/store';
import { focusEndpoints } from '@/api/endpoints/concentration';
import {
  DWELL_HEARTBEAT_MS,
  DWELL_IDLE_MS,
  clearDwellQueue,
  finalizeOpenSlice,
  loadDwellQueue,
  mergeEvents,
  saveDwellQueue,
  subscribeStudyDwellActivity,
  type DwellEvent,
  type OpenSlice,
} from './dwellQueue';

export {
  DWELL_HEARTBEAT_MS,
  DWELL_IDLE_MS,
  markStudyDwellActivity,
} from './dwellQueue';

export const STUDY_PAGE_LABELS: Record<string, string> = {
  notes: 'Notes',
  mindmap: 'Mind map',
  cards: 'Cards',
  quiz: 'Quiz',
  games: 'Games',
  podcast: 'Podcast',
  chat: 'Chat',
};

const PAGE_TYPE_ALIASES: Record<string, string> = {
  summary: 'notes',
  board: 'mindmap',
  flowchart: 'mindmap',
  flashcards: 'cards',
  quizzes: 'quiz',
};

const PAGE_TYPES = new Set(Object.keys(STUDY_PAGE_LABELS));

export function normalizeStudyPageType(raw: string | null | undefined): string | null {
  const token = String(raw || '').trim().toLowerCase();
  const mapped = PAGE_TYPE_ALIASES[token] || token;
  return PAGE_TYPES.has(mapped) ? mapped : null;
}

export function useStudyPageDwell(opts: {
  contentId?: string | number | null;
  pageType?: string | null;
  title?: string | null;
  enabled?: boolean;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const focused = useIsFocused();
  const pageType = normalizeStudyPageType(opts.pageType);
  const contentId = opts.contentId != null ? String(opts.contentId) : '';
  const enabled = Boolean(opts.enabled !== false && userId && focused && contentId && pageType);

  const sliceRef = useRef<OpenSlice | null>(null);
  const lastInputRef = useRef(Date.now());
  const idleRef = useRef(false);
  const bufferRef = useRef<DwellEvent[]>([]);
  const sendingRef = useRef(false);
  const recoveredRef = useRef(false);
  const enabledRef = useRef(enabled);
  const pageRef = useRef({ contentId, pageType, title: opts.title || undefined, userId });
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  enabledRef.current = enabled;
  pageRef.current = { contentId, pageType, title: opts.title || undefined, userId };

  const persist = () => {
    const uid = pageRef.current.userId;
    if (!uid) return;
    void saveDwellQueue({
      userId: uid,
      events: bufferRef.current,
      openSlice: sliceRef.current
        ? { ...sliceRef.current, lastInput: lastInputRef.current }
        : null,
      updatedAt: Date.now(),
    });
  };

  const persistRef = useRef(persist);
  persistRef.current = persist;
  const closeOnIdleRef = useRef(() => {});

  useEffect(() => {
    const bump = () => {
      lastInputRef.current = Date.now();
      const wasIdle = idleRef.current;
      idleRef.current = false;
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        idleRef.current = true;
        closeOnIdleRef.current();
      }, DWELL_IDLE_MS);
      if (wasIdle && enabledRef.current) {
        const page = pageRef.current;
        if (!sliceRef.current && page.contentId && page.pageType) {
          sliceRef.current = {
            contentId: page.contentId,
            pageType: page.pageType,
            title: page.title,
            wallStart: Date.now(),
            lastInput: lastInputRef.current,
          };
          persistRef.current();
        }
      }
    };
    bump();
    const unsub = subscribeStudyDwellActivity(bump);
    return () => {
      unsub();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    lastInputRef.current = Date.now();
    idleRef.current = false;
  }, [contentId, pageType, focused]);

  useEffect(() => {
    const flush = async () => {
      persistRef.current();
      const uid = pageRef.current.userId;
      if (!uid || bufferRef.current.length === 0 || sendingRef.current) return;
      const batch = bufferRef.current.slice();
      sendingRef.current = true;
      try {
        await focusEndpoints.ingestDwell(uid, batch);
        const sent = new Set(batch.map((e) => e.client_event_id));
        bufferRef.current = bufferRef.current.filter((e) => !sent.has(e.client_event_id));
        persistRef.current();
        if (bufferRef.current.length === 0 && !sliceRef.current) {
          await clearDwellQueue();
        }
      } catch {
        /* durable queue keeps the batch */
      } finally {
        sendingRef.current = false;
      }
    };

    const closeSlice = (idle = false) => {
      const slice = sliceRef.current;
      sliceRef.current = null;
      if (slice) slice.lastInput = lastInputRef.current;
      const ev = finalizeOpenSlice(slice, { now: Date.now(), idle });
      if (ev) bufferRef.current = mergeEvents(bufferRef.current, [ev]);
      persistRef.current();
    };
    closeOnIdleRef.current = () => closeSlice(true);

    const openSlice = () => {
      const page = pageRef.current;
      if (!enabledRef.current || !page.pageType || !page.contentId) return;
      if (idleRef.current) return;
      if (Date.now() - lastInputRef.current > DWELL_IDLE_MS) return;
      if (sliceRef.current) return;
      sliceRef.current = {
        contentId: page.contentId,
        pageType: page.pageType,
        title: page.title,
        wallStart: Date.now(),
        lastInput: lastInputRef.current,
      };
      persistRef.current();
    };

    const recover = async () => {
      const uid = pageRef.current.userId;
      if (!uid || recoveredRef.current) return;
      recoveredRef.current = true;
      const stored = await loadDwellQueue();
      if (stored.userId && String(stored.userId) !== String(uid)) {
        await clearDwellQueue();
        return;
      }
      bufferRef.current = mergeEvents(bufferRef.current, stored.events);
      const recovered = finalizeOpenSlice(stored.openSlice, { now: Date.now() });
      if (recovered) bufferRef.current = mergeEvents(bufferRef.current, [recovered]);
      persistRef.current();
    };

    let cancelled = false;
    void recover().then(() => {
      if (cancelled) return;
      openSlice();
      void flush();
    });

    const tick = () => {
      if (idleRef.current) {
        closeSlice(true);
        return;
      }
      closeSlice(false);
      openSlice();
      if (bufferRef.current.length >= 4) void flush();
    };

    const interval = setInterval(tick, DWELL_HEARTBEAT_MS);
    const onApp = (next: AppStateStatus) => {
      if (next === 'active') {
        lastInputRef.current = Date.now();
        idleRef.current = false;
        openSlice();
        void flush();
      } else {
        closeSlice(false);
        void flush();
      }
    };
    const sub = AppState.addEventListener('change', onApp);

    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
      closeSlice(false);
      persistRef.current();
      void flush();
    };
  }, [enabled, contentId, pageType]);
}

export function StudyPageDwell(props: {
  contentId?: string | number | null;
  pageType?: string | null;
  title?: string | null;
}) {
  useStudyPageDwell(props);
  return null;
}
