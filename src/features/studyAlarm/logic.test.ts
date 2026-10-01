import {
  ALL_DAYS,
  canEnableAlarm,
  cacheIsReady,
  clampHour,
  clampMinute,
  computeNextFireAt,
  isAlarmComplete,
  isTextCard,
  normalizeDays,
  parseStudyAlarmPrefs,
  createStudyAlarm,
  formatRepeatLabel,
  formatAlarmTimeParts,
  pickNextAlarm,
  parseStudyAlarmStore,
  parseStudyAlarmCaches,
  STUDY_ALARM_GOAL,
} from './logic';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const cases: [string, () => void][] = [
  [
    'next fire skips a time already passed today',
    () => {
      const now = new Date('2026-08-28T10:00:00');
      const next = computeNextFireAt(7, 0, [0, 1, 2, 3, 4, 5, 6], now);
      const d = new Date(next);
      assert(d.getDate() === 29 && d.getHours() === 7, String(d));
    },
  ],
  [
    'next fire keeps a later time today',
    () => {
      const now = new Date('2026-08-28T06:00:00');
      const next = computeNextFireAt(7, 30, ALL_DAYS.slice(), now);
      const d = new Date(next);
      assert(d.getDate() === 28 && d.getHours() === 7 && d.getMinutes() === 30, String(d));
    },
  ],
  [
    'weekdays only jumps Saturday to Monday',
    () => {
      const now = new Date('2026-08-29T10:00:00');
      assert(now.getDay() === 6, 'fixture should be Saturday');
      const next = computeNextFireAt(7, 0, [1, 2, 3, 4, 5], now);
      const d = new Date(next);
      assert(d.getDay() === 1 && d.getHours() === 7, String(d));
    },
  ],
  [
    'empty days means every day',
    () => {
      const days = normalizeDays([]);
      assert(days.length === 7, 'all days');
    },
  ],
  [
    'prefs recover from junk',
    () => {
      const junk = parseStudyAlarmPrefs('not-json');
      assert(junk.enabled === false && junk.hour === 7, 'defaults');
      const ok = parseStudyAlarmPrefs(
        JSON.stringify({
          enabled: true,
          hour: 25,
          minute: 99,
          days: [1, 1, 9],
          mode: 'cards',
          contentId: 3,
        })
      );
      assert(ok.hour === 23 && ok.minute === 59 && ok.days.join(',') === '1', 'clamped');
      assert(ok.mode === 'cards' && ok.contentId === 3, 'mode');
    },
  ],
  [
    'text cards skip image-only fronts',
    () => {
      assert(isTextCard({ front: 'What is mitosis?', back: 'Cell division' }), 'text');
      assert(!isTextCard({ front: '![x](https://x.test/a.png)', back: 'label' }), 'image');
      assert(!isTextCard({ front: 'Q', back: '' }), 'empty back');
    },
  ],
  [
    'enable requires matching cache of 10',
    () => {
      const prefs = parseStudyAlarmPrefs(
        JSON.stringify({
          enabled: false,
          mode: 'quiz',
          contentId: 9,
          hour: 7,
          minute: 0,
          days: [1],
        })
      );
      assert(!canEnableAlarm(prefs, null), 'no cache');
      const cache = {
        mode: 'quiz' as const,
        contentId: 9,
        quizzes: Array.from({ length: 10 }, (_, i) => ({
          id: i,
          question: 'Q' + i,
          question_type: 'multiple_choice',
          options: ['a', 'b'],
          correct_answer: 'a',
          explanation: null,
        })),
        cards: [],
        savedAt: 1,
      };
      assert(cacheIsReady(cache, prefs), 'ready');
      assert(canEnableAlarm(prefs, cache), 'can enable');
      assert(!cacheIsReady({ ...cache, quizzes: cache.quizzes.slice(0, 9) }, prefs), 'need 10');
    },
  ],
  [
    '10 completions stop the alarm',
    () => {
      assert(!isAlarmComplete(9), '9');
      assert(isAlarmComplete(10), '10');
      assert(isAlarmComplete(11), '11');
      assert(clampHour(-1) === 0 && clampMinute(80) === 59, 'clamp');
      assert(STUDY_ALARM_GOAL === 10, 'goal');
    },
  ],
  [
    'v1 prefs migrate to a one-alarm list',
    () => {
      const store = parseStudyAlarmStore(
        JSON.stringify({
          enabled: true,
          hour: 6,
          minute: 15,
          days: [1, 2, 3, 4, 5],
          mode: 'quiz',
          contentId: 4,
          contentTitle: 'Bio',
        })
      );
      assert(store.alarms.length === 1, 'one');
      assert(store.alarms[0].hour === 6 && store.alarms[0].minute === 15, 'time');
      assert(store.alarms[0].id === 'legacy', 'id');
      assert(store.scheduledId === 'legacy', 'scheduled');
    },
  ],
  [
    'v2 list parses and keeps empty lists empty',
    () => {
      const empty = parseStudyAlarmStore(JSON.stringify({ alarms: [], scheduledId: null }));
      assert(empty.alarms.length === 0, 'empty ok');
      const two = parseStudyAlarmStore(
        JSON.stringify({
          alarms: [
            { id: 'a', hour: 7, minute: 0, enabled: false, days: [0, 1, 2, 3, 4, 5, 6] },
            { id: 'b', hour: 8, minute: 30, enabled: true, days: [1], mode: 'cards' },
          ],
          scheduledId: 'b',
        })
      );
      assert(two.alarms.length === 2 && two.scheduledId === 'b', 'two');
      assert(two.alarms[1].mode === 'cards' && two.alarms[1].hour === 8, 'second');
    },
  ],
  [
    'repeat labels match Android clock wording',
    () => {
      assert(formatRepeatLabel([0, 1, 2, 3, 4, 5, 6]) === 'Every day', 'every');
      assert(formatRepeatLabel([1, 2, 3, 4, 5]) === 'Weekdays', 'weekdays');
      assert(formatRepeatLabel([0, 6]) === 'Weekends', 'weekends');
      assert(formatRepeatLabel([1]) === 'Monday', 'one');
      assert(formatRepeatLabel([1, 3, 5]) === 'Mon, Wed, Fri', 'several');
      const parts = formatAlarmTimeParts(7, 5);
      assert(parts.time === '7:05' && parts.suffix === 'AM', 'parts');
      const pm = formatAlarmTimeParts(0, 0);
      assert(pm.time === '12:00' && pm.suffix === 'AM', 'midnight');
    },
  ],
  [
    'next alarm is the soonest enabled alarm with a ready cache',
    () => {
      const ready = {
        mode: 'quiz' as const,
        contentId: 9,
        quizzes: Array.from({ length: 10 }, (_, i) => ({
          id: i,
          question: 'Q' + i,
          question_type: 'multiple_choice',
          options: ['a', 'b'],
          correct_answer: 'a',
          explanation: null,
        })),
        cards: [],
        savedAt: 1,
      };
      const a = createStudyAlarm({
        id: 'a',
        enabled: true,
        hour: 7,
        minute: 0,
        days: [...ALL_DAYS],
        contentId: 9,
      });
      const b = createStudyAlarm({
        id: 'b',
        enabled: true,
        hour: 8,
        minute: 0,
        days: [...ALL_DAYS],
        contentId: 9,
      });
      const caches = { 'quiz:9': ready };
      const morning = pickNextAlarm([a, b], caches, new Date('2026-08-28T06:00:00'));
      assert(morning?.id === 'a', 'before 7');
      const mid = pickNextAlarm([a, b], caches, new Date('2026-08-28T07:30:00'));
      assert(mid?.id === 'b', 'between');
      const off = pickNextAlarm([{ ...a, enabled: false }, b], caches, new Date('2026-08-28T06:00:00'));
      assert(off?.id === 'b', 'skip disabled');
      const none = pickNextAlarm([a, b], {}, new Date('2026-08-28T06:00:00'));
      assert(none == null, 'no cache');
    },
  ],
  [
    'v1 cache wraps into a keyed map',
    () => {
      const wrapped = parseStudyAlarmCaches(
        JSON.stringify({
          mode: 'quiz',
          contentId: 3,
          quizzes: [],
          cards: [],
          savedAt: 1,
        })
      );
      assert(wrapped['quiz:3']?.contentId === 3, 'legacy cache');
      const keyed = parseStudyAlarmCaches(
        JSON.stringify({ byKey: { 'cards:8': { mode: 'cards', contentId: 8, quizzes: [], cards: [], savedAt: 2 } } })
      );
      assert(keyed['cards:8']?.mode === 'cards', 'keyed');
    },
  ],
];

let failed = 0;
for (const [name, run] of cases) {
  try {
    run();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}
if (failed) {
  process.exit(1);
}
console.log(`${cases.length} passed`);
