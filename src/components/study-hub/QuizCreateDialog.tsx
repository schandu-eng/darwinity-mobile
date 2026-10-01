import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Platform,
  Animated,
  Easing,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { Check, ChevronDown, X } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { BRAND_COLORS } from '@/config/brand';
import { useAppTheme } from '@/store/appThemeStore';
import type { Chapter } from '@/api/schemas/content';
import {
  QUIZ_DIFFICULTIES,
  QUIZ_QUESTION_TYPES,
  MIN_QUESTION_COUNT,
  MAX_QUESTION_COUNT,
  clampQuestionCount,
  defaultQuizConfig,
  type QuizSessionConfigInput,
} from '@/study-hub/quizConfig';
import {
  DIALOG_CLOSE_MS,
  DIALOG_OPEN_MS,
  DIALOG_ZOOM_FROM,
  MODAL_ELEVATED_SHADOW,
  USE_NATIVE_DRIVER,
  boxShadow,
  overlayBlurStyle,
  pointerEventsProp,
  pointerEventsStyle,
} from '@/theme/webCompat';
import StudyGenerationProcessingScreen from './StudyGenerationProcessingScreen';
import { STUDY_INK, STUDY_ZINC_500 } from './studyPanelTokens';

const EASE_DIALOG = Easing.bezier(0.4, 0, 0.2, 1);
const FOCUS_RING = boxShadow('0 0 0 3px rgba(26,47,35,0.2)', {
  shadowColor: STUDY_INK,
  shadowOpacity: 0.2,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 0 },
});
const DIALOG_SHADOW = boxShadow(MODAL_ELEVATED_SHADOW, {
  shadowColor: BRAND_COLORS.ink,
  shadowOffset: { width: 0, height: 28 },
  shadowOpacity: 0.22,
  shadowRadius: 40,
  elevation: 16,
});

type BinaryOption<T> = { value: T; label: string };

