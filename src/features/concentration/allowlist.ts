export const FOCUS_ALLOWLIST = new Set([
  'Home',
  'HomeFeed',
  'StudyStats',
  'ExamPrep',
  'ExamPrepHub',
  'ExamPrepTarget',
  'Productivity',
  'ProductivityHome',
  'FocusShieldAppPicker',
  'ContentList',
  'ContentDetail',
  'Folders',
  'FolderDetail',
  'Flashcards',
  'Quiz',
  'Flowchart',
  'Chat',
  'Podcast',
  'Games',
  'CardReel',
]);

export const IDLE_TIMEOUT_MS = 120_000;
export const PAUSE_FINALIZE_MS = 30 * 60_000;
export const STORAGE_KEY = '@darwinity_focus_draft';
export const POMODORO_COUNT_KEY = '@darwinity_pomodoro_lifetime';
export const PRESET_KEY = '@darwinity_pomodoro_preset';

export const POMODORO_PRESETS = [
  { id: 'classic', label: '25 + 5', workMinutes: 25, breakMinutes: 5 },
  { id: 'long', label: '50 + 10', workMinutes: 50, breakMinutes: 10 },
] as const;

export type PomodoroPresetId = (typeof POMODORO_PRESETS)[number]['id'];

export type PomodoroPreset = {
  id: PomodoroPresetId;
  label: string;
  workMinutes: number;
  breakMinutes: number;
};

export function getPresetById(id: string | null | undefined): PomodoroPreset {
  const found = POMODORO_PRESETS.find((p) => p.id === id);
  return found ?? POMODORO_PRESETS[0];
}

export function isAllowlistedScreen(routeName: string | undefined | null): boolean {
  if (!routeName) return false;
  return FOCUS_ALLOWLIST.has(routeName);
}

export function createConcentrationSessionId(): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function formatMmSs(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
