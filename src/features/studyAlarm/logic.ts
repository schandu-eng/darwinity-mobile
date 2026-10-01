export const STUDY_ALARM_STORAGE_KEY = '@darwinity_study_alarm';
export const STUDY_ALARM_CACHE_KEY = '@darwinity_study_alarm_cache';
export const STUDY_ALARM_GOAL = 10;
export const MAX_STUDY_ALARMS = 10;
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type StudyAlarmMode = 'quiz' | 'cards';

export type StudyAlarmPrefs = {
  enabled: boolean;
  hour: number;
  minute: number;
  days: number[];
  mode: StudyAlarmMode;
  contentId: number | null;
  contentTitle: string;
};

export type StudyAlarm = StudyAlarmPrefs & { id: string };

export type StudyAlarmStore = {
  alarms: StudyAlarm[];
  scheduledId: string | null;
};

export const DEFAULT_STUDY_ALARM_PREFS: StudyAlarmPrefs = {
  enabled: false,
  hour: 7,
  minute: 0,
  days: [...ALL_DAYS],
  mode: 'quiz',
  contentId: null,
  contentTitle: '',
};

export type CachedQuizItem = {
  id: number;
  question: string;
  question_type: string;
  options: string[];
  correct_answer: string;
  explanation: string | null;
};

export type CachedCardItem = {
  id: number;
  front: string;
  back: string;
};

export type StudyAlarmCache = {
  mode: StudyAlarmMode;
  contentId: number;
  quizzes: CachedQuizItem[];
  cards: CachedCardItem[];
  savedAt: number;
};

export function clampHour(value: number): number {
  if (!Number.isFinite(value)) return 7;
  return Math.min(23, Math.max(0, Math.floor(value)));
}

export function clampMinute(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(59, Math.max(0, Math.floor(value)));
}

export function normalizeDays(days: number[]): number[] {
  const unique = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
  unique.sort((a, b) => a - b);
  return unique.length ? unique : [...ALL_DAYS];
}

export function parseStudyAlarmPrefs(raw: string | null): StudyAlarmPrefs {
  if (!raw) return { ...DEFAULT_STUDY_ALARM_PREFS, days: [...ALL_DAYS] };
  try {
    const parsed = JSON.parse(raw) as Partial<StudyAlarmPrefs>;
    return {
      enabled: Boolean(parsed.enabled),
      hour: clampHour(Number(parsed.hour)),
      minute: clampMinute(Number(parsed.minute)),
      days: normalizeDays(Array.isArray(parsed.days) ? parsed.days.map(Number) : [...ALL_DAYS]),
      mode: parsed.mode === 'cards' ? 'cards' : 'quiz',
      contentId: typeof parsed.contentId === 'number' ? parsed.contentId : null,
      contentTitle: typeof parsed.contentTitle === 'string' ? parsed.contentTitle : '',
    };
  } catch {
    return { ...DEFAULT_STUDY_ALARM_PREFS, days: [...ALL_DAYS] };
  }
}

export function computeNextFireAt(
  hour: number,
  minute: number,
  days: number[],
  now = new Date()
): number {
  const allowed = new Set(normalizeDays(days));
  const h = clampHour(hour);
  const m = clampMinute(minute);
  for (let i = 0; i < 8; i += 1) {
    const candidate = new Date(now);
    candidate.setSeconds(0, 0);
    candidate.setHours(h, m, 0, 0);
    candidate.setDate(now.getDate() + i);
    if (i === 0 && candidate.getTime() <= now.getTime()) continue;
    if (allowed.has(candidate.getDay())) return candidate.getTime();
  }
  return now.getTime() + 24 * 60 * 60 * 1000;
}

export function formatAlarmTime(hour: number, minute: number): string {
  const h = clampHour(hour);
  const m = clampMinute(minute);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

export function isTextCard(card: { front?: string; back?: string }): boolean {
  const front = String(card.front || '').trim();
  const back = String(card.back || '').trim();
  if (!front || !back) return false;
  if (
    /!\[[^\]]*\]\([^)]+\)/.test(front) &&
    front.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim().length < 8
  ) {
    return false;
  }
  return true;
}

export function cacheIsReady(cache: StudyAlarmCache | null, prefs: StudyAlarmPrefs): boolean {
  if (
    !cache ||
    !prefs.contentId ||
    cache.contentId !== prefs.contentId ||
    cache.mode !== prefs.mode
  ) {
    return false;
  }
  if (prefs.mode === 'quiz') return cache.quizzes.length >= STUDY_ALARM_GOAL;
  return cache.cards.length >= STUDY_ALARM_GOAL;
}