function BinaryToggle<T extends string | boolean>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: {
  value: T;
  options: [BinaryOption<T>, BinaryOption<T>];
  onChange: (value: T) => void;
  accessibilityLabel: string;
}) {
  const isDark = (useAppTheme() as 'light' | 'dark') === 'dark';
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.toggleTrack,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(244,244,245,0.8)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(228,228,231,0.9)',
        },
      ]}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={String(opt.value)}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.toggleBtn,
              active && {
                backgroundColor: isDark ? '#3F6B4F' : STUDY_INK,
              },
            ]}
          >
            <Text
              style={[
                styles.toggleLabel,
                { color: active ? '#FAFAFA' : isDark ? '#D4D4D8' : '#52525B' },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  const isDark = (useAppTheme() as 'light' | 'dark') === 'dark';
  return (
    <View
      style={[
        styles.checkBox,
        checked
          ? { backgroundColor: STUDY_INK, borderColor: STUDY_INK }
          : {
              backgroundColor: isDark ? '#09090B' : '#FFFFFF',
              borderColor: isDark ? 'rgba(255,255,255,0.25)' : '#D4D4D8',
            },
      ]}
    >
      {checked ? <Check size={11} strokeWidth={2.75} color="#FAFAFA" /> : null}
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  const isDark = (useAppTheme() as 'light' | 'dark') === 'dark';
  return (
    <Text style={[styles.fieldLabel, { color: isDark ? '#A1A1AA' : STUDY_ZINC_500 }]}>
      {children}
    </Text>
  );
}

type QuizCreateDialogProps = {
  visible: boolean;
  busy: boolean;
  generationProgress?: number;
  config: QuizSessionConfigInput;
  setConfig: React.Dispatch<React.SetStateAction<QuizSessionConfigInput>>;
  selectedChapters: number[] | null;
  setSelectedChapters: React.Dispatch<React.SetStateAction<number[] | null>>;
  chapters: Chapter[];
  error?: string | null;
  hasNotes: boolean;
  inProgress: boolean;
  onClose: () => void;
  onStart: () => void;
  maxQuestionCount?: number;
};

const QuizCreateDialog: React.FC<QuizCreateDialogProps> = ({
  visible,
  busy,
  generationProgress = 0,
  config,
  setConfig,
  selectedChapters,
  setSelectedChapters,
  chapters,
  error,
  hasNotes,
  inProgress,
  onClose,
  onStart,
  maxQuestionCount = MAX_QUESTION_COUNT,
}) => {
  const isDark = (useAppTheme() as 'light' | 'dark') === 'dark';
  const { height: windowHeight } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [questionCountInput, setQuestionCountInput] = useState(String(config.question_count));
  const [countFocused, setCountFocused] = useState(false);
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const progress = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    if (visible) {
      setQuestionCountInput(String(config.question_count));
      setDifficultyOpen(false);
      setTypesOpen(false);
      setCountFocused(false);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
    }
    // Only reset fields when the dialog opens, not when config mutates while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: DIALOG_OPEN_MS,
        easing: EASE_DIALOG,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
      return;
    }
    if (!mounted) return;
    Animated.timing(progress, {
      toValue: 0,
      duration: DIALOG_CLOSE_MS,
      easing: EASE_DIALOG,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, progress]);

  const ink = isDark ? '#FAFAFA' : STUDY_INK;
  const muted = isDark ? '#A1A1AA' : STUDY_ZINC_500;
  const body = isDark ? '#D4D4D8' : '#3F3F46';
  const paper = isDark ? '#111113' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)';
  const fieldBg = isDark ? '#09090B' : '#FAFAFA';
  const fieldBorder = isDark ? 'rgba(255,255,255,0.1)' : '#D4D4D8';
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [DIALOG_ZOOM_FROM, 1] });

  const typeSummary = useMemo(() => {
    const labels = QUIZ_QUESTION_TYPES.filter((t) => config.question_types.includes(t.value)).map(
      (t) => t.label
    );
    return labels.join(', ') || 'Select types';
  }, [config.question_types]);

  const difficultyLabel =
    QUIZ_DIFFICULTIES.find((d) => d.value === config.difficulty)?.label || 'Mixed';

  const allChapterIds = useMemo(
    () => chapters.map((ch) => ch.id).filter((id): id is number => id != null),
    [chapters]
  );
  const allSelected = selectedChapters === null;
  const selectedIds = selectedChapters || [];

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const applyQuestionCount = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits === '') {
      setQuestionCountInput('');
      return;
    }
    const n = parseInt(digits, 10);
    if (!Number.isFinite(n)) return;
    const capped = Math.min(maxQuestionCount, n);
    setQuestionCountInput(String(capped));
    setConfig((c) => ({
      ...c,
      question_count: Math.max(MIN_QUESTION_COUNT, capped),
      time_limit_seconds: c.timed ? Math.max(MIN_QUESTION_COUNT, capped) * 60 : c.time_limit_seconds,
    }));
  };

  const blurQuestionCount = () => {
    setCountFocused(false);
    const next =
      clampQuestionCount(questionCountInput, maxQuestionCount) ??
      Math.min(defaultQuizConfig().question_count, maxQuestionCount);
    setQuestionCountInput(String(next));
    setConfig((c) => ({
      ...c,
      question_count: next,
      time_limit_seconds: c.timed ? next * 60 : c.time_limit_seconds,
    }));
  };

  const toggleType = (value: string) => {
    setConfig((prev) => {
      const has = prev.question_types.includes(value);
      const next = has
        ? prev.question_types.filter((t) => t !== value)
        : [...prev.question_types, value];
      return { ...prev, question_types: next.length ? next : ['multiple_choice'] };
    });
  };

  const handleAllChapters = () => {
    setSelectedChapters(selectedChapters === null ? [] : null);
  };

  const handleChapterToggle = (chapterId: number) => {
    if (selectedChapters === null) {
      setSelectedChapters(allChapterIds.filter((id) => id !== chapterId));
      return;
    }
    const next = selectedIds.includes(chapterId)
      ? selectedIds.filter((id) => id !== chapterId)
      : [...selectedIds, chapterId];
    if (next.length === 0 || next.length === allChapterIds.length) {
      setSelectedChapters(null);
      return;
    }
    setSelectedChapters(next);
  };

  if (!mounted) return null;

  const selectTrigger = (open: boolean) => [
    styles.selectTrigger,
    {
      backgroundColor: fieldBg,
      borderColor: open ? STUDY_INK : fieldBorder,
    },
    open ? FOCUS_RING : null,
  ];

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.flex} accessibilityViewIsModal>
          <Animated.View
            style={[
              styles.backdrop,
              overlayBlurStyle,
              {
                backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(24,24,27,0.45)',
                opacity: progress,
              },
            ]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={handleClose}
              accessibilityLabel="Close"
            />
          </Animated.View>

          <View
            style={[styles.center, pointerEventsStyle('box-none')]}
            pointerEvents={pointerEventsProp('box-none')}
          >
            <Animated.View
              accessibilityViewIsModal
              accessibilityLabel="Test yourself"
              style={[
                styles.modal,
                DIALOG_SHADOW,
                {
                  backgroundColor: paper,
                  borderColor: border,
                  maxHeight: windowHeight * 0.9,
                  maxWidth: busy ? 448 : 672,
                  opacity: progress,
                  transform: [{ scale }],
                },
              ]}
            >
              {busy ? (
                <StudyGenerationProcessingScreen
                  embedded
                  serviceType="quiz"
                  progress={generationProgress}
                  subtitle={`Building ${config.question_count} question${
                    config.question_count === 1 ? '' : 's'
                  } · ${
                    config.mode === 'exam' ? 'Exam' : 'Learn'
                  } set from your notes. You can switch away — we'll keep working.`}
                />
              ) : (
                <>
                  <Pressable
                    onPress={handleClose}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.closeButton,
                      { backgroundColor: pressed ? 'rgba(63,107,79,0.14)' : 'transparent' },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <X size={16} strokeWidth={ICON_STROKE} color={muted} />
                  </Pressable>

                  <View style={styles.header}>
                    <Text style={[styles.title, { color: ink }]}>Test yourself</Text>
                    <Text style={[styles.description, { color: muted }]}>
                      Pick mode, length, and question types.
                    </Text>
                  </View>

                  <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <View style={styles.fieldRow}>
                      <View style={styles.fieldCol}>
                        <FieldLabel>Mode</FieldLabel>
                        <BinaryToggle
                          accessibilityLabel="Quiz mode"
                          value={config.mode}
                          options={[
                            { value: 'learn', label: 'Learn' },
                            { value: 'exam', label: 'Exam' },
                          ]}
                          onChange={(mode) => setConfig((c) => ({ ...c, mode }))}
                        />
                        <Text style={[styles.hint, { color: muted }]}>
                          {config.mode === 'learn'
                            ? 'See explanations after each answer.'
                            : 'No answers until the end, exam feel.'}
                        </Text>
                      </View>

                      <View style={styles.fieldCol}>
                        <FieldLabel>Timer</FieldLabel>
                        <BinaryToggle
                          accessibilityLabel="Quiz timer"
                          value={config.timed}
                          options={[
                            { value: false, label: 'Off' },
                            { value: true, label: 'On (~1 min/Q)' },
                          ]}
                          onChange={(timed) =>
                            setConfig((c) => ({
                              ...c,
                              timed,
                              time_limit_seconds: timed ? c.question_count * 60 : null,
                            }))
                          }
                        />
                        {config.timed ? (
                          <Text style={[styles.hint, { color: muted }]}>
                            Ends automatically when time runs out; unanswered items are skipped.
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <View style={styles.fieldRow}>
                      <View style={styles.fieldCol}>
                        <FieldLabel>Questions</FieldLabel>
                        <TextInput
                          value={questionCountInput}
                          onChangeText={applyQuestionCount}
                          onFocus={() => setCountFocused(true)}
                          onBlur={blurQuestionCount}
                          keyboardType="number-pad"
                          inputMode="numeric"
                          accessibilityLabel="Number of questions"
                          style={[
                            styles.countInput,
                            styles.countInputInline,
                            {
                              color: ink,
                              backgroundColor: fieldBg,
                              borderColor: countFocused ? STUDY_INK : fieldBorder,
                            },
                            countFocused ? FOCUS_RING : null,
                          ]}
                        />
                        {maxQuestionCount < MAX_QUESTION_COUNT ? (
                          <Text style={{ color: muted, fontSize: 12, marginTop: 8 }}>
                            Free includes {maxQuestionCount} questions per note.
                          </Text>
                        ) : null}
                      </View>

                      <View style={styles.fieldCol}>
                        <FieldLabel>Difficulty</FieldLabel>
                        <Pressable
                          onPress={() => {
                            setDifficultyOpen((v) => !v);
                            setTypesOpen(false);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Difficulty"
                          style={selectTrigger(difficultyOpen)}
                        >
                          <Text style={[styles.selectValue, { color: ink }]} numberOfLines={1}>
                            {difficultyLabel}
                          </Text>
                          <ChevronDown size={16} strokeWidth={ICON_STROKE} color={muted} />
                        </Pressable>
                        {difficultyOpen ? (
                          <View
                            style={[
                              styles.menu,
                              { backgroundColor: paper, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E4E4E7' },
                            ]}
                          >
                            {QUIZ_DIFFICULTIES.map((d) => {
                              const on = config.difficulty === d.value;
                              return (
                                <Pressable
                                  key={d.value}
                                  onPress={() => {
                                    setConfig((c) => ({ ...c, difficulty: d.value }));
                                    setDifficultyOpen(false);
                                  }}
                                  style={styles.menuRow}
                                >
                                  <Text style={[styles.menuLabel, { color: ink }]}>{d.label}</Text>
                                  {on ? <Check size={16} strokeWidth={ICON_STROKE} color={ink} /> : null}
                                </Pressable>
                              );
                            })}
                          </View>
                        ) : null}
                      </View>

                      <View style={styles.fieldCol}>
                        <FieldLabel>Types</FieldLabel>
                        <Pressable
                          onPress={() => {
                            setTypesOpen((v) => !v);
                            setDifficultyOpen(false);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Question types"
                          style={selectTrigger(typesOpen)}
                        >
                          <Text style={[styles.selectValue, { color: ink }]} numberOfLines={1}>
                            {typeSummary}
                          </Text>
                          <ChevronDown size={16} strokeWidth={ICON_STROKE} color={muted} />
                        </Pressable>
                        {typesOpen ? (
                          <View
                            style={[
                              styles.menu,
                              { backgroundColor: paper, borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E4E4E7' },
                            ]}
                          >
                            {QUIZ_QUESTION_TYPES.map((t) => {
                              const on = config.question_types.includes(t.value);
                              return (
                                <Pressable
                                  key={t.value}
                                  onPress={() => toggleType(t.value)}
                                  style={styles.menuRow}
                                  accessibilityRole="checkbox"
                                  accessibilityState={{ checked: on }}
                                >
                                  <CheckBox checked={on} />
                                  <Text style={[styles.menuLabel, { color: ink }]}>{t.label}</Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <Text style={[styles.hint, { color: muted }]}>
                      Enter a number from {MIN_QUESTION_COUNT}–{maxQuestionCount}.
                    </Text>

                    {chapters.length > 0 ? (
                      <View
                        style={[
                          styles.chapterShell,
                          {
                            backgroundColor: isDark ? 'rgba(9,9,11,0.5)' : 'rgba(255,255,255,0.7)',
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)',
                          },
                        ]}
                      >
                        <FieldLabel>Select Chapters</FieldLabel>
                        <ScrollView style={styles.chapterList} nestedScrollEnabled>
                          <Pressable
                            onPress={handleAllChapters}
                            style={styles.chapterRow}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: allSelected }}
                          >
                            <CheckBox checked={allSelected} />
                            <Text style={[styles.chapterAll, { color: ink }]}>
                              All Chapters ({chapters.length})
                            </Text>
                          </Pressable>
                          {chapters.map((ch) => {
                            if (ch.id == null) return null;
                            const isOn = allSelected || selectedIds.includes(ch.id);
                            return (
                              <Pressable
                                key={ch.id}
                                onPress={() => handleChapterToggle(ch.id)}
                                style={styles.chapterRow}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: isOn }}
                              >
                                <CheckBox checked={isOn} />
                                <Text style={[styles.checkLabel, { color: ink }]}>
                                  {ch.title || `Chapter ${ch.id}`}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </View>
                    ) : null}

                    {inProgress ? (
                      <Text
                        style={[
                          styles.warning,
                          isDark
                            ? { backgroundColor: 'rgba(69, 26, 3, 0.4)', color: '#FDE68A' }
                            : { backgroundColor: '#FFFBEB', color: '#92400E' },
                        ]}
                      >
                        Starting now will save your current in-progress quiz as incomplete.
                      </Text>
                    ) : null}

                    <View style={styles.footer}>
                      <Pressable
                        onPress={onStart}
                        disabled={!hasNotes}
                        style={({ pressed }) => [
                          styles.footerBtn,
                          styles.footerPrimary,
                          { opacity: !hasNotes ? 0.45 : pressed ? 0.92 : 1 },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !hasNotes }}
                      >
                        <Text style={styles.footerPrimaryText}>Start</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleClose}
                        style={({ pressed }) => [
                          styles.footerBtn,
                          styles.footerSecondary,
                          {
                            backgroundColor: isDark ? '#18181B' : '#F1F0EC',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,47,35,0.12)',
                            opacity: pressed ? 0.88 : 1,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel"
                      >
                        <Text style={[styles.footerSecondaryText, { color: isDark ? '#E4E4E7' : '#27272A' }]}>
                          Cancel
                        </Text>
                      </Pressable>
                    </View>
                  </ScrollView>
                </>
              )}
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 24,
  },
  modal: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  header: {
    gap: 6,
    paddingRight: 28,
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Fonts.ui.regular,
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    gap: 20,
    paddingBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  fieldCol: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  hint: {
    marginTop: 8,
    fontFamily: Fonts.ui.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  toggleTrack: {
    flexDirection: 'row',
    width: '100%',
    borderRadius: 999,
    borderWidth: 1,
    padding: 2,
  },
  toggleBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleLabel: {
    fontFamily: Fonts.ui.medium,
    fontSize: 12,
  },
  countInput: {
    height: 44,
    maxWidth: 128,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontFamily: Fonts.ui.regular,
    fontSize: 16,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  countInputInline: {
    maxWidth: undefined,
    width: '100%',
    minHeight: 40,
    height: 40,
    fontSize: 14,
  },
  selectTrigger: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  selectValue: {
    flex: 1,
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
  },
  menu: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 4,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuLabel: {
    flex: 1,
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
  },
  checkBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkLabel: {
    flex: 1,
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  chapterShell: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chapterList: {
    maxHeight: 160,
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 6,
  },
  chapterAll: {
    flex: 1,
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
  },
  warning: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: Fonts.ui.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    gap: 8,
  },
  footerBtn: {
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  footerPrimary: {
    backgroundColor: STUDY_INK,
  },
  footerPrimaryText: {
    color: '#FAFAFA',
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
  },
  footerSecondary: {
    borderWidth: 1,
  },
  footerSecondaryText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
  },
  errorText: {
    fontFamily: Fonts.ui.regular,
    fontSize: 13,
    color: '#B91C1C',
  },
});

export default QuizCreateDialog;
