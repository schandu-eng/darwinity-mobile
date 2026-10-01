import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlarmClock,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Layers,
  Plus,
  Trash2,
} from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { BRAND_COLORS } from '@/config/brand';
import { Fonts } from '@/config/fonts';
import { useAuthStore } from '@/store';
import { contentService } from '@/services/contentService';
import type { ContentListItem } from '@/api/schemas/content';
import { InkPanelGradient } from '@/components/brand/InkPanelGradient';
import { FocusSectionLabel, FocusToolCard } from '@/components/profile/FocusToolCard';
import {
  ALL_DAYS,
  MAX_STUDY_ALARMS,
  STUDY_ALARM_GOAL,
  cacheForAlarm,
  canEnableAlarm,
  computeNextFireAt,
  createStudyAlarm,
  formatAlarmTime,
  formatAlarmTimeParts,
  formatRepeatLabel,
  nextHourFromNow,
  alarmCacheKey,
  type StudyAlarm,
  type StudyAlarmCache,
  type StudyAlarmMode,
} from '@/features/studyAlarm/logic';
import {
  getStudyAlarmPermissions,
  isStudyAlarmNativeAvailable,
  openExactAlarmSettings,
  type StudyAlarmPermissions,
} from '@/features/studyAlarm/native';
import {
  loadStudyAlarmCaches,
  loadStudyAlarms,
  saveStudyAlarmCache,
  saveStudyAlarms,
} from '@/features/studyAlarm/storage';
import { prefetchStudyAlarmItems } from '@/features/studyAlarm/prefetch';
import { syncStudyAlarmSchedule } from '@/features/studyAlarm/sync';

const CREAM = '#FAF9F6';
const CREAM_MUTED = 'rgba(250, 249, 246, 0.72)';
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const NOTE_ROW_HEIGHT = 48;
const NOTE_LIST_VISIBLE_COUNT = 6;
const NOTE_LIST_VISIBLE_HEIGHT = NOTE_ROW_HEIGHT * NOTE_LIST_VISIBLE_COUNT;

function formatNextFire(hour: number, minute: number, days: number[]): string {
  const at = computeNextFireAt(hour, minute, days);
  const d = new Date(at);
  const now = new Date();
  const time = formatAlarmTime(d.getHours(), d.getMinutes());
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`;
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} · ${time}`;
}

function alarmHint(alarm: StudyAlarm, supported: boolean, cache: StudyAlarmCache | null): string {
  if (!supported) return 'Not available on this device';
  if (alarm.enabled) return formatNextFire(alarm.hour, alarm.minute, alarm.days);
  if (!alarm.contentId) return 'Pick a note, then turn it on';
  if (!canEnableAlarm(alarm, cache)) {
    return alarm.mode === 'quiz'
      ? `Needs ${STUDY_ALARM_GOAL} quiz questions`
      : `Needs ${STUDY_ALARM_GOAL} flashcards`;
  }
  return formatRepeatLabel(alarm.days);
}