export function canEnableAlarm(prefs: StudyAlarmPrefs, cache: StudyAlarmCache | null): boolean {
  return Boolean(prefs.contentId) && cacheIsReady(cache, prefs);
}

export function alarmProgressLabel(done: number): string {
  const n = Math.max(0, Math.min(STUDY_ALARM_GOAL, Math.floor(done)));
  return `${n} / ${STUDY_ALARM_GOAL}`;
}

export function isAlarmComplete(done: number): boolean {
  return done >= STUDY_ALARM_GOAL;
}

export function newAlarmId(): string {
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function alarmCacheKey(mode: StudyAlarmMode, contentId: number): string {
  return `${mode}:${contentId}`;
}

export function cacheForAlarm(
  caches: Record<string, StudyAlarmCache>,
  alarm: StudyAlarmPrefs
): StudyAlarmCache | null {
  if (alarm.contentId == null) return null;
  return caches[alarmCacheKey(alarm.mode, alarm.contentId)] ?? null;
}

export function parseStudyAlarm(
  input: Partial<StudyAlarm> | null | undefined,
  fallbackId?: string
): StudyAlarm {
  const prefs = parseStudyAlarmPrefs(JSON.stringify(input ?? {}));
  const id =
    typeof input?.id === 'string' && input.id.trim().length > 0
      ? input.id.trim()
      : fallbackId ?? newAlarmId();
  return { ...prefs, id };
}

export function createStudyAlarm(overrides: Partial<StudyAlarm> = {}): StudyAlarm {
  return parseStudyAlarm({ ...DEFAULT_STUDY_ALARM_PREFS, ...overrides });
}

export function parseStudyAlarmStore(raw: string | null): StudyAlarmStore {
  if (!raw) {
    return { alarms: [createStudyAlarm({ id: 'legacy' })], scheduledId: null };
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (Array.isArray(parsed.alarms)) {
      const alarms = parsed.alarms.map((item, index) =>
        parseStudyAlarm(item as Partial<StudyAlarm>, `alarm-${index}`)
      );
      const scheduledId = typeof parsed.scheduledId === 'string' ? parsed.scheduledId : null;
      return { alarms, scheduledId };
    }
    const alarm = parseStudyAlarm(parsed as Partial<StudyAlarm>, 'legacy');
    return { alarms: [alarm], scheduledId: alarm.enabled ? alarm.id : null };
  } catch {
    return { alarms: [createStudyAlarm({ id: 'legacy' })], scheduledId: null };
  }
}

export function parseStudyAlarmCaches(raw: string | null): Record<string, StudyAlarmCache> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && parsed.byKey && typeof parsed.byKey === 'object') {
      const next: Record<string, StudyAlarmCache> = {};
      for (const [key, value] of Object.entries(parsed.byKey as Record<string, StudyAlarmCache>)) {
        if (value && (value.mode === 'quiz' || value.mode === 'cards') && typeof value.contentId === 'number') {
          next[key] = value;
        }
      }
      return next;
    }
    if (parsed && (parsed.mode === 'quiz' || parsed.mode === 'cards') && typeof parsed.contentId === 'number') {
      const cache = parsed as unknown as StudyAlarmCache;
      return { [alarmCacheKey(cache.mode, cache.contentId)]: cache };
    }
    return {};
  } catch {
    return {};
  }
}

export function formatRepeatLabel(days: number[]): string {
  const normalized = normalizeDays(days);
  if (normalized.length === 7) return 'Every day';
  const key = normalized.join(',');
  if (key === '1,2,3,4,5') return 'Weekdays';
  if (key === '0,6') return 'Weekends';
  if (normalized.length === 1) return DAY_LONG[normalized[0]];
  return normalized.map((day) => DAY_SHORT[day]).join(', ');
}

export function formatAlarmTimeParts(hour: number, minute: number): { time: string; suffix: string } {
  const h = clampHour(hour);
  const m = clampMinute(minute);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return {
    time: `${hour12}:${m.toString().padStart(2, '0')}`,
    suffix: h >= 12 ? 'PM' : 'AM',
  };
}

export function pickNextAlarm(
  alarms: StudyAlarm[],
  caches: Record<string, StudyAlarmCache>,
  now = new Date()
): StudyAlarm | null {
  let best: { alarm: StudyAlarm; at: number } | null = null;
  for (const alarm of alarms) {
    if (!alarm.enabled || !canEnableAlarm(alarm, cacheForAlarm(caches, alarm))) continue;
    const at = computeNextFireAt(alarm.hour, alarm.minute, alarm.days, now);
    if (!best || at < best.at) best = { alarm, at };
  }
  return best?.alarm ?? null;
}

export function nextHourFromNow(now = new Date()): number {
  return (now.getHours() + 1) % 24;
}
