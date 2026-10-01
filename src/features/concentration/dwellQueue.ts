import AsyncStorage from '@react-native-async-storage/async-storage';

export const DWELL_HEARTBEAT_MS = 15_000;
export const DWELL_IDLE_MS = 90_000;
export const DWELL_MIN_MS = 250;
export const DWELL_MAX_MS = 120_000;
export const DWELL_QUEUE_KEY = '@darwinity_dwell_queue_v1';
export const DWELL_QUEUE_MAX = 80;

export type DwellEvent = {
  client_event_id: string;
  content_id: string;
  page_type: string;
  content_title?: string;
  st: number;
  et: number;
  dt: number;
  pt: string;
  it?: number;
};

export type OpenSlice = {
  contentId: string;
  pageType: string;
  title?: string;
  wallStart: number;
  lastInput: number;
};

export type DwellQueueState = {
  userId: string | number | null;
  events: DwellEvent[];
  openSlice: OpenSlice | null;
  updatedAt: number;
};

function emptyState(userId: string | number | null = null): DwellQueueState {
  return { userId, events: [], openSlice: null, updatedAt: Date.now() };
}

export function newDwellEventId(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (globalCrypto?.randomUUID) return globalCrypto.randomUUID();
  return `dwell-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isQueuedEvent(ev: any): ev is DwellEvent {
  return (
    ev &&
    typeof ev.client_event_id === 'string' &&
    ev.client_event_id.length >= 8 &&
    ev.content_id &&
    ev.page_type &&
    Number.isFinite(Number(ev.st)) &&
    Number.isFinite(Number(ev.et)) &&
    Number.isFinite(Number(ev.dt))
  );
}

function isOpenSlice(slice: any): slice is OpenSlice {
  return Boolean(slice && slice.contentId && slice.pageType && Number.isFinite(Number(slice.wallStart)));
}

export function finalizeOpenSlice(
  slice: OpenSlice | null | undefined,
  { now = Date.now(), idle = false }: { now?: number; idle?: boolean } = {}
): DwellEvent | null {
  if (!isOpenSlice(slice)) return null;
  const wallStart = Number(slice.wallStart);
  const lastInput = Number(slice.lastInput) || wallStart;
  const endWall = Math.min(now, lastInput + DWELL_IDLE_MS, wallStart + DWELL_MAX_MS);
  const dt = Math.round(endWall - wallStart);
  if (dt < DWELL_MIN_MS) return null;
  return {
    client_event_id: newDwellEventId(),
    content_id: String(slice.contentId),
    page_type: slice.pageType,
    content_title: slice.title || undefined,
    st: wallStart,
    et: wallStart + dt,
    dt,
    pt: slice.pageType,
    it: idle || now - lastInput >= DWELL_IDLE_MS ? 0 : 1,
  };
}

export function mergeEvents(existing: DwellEvent[] | undefined, incoming: DwellEvent[] | undefined): DwellEvent[] {
  const byId = new Map<string, DwellEvent>();
  for (const ev of [...(existing || []), ...(incoming || [])]) {
    if (!isQueuedEvent(ev)) continue;
    byId.set(ev.client_event_id, ev);
  }
  return Array.from(byId.values()).slice(-DWELL_QUEUE_MAX);
}

export async function loadDwellQueue(): Promise<DwellQueueState> {
  try {
    const raw = await AsyncStorage.getItem(DWELL_QUEUE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const events = Array.isArray(parsed?.events) ? parsed.events.filter(isQueuedEvent) : [];
    return {
      userId: parsed?.userId ?? null,
      events,
      openSlice: isOpenSlice(parsed?.openSlice) ? parsed.openSlice : null,
      updatedAt: Number(parsed?.updatedAt) || Date.now(),
    };
  } catch {
    return emptyState();
  }
}

export async function saveDwellQueue(state: DwellQueueState): Promise<void> {
  try {
    await AsyncStorage.setItem(
      DWELL_QUEUE_KEY,
      JSON.stringify({
        userId: state.userId ?? null,
        events: (state.events || []).slice(-DWELL_QUEUE_MAX),
        openSlice: state.openSlice || null,
        updatedAt: Date.now(),
      })
    );
  } catch {
    /* ignore */
  }
}

export async function clearDwellQueue(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DWELL_QUEUE_KEY);
  } catch {
    /* ignore */
  }
}

const activityListeners = new Set<() => void>();

export function markStudyDwellActivity(): void {
  activityListeners.forEach((fn) => fn());
}

export function subscribeStudyDwellActivity(fn: () => void): () => void {
  activityListeners.add(fn);
  return () => {
    activityListeners.delete(fn);
  };
}