const StudyAlarmScreen: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const userId = useAuthStore((s) => s.user?.id);
  const [alarms, setAlarms] = useState<StudyAlarm[]>([]);
  const [caches, setCaches] = useState<Record<string, StudyAlarmCache>>({});
  const [permissions, setPermissions] = useState<StudyAlarmPermissions | null>(null);
  const [notes, setNotes] = useState<ContentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const supported = Boolean(permissions?.supported && isStudyAlarmNativeAvailable());

  const refresh = useCallback(async () => {
    const [nextAlarms, nextCaches, nextPerms, list] = await Promise.all([
      loadStudyAlarms(),
      loadStudyAlarmCaches(),
      getStudyAlarmPermissions(),
      userId
        ? contentService.getUserContent(userId, 1, 40)
        : Promise.resolve({ success: true as const, data: undefined }),
    ]);
    setAlarms(nextAlarms);
    setCaches(nextCaches);
    setPermissions(nextPerms);
    setNotes(list.data?.content || []);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      void refresh().finally(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [refresh])
  );

  const persist = useCallback(async (next: StudyAlarm[]) => {
    const saved = await saveStudyAlarms(next);
    setAlarms(saved);
    await syncStudyAlarmSchedule();
    return saved;
  }, []);

  const updateAlarm = useCallback(
    async (id: string, patch: Partial<StudyAlarm>) => {
      const current = await loadStudyAlarms();
      await persist(current.map((alarm) => (alarm.id === id ? { ...alarm, ...patch } : alarm)));
    },
    [persist]
  );

  const handleToggle = useCallback(
    async (alarm: StudyAlarm, value: boolean) => {
      if (savingId) return;
      if (value && !supported) {
        Alert.alert(
          Platform.OS === 'ios' ? 'Android only for now' : 'Rebuild required',
          Platform.OS === 'ios'
            ? 'A lock-screen study alarm needs native Android alarm APIs. iOS support is coming.'
            : 'Install a Darwinity development or production build. Expo Go cannot schedule this alarm.'
        );
        return;
      }
      const cache = cacheForAlarm(caches, alarm);
      if (value && !canEnableAlarm(alarm, cache)) {
        Alert.alert(
          'Pick a note first',
          alarm.mode === 'quiz'
            ? `Choose a note that already has ${STUDY_ALARM_GOAL} quiz questions.`
            : `Choose a note that already has ${STUDY_ALARM_GOAL} flashcards.`
        );
        setExpandedId(alarm.id);
        return;
      }
      if (value && permissions && !permissions.exactAlarmGranted) {
        Alert.alert(
          'Allow exact alarms',
          'Darwinity needs the Alarms & reminders permission to ring on time.',
          [
            { text: 'Not now' },
            { text: 'Open settings', onPress: () => void openExactAlarmSettings() },
          ]
        );
      }
      setSavingId(alarm.id);
      try {
        await updateAlarm(alarm.id, { enabled: value });
      } finally {
        setSavingId(null);
      }
    },
    [caches, permissions, savingId, supported, updateAlarm]
  );

  const handleAdd = useCallback(async () => {
    if (savingId) return;
    const current = await loadStudyAlarms();
    if (current.length >= MAX_STUDY_ALARMS) {
      Alert.alert('Alarm limit', `You can save up to ${MAX_STUDY_ALARMS} study alarms.`);
      return;
    }
    const created = createStudyAlarm({ hour: nextHourFromNow(), minute: 0, enabled: false });
    setSavingId(created.id);
    try {
      await persist([...current, created]);
      setExpandedId(created.id);
    } finally {
      setSavingId(null);
    }
  }, [persist, savingId]);

  const handleDelete = useCallback(
    (alarm: StudyAlarm) => {
      Alert.alert('Delete alarm?', `Remove the ${formatAlarmTime(alarm.hour, alarm.minute)} alarm?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setSavingId(alarm.id);
              try {
                const current = await loadStudyAlarms();
                await persist(current.filter((item) => item.id !== alarm.id));
                setExpandedId((openId) => (openId === alarm.id ? null : openId));
              } finally {
                setSavingId(null);
              }
            })();
          },
        },
      ]);
    },
    [persist]
  );

  const bumpTime = useCallback(
    async (alarm: StudyAlarm, field: 'hour' | 'minute', delta: number) => {
      const hour = field === 'hour' ? (alarm.hour + delta + 24) % 24 : alarm.hour;
      const minute = field === 'minute' ? (alarm.minute + delta + 60) % 60 : alarm.minute;
      await updateAlarm(alarm.id, { hour, minute });
    },
    [updateAlarm]
  );

  const toggleMeridiem = useCallback(
    async (alarm: StudyAlarm) => {
      await updateAlarm(alarm.id, { hour: (alarm.hour + 12) % 24 });
    },
    [updateAlarm]
  );

  const toggleDay = useCallback(
    async (alarm: StudyAlarm, day: number) => {
      const has = alarm.days.includes(day);
      const days = has ? alarm.days.filter((item) => item !== day) : [...alarm.days, day];
      await updateAlarm(alarm.id, { days });
    },
    [updateAlarm]
  );

  const selectMode = useCallback(
    async (alarm: StudyAlarm, mode: StudyAlarmMode) => {
      if (mode === alarm.mode) return;
      await updateAlarm(alarm.id, { mode, enabled: false, contentId: null, contentTitle: '' });
    },
    [updateAlarm]
  );

  const selectNote = useCallback(
    async (alarm: StudyAlarm, item: ContentListItem) => {
      if (!userId) return;
      setSavingId(alarm.id);
      setError('');
      try {
        const nextCache = await prefetchStudyAlarmItems(alarm.mode, item.id, userId);
        await saveStudyAlarmCache(nextCache);
        setCaches((current) => ({
          ...current,
          [alarmCacheKey(nextCache.mode, nextCache.contentId)]: nextCache,
        }));
        const current = await loadStudyAlarms();
        await persist(
          current.map((row) =>
            row.id === alarm.id
              ? { ...row, contentId: item.id, contentTitle: item.title, enabled: false }
              : row
          )
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load items for this note.');
      } finally {
        setSavingId(null);
      }
    },
    [persist, userId]
  );

  const addButton = (
    <TouchableOpacity
      onPress={() => void handleAdd()}
      style={[styles.addBtn, { backgroundColor: theme.colors.primaryContainer }]}
      accessibilityRole="button"
      accessibilityLabel="Add alarm"
      disabled={Boolean(savingId)}
    >
      <Plus size={18} strokeWidth={2.2} color={theme.colors.primary} />
    </TouchableOpacity>
  );

  const card = (
    <FocusToolCard
      icon={AlarmClock}
      title="Study alarm"
      subtitle={`Keeps ringing until you finish ${STUDY_ALARM_GOAL} quiz questions or flashcards. No snooze.`}
      headerRight={addButton}
    >
      {loading ? (
        <ActivityIndicator style={styles.spinner} color={theme.colors.primary} />
      ) : alarms.length === 0 ? (
        <TouchableOpacity
          onPress={() => void handleAdd()}
          style={[
            styles.empty,
            {
              backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : BRAND_COLORS.white,
              borderColor: theme.colors.outlineVariant,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add alarm"
        >
          <Plus size={18} strokeWidth={ICON_STROKE} color={theme.colors.primary} />
          <View style={styles.flex}>
            <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>Add an alarm</Text>
            <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
              Set a time, pick a note, then turn it on.
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.list}>
          {alarms.map((alarm, index) => (
            <AlarmTile
              key={alarm.id}
              alarm={alarm}
              cache={cacheForAlarm(caches, alarm)}
              notes={notes}
              expanded={expandedId === alarm.id}
              saving={savingId === alarm.id}
              supported={supported}
              themeMode={themeMode}
              showDivider={index < alarms.length - 1}
              onToggleExpand={() =>
                setExpandedId((current) => (current === alarm.id ? null : alarm.id))
              }
              onToggleEnabled={(value) => void handleToggle(alarm, value)}
              onBumpTime={(field, delta) => void bumpTime(alarm, field, delta)}
              onToggleMeridiem={() => void toggleMeridiem(alarm)}
              onToggleDay={(day) => void toggleDay(alarm, day)}
              onSelectMode={(mode) => void selectMode(alarm, mode)}
              onSelectNote={(item) => void selectNote(alarm, item)}
              onDelete={() => handleDelete(alarm)}
            />
          ))}
        </View>
      )}
      {error ? <Text style={[styles.error, { color: theme.colors.error }]}>{error}</Text> : null}
    </FocusToolCard>
  );

  if (embedded) return card;

  return (
    <View style={[styles.page, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { marginTop: insets.top }]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} strokeWidth={ICON_STROKE} color={theme.colors.onSurface} />
        </TouchableOpacity>
        {card}
      </ScrollView>
    </View>
  );
};

type AlarmTileProps = {
  alarm: StudyAlarm;
  cache: StudyAlarmCache | null;
  notes: ContentListItem[];
  expanded: boolean;
  saving: boolean;
  supported: boolean;
  themeMode: 'light' | 'dark';
  showDivider: boolean;
  onToggleExpand: () => void;
  onToggleEnabled: (value: boolean) => void;
  onBumpTime: (field: 'hour' | 'minute', delta: number) => void;
  onToggleMeridiem: () => void;
  onToggleDay: (day: number) => void;
  onSelectMode: (mode: StudyAlarmMode) => void;
  onSelectNote: (item: ContentListItem) => void;
  onDelete: () => void;
};

type NoteListBodyProps = {
  notes: ContentListItem[];
  alarm: StudyAlarm;
  cache: StudyAlarmCache | null;
  saving: boolean;
  theme: typeof lightTheme;
  themeMode: 'light' | 'dark';
  onSelectNote: (item: ContentListItem) => void;
};

const NoteListBody: React.FC<NoteListBodyProps> = ({
  notes,
  alarm,
  cache,
  saving,
  theme,
  themeMode,
  onSelectNote,
}) => {
  const rows = notes.map((item, index) => {
    const selected = alarm.contentId === item.id;
    return (
      <View key={item.id}>
        {index > 0 ? (
          <View
            style={[
              styles.noteDivider,
              {
                backgroundColor:
                  themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.08)',
              },
            ]}
          />
        ) : null}
        <Pressable
          onPress={() => onSelectNote(item)}
          disabled={saving}
          style={({ pressed }) => [
            styles.note,
            Platform.OS === 'web' ? styles.noteWeb : null,
            pressed && !saving ? styles.notePressed : null,
            saving ? styles.noteDisabled : null,
          ]}
        >
          <View
            style={[
              styles.noteCheck,
              selected
                ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
                : {
                    backgroundColor: 'transparent',
                    borderColor: theme.colors.outlineVariant,
                  },
            ]}
          >
            {selected ? (
              <Check size={14} strokeWidth={2.4} color={theme.colors.onPrimary} />
            ) : null}
          </View>
          <View style={styles.flex}>
            <Text style={[styles.noteTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {item.title}
            </Text>
            {selected ? (
              <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
                {alarm.mode === 'quiz'
                  ? `${cache?.quizzes.length ?? 0} questions ready`
                  : `${cache?.cards.length ?? 0} cards ready`}
              </Text>
            ) : item.has_flashcards && alarm.mode === 'cards' ? (
              <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
                Has flashcards
              </Text>
            ) : null}
          </View>
        </Pressable>
      </View>
    );
  });

  if (Platform.OS === 'web') {
    return <View style={styles.noteListScrollWeb}>{rows}</View>;
  }

  return (
    <ScrollView
      style={styles.noteListScroll}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={notes.length > NOTE_LIST_VISIBLE_COUNT}
    >
      {rows}
    </ScrollView>
  );
};

const AlarmTile: React.FC<AlarmTileProps> = ({
  alarm,
  cache,
  notes,
  expanded,
  saving,
  supported,
  themeMode,
  showDivider,
  onToggleExpand,
  onToggleEnabled,
  onBumpTime,
  onToggleMeridiem,
  onToggleDay,
  onSelectMode,
  onSelectNote,
  onDelete,
}) => {
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const parts = formatAlarmTimeParts(alarm.hour, alarm.minute);
  const repeat = formatRepeatLabel(alarm.days);
  const hint = alarmHint(alarm, supported, cache);
  const hour12 = alarm.hour % 12 === 0 ? 12 : alarm.hour % 12;
  const isPm = alarm.hour >= 12;
  const minuteLabel = alarm.minute.toString().padStart(2, '0');
  const dimmed = !alarm.enabled;

  const subtitle = useMemo(() => {
    const bits = [repeat];
    if (alarm.contentTitle) bits.push(alarm.contentTitle);
    return bits.join(' · ');
  }, [alarm.contentTitle, repeat]);

  return (
    <View>
      <View style={styles.tile}>
        <TouchableOpacity
          style={styles.tileHit}
          onPress={onToggleExpand}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${parts.time} ${parts.suffix}, ${subtitle}`}
          accessibilityState={{ expanded }}
        >
          <View style={styles.tileTimeRow}>
            <Text
              style={[
                styles.tileTime,
                { color: theme.colors.onSurface, opacity: dimmed ? 0.38 : 1 },
              ]}
            >
              {parts.time}
            </Text>
            <Text
              style={[
                styles.tileSuffix,
                { color: theme.colors.onSurface, opacity: dimmed ? 0.38 : 0.72 },
              ]}
            >
              {parts.suffix}
            </Text>
          </View>
          <Text
            style={[styles.tileMeta, { color: theme.colors.onSurfaceVariant }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
          <Text style={[styles.tileHint, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
            {hint}
          </Text>
        </TouchableOpacity>
        <Switch
          value={alarm.enabled}
          onValueChange={onToggleEnabled}
          disabled={saving}
          trackColor={{ false: '#D6D3D1', true: BRAND_COLORS.growth }}
          thumbColor={BRAND_COLORS.white}
          ios_backgroundColor="#D6D3D1"
        />
      </View>

      {expanded ? (
        <View style={styles.details}>
          <InkPanelGradient style={styles.clockCard} contentStyle={styles.clockInner} glow={false}>
            <View style={styles.clock}>
              <ClockColumn
                value={hour12.toString()}
                onUp={() => onBumpTime('hour', 1)}
                onDown={() => onBumpTime('hour', -1)}
              />
              <Text style={styles.clockColon}>:</Text>
              <ClockColumn
                value={minuteLabel}
                onUp={() => onBumpTime('minute', 1)}
                onDown={() => onBumpTime('minute', -1)}
              />
              <TouchableOpacity
                onPress={onToggleMeridiem}
                style={styles.meridiem}
                accessibilityRole="button"
                accessibilityLabel={isPm ? 'PM, tap to switch to AM' : 'AM, tap to switch to PM'}
              >
                <Text style={[styles.meridiemText, isPm ? styles.meridiemOff : styles.meridiemOn]}>
                  AM
                </Text>
                <Text style={[styles.meridiemText, isPm ? styles.meridiemOn : styles.meridiemOff]}>
                  PM
                </Text>
              </TouchableOpacity>
            </View>
          </InkPanelGradient>

          <FocusSectionLabel>Repeat</FocusSectionLabel>
          <View style={styles.days}>
            {ALL_DAYS.map((day) => {
              const on = alarm.days.includes(day);
              return (
                <TouchableOpacity
                  key={day}
                  onPress={() => onToggleDay(day)}
                  style={[
                    styles.day,
                    on
                      ? { backgroundColor: theme.colors.primary }
                      : { backgroundColor: theme.colors.surfaceVariant },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={DAY_LABELS[day]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: on ? theme.colors.onPrimary : theme.colors.onSurface },
                    ]}
                  >
                    {DAY_LABELS[day]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <FocusSectionLabel>Stop with</FocusSectionLabel>
          <View
            style={[
              styles.segment,
              { backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : BRAND_COLORS.paper },
            ]}
          >
            {(['quiz', 'cards'] as StudyAlarmMode[]).map((mode) => {
              const on = alarm.mode === mode;
              const label = mode === 'quiz' ? `${STUDY_ALARM_GOAL} quiz` : `${STUDY_ALARM_GOAL} cards`;
              const Icon = mode === 'quiz' ? CircleHelp : Layers;
              return (
                <TouchableOpacity
                  key={mode}
                  onPress={() => onSelectMode(mode)}
                  style={[styles.segmentBtn, on && { backgroundColor: theme.colors.primary }]}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Icon
                    size={15}
                    strokeWidth={ICON_STROKE}
                    color={on ? theme.colors.onPrimary : theme.colors.onSurfaceVariant}
                  />
                  <Text
                    style={[
                      styles.segmentLabel,
                      { color: on ? theme.colors.onPrimary : theme.colors.onSurfaceVariant },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <FocusSectionLabel>Note</FocusSectionLabel>
          {notes.length === 0 ? (
            <View
              style={[
                styles.emptyNote,
                {
                  backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : BRAND_COLORS.white,
                  borderColor: theme.colors.outlineVariant,
                },
              ]}
            >
              <Text style={[styles.emptyNoteTitle, { color: theme.colors.onSurface }]}>
                No notes yet
              </Text>
              <Text style={[styles.hint, { color: theme.colors.onSurfaceVariant }]}>
                Add a lecture first, then pick it here so the alarm has questions ready.
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.noteList,
                {
                  backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : BRAND_COLORS.white,
                  borderColor: theme.colors.outlineVariant,
                },
              ]}
            >
              <NoteListBody
                notes={notes}
                alarm={alarm}
                cache={cache}
                saving={saving}
                theme={theme}
                themeMode={themeMode}
                onSelectNote={onSelectNote}
              />
            </View>
          )}

          <TouchableOpacity
            onPress={onDelete}
            style={styles.deleteBtn}
            accessibilityRole="button"
            accessibilityLabel="Delete alarm"
          >
            <Trash2 size={16} strokeWidth={ICON_STROKE} color={theme.colors.error} />
            <Text style={[styles.deleteText, { color: theme.colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {showDivider ? (
        <View
          style={[
            styles.tileDivider,
            { backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.08)' },
          ]}
        />
      ) : null}
    </View>
  );
};

const ClockColumn: React.FC<{
  value: string;
  onUp: () => void;
  onDown: () => void;
}> = ({ value, onUp, onDown }) => (
  <View style={styles.clockCol}>
    <TouchableOpacity
      onPress={onUp}
      style={styles.clockChevron}
      accessibilityRole="button"
      accessibilityLabel="Increase"
    >
      <ChevronUp size={18} strokeWidth={ICON_STROKE} color={CREAM_MUTED} />
    </TouchableOpacity>
    <Text style={styles.clockValue}>{value}</Text>
    <TouchableOpacity
      onPress={onDown}
      style={styles.clockChevron}
      accessibilityRole="button"
      accessibilityLabel="Decrease"
    >
      <ChevronDown size={18} strokeWidth={ICON_STROKE} color={CREAM_MUTED} />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  page: { flex: 1 },
  pageContent: { paddingHorizontal: 20, paddingBottom: 48 },
  backButton: {
    alignSelf: 'flex-start',
    padding: 8,
    marginLeft: -8,
    marginBottom: 8,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: { marginVertical: 20 },
  list: { marginTop: 2 },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  tileHit: { flex: 1, minWidth: 0 },
  tileTimeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  tileTime: {
    fontSize: 40,
    lineHeight: 46,
    fontFamily: Fonts.display.extraBold,
    letterSpacing: -1.2,
  },
  tileSuffix: {
    marginTop: 8,
    fontSize: 14,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.4,
  },
  tileMeta: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: Fonts.ui.medium,
  },
  tileHint: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: Fonts.ui.regular,
    lineHeight: 16,
  },
  tileDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  details: { paddingBottom: 8 },
  clockCard: {
    borderRadius: 16,
    marginBottom: 12,
  },
  clockInner: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  clockCol: {
    alignItems: 'center',
    minWidth: 56,
  },
  clockChevron: {
    paddingVertical: 2,
    paddingHorizontal: 10,
  },
  clockValue: {
    color: CREAM,
    fontSize: 44,
    lineHeight: 50,
    fontFamily: Fonts.display.extraBold,
    letterSpacing: -1.2,
    minWidth: 56,
    textAlign: 'center',
  },
  clockColon: {
    color: CREAM,
    fontSize: 36,
    fontFamily: Fonts.display.bold,
    marginBottom: 2,
    opacity: 0.7,
  },
  meridiem: {
    marginLeft: 6,
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  meridiemText: {
    fontSize: 13,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.6,
  },
  meridiemOn: { color: CREAM },
  meridiemOff: { color: 'rgba(250, 249, 246, 0.35)' },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontFamily: Fonts.ui.semiBold, fontSize: 12 },
  segment: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  segmentLabel: { fontSize: 13, fontFamily: Fonts.ui.semiBold },
  noteList: {
    maxHeight: NOTE_LIST_VISIBLE_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  noteListScroll: {
    maxHeight: NOTE_LIST_VISIBLE_HEIGHT,
  },
  noteListScrollWeb: {
    maxHeight: NOTE_LIST_VISIBLE_HEIGHT,
    overflow: 'auto',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  noteWeb: Platform.OS === 'web' ? ({ cursor: 'pointer' } as const) : {},
  notePressed: { opacity: 0.75 },
  noteDisabled: { opacity: 0.45 },
  noteDivider: { height: StyleSheet.hairlineWidth, marginLeft: 50 },
  noteCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteTitle: { fontSize: 15, fontFamily: Fonts.ui.medium },
  hint: { fontSize: 12, fontFamily: Fonts.ui.regular, marginTop: 2, lineHeight: 16 },
  flex: { flex: 1, minWidth: 0 },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  emptyTitle: { fontSize: 15, fontFamily: Fonts.ui.medium, marginBottom: 2 },
  emptyNote: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  emptyNoteTitle: { fontSize: 15, fontFamily: Fonts.ui.medium, marginBottom: 4 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
  },
  deleteText: { fontSize: 14, fontFamily: Fonts.ui.semiBold },
  error: { marginTop: 12, fontFamily: Fonts.ui.regular, fontSize: 14 },
});

export default StudyAlarmScreen;
