import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Platform,
  ScrollView,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Text,
} from 'react-native';
import { GraduationCap, X } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { BRAND_COLORS } from '@/config/brand';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import {
  DIALOG_CLOSE_MS,
  DIALOG_OPEN_MS,
  DIALOG_ZOOM_FROM,
  USE_NATIVE_DRIVER,
  boxShadow,
  hideWebFocusRing,
  overlayBlurStyle,
  pointerEventsProp,
  pointerEventsStyle,
} from '@/theme/webCompat';
import { DIFFICULTIES, MAX_QUESTIONS, MIN_QUESTIONS } from '@/screens/exam-prep/testPrepConstants';
import { parseQuestionCount } from '@/screens/exam-prep/testPrepFormatters';
import EvalGeneratingState from './EvalGeneratingState';

const EASE_DIALOG = Easing.bezier(0.4, 0, 0.2, 1);

type StartPayload = {
  evalType: 'mcq' | 'qa';
  questionCount: number;
  difficulty: string;
  timed: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  pyqs: string;
  onPyqsChange: (value: string) => void;
  onSavePyqs: () => Promise<void> | void;
  savingPyqs: boolean;
  pyqsSaved?: boolean;
  onStartTest: (opts: StartPayload) => void;
  starting: boolean;
};

const ExamUploadModal: React.FC<Props> = ({
  open,
  onClose,
  pyqs,
  onPyqsChange,
  onSavePyqs,
  savingPyqs,
  pyqsSaved,
  onStartTest,
  starting,
}) => {
  const themeMode = useAppTheme();
  const isDark = themeMode === 'dark';
  const theme = isDark ? darkTheme : lightTheme;
  const [evalType, setEvalType] = useState<'mcq' | 'qa'>('mcq');
  const [questionCountInput, setQuestionCountInput] = useState('10');
  const [questionCountError, setQuestionCountError] = useState('');
  const [difficulty, setDifficulty] = useState('mixed');
  const [timed, setTimed] = useState(false);
  const [difficultyOpen, setDifficultyOpen] = useState(false);
  const [mounted, setMounted] = useState(open);
  const progress = React.useRef(new Animated.Value(open ? 1 : 0)).current;

  useEffect(() => {
    if (!open || starting) return;
    setEvalType('mcq');
    setQuestionCountInput('10');
    setQuestionCountError('');
    setDifficulty('mixed');
    setTimed(false);
    setDifficultyOpen(false);
  }, [open, starting]);

  useEffect(() => {
    if (open) setMounted(true);
    Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? DIALOG_OPEN_MS : DIALOG_CLOSE_MS,
      easing: EASE_DIALOG,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(({ finished }) => {
      if (finished && !open) setMounted(false);
    });
  }, [open, progress]);

  const handleClose = () => {
    if (starting) return;
    onClose();
  };

  const handleQuestionCountChange = (next: string) => {
    if (next === '' || /^\d+$/.test(next)) {
      setQuestionCountInput(next);
      setQuestionCountError('');
    }
  };

  const handleStart = async () => {
    const parsed = parseQuestionCount(questionCountInput);
    if (parsed == null) {
      setQuestionCountError(`Enter a whole number between ${MIN_QUESTIONS} and ${MAX_QUESTIONS}`);
      return;
    }
    setQuestionCountError('');
    if ((pyqs || '').trim()) {
      try {
        await onSavePyqs?.();
      } catch {
        /* savePyqs already surfaces errors */
      }
    }
    onStartTest({ evalType, questionCount: parsed, difficulty, timed });
  };

  if (!mounted) return null;

  const paper = isDark ? '#18181B' : '#FFFFFF';
  const border = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,47,35,0.1)';
  const ink = isDark ? '#FAFAFA' : BRAND_COLORS.ink;
  const muted = isDark ? '#A1A1AA' : '#71717A';
  const fieldBg = isDark ? '#09090B' : '#FFFFFF';
  const fieldBorder = isDark ? 'rgba(255,255,255,0.1)' : '#E4E4E7';
  const segmentBg = isDark ? '#27272A' : '#F4F4F5';
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [DIALOG_ZOOM_FROM, 1],
  });
  const difficultyLabel = DIFFICULTIES.find((d) => d.value === difficulty)?.label || 'Mixed';
  const charCount = (pyqs || '').length.toLocaleString();

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.flex} accessibilityViewIsModal>
          <Animated.View
            style={[
              styles.backdrop,
              overlayBlurStyle,
              { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(24,24,27,0.45)', opacity: progress },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityLabel="Close" />
          </Animated.View>

          <View style={[styles.center, pointerEventsStyle('box-none')]} pointerEvents={pointerEventsProp('box-none')}>
            <Animated.View
              accessibilityLabel="Create practice"
              style={[
                styles.modal,
                {
                  backgroundColor: paper,
                  borderColor: border,
                  opacity: progress,
                  transform: [{ scale }],
                },
              ]}
            >
              {starting ? (
                <ScrollView contentContainerStyle={styles.generating} showsVerticalScrollIndicator={false}>
                  <EvalGeneratingState
                    questionCount={parseQuestionCount(questionCountInput) || 10}
                    evalType={evalType}
                  />
                </ScrollView>
              ) : (
                <>
                  <Pressable
                    onPress={handleClose}
                    hitSlop={8}
                    style={styles.closeButton}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <X size={16} strokeWidth={ICON_STROKE} color={muted} />
                  </Pressable>

                  <View style={styles.header}>
                    <Text style={[styles.title, { color: ink }]}>Create practice</Text>
                    <Text style={[styles.description, { color: muted }]}>
                      Paste PYQs if you have them, then configure and start a test from your linked notes.
                    </Text>
                  </View>

                  <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.fieldHead}>
                      <Text style={[styles.fieldLabel, { color: muted }]}>Past-year questions</Text>
                      <Text style={[styles.charCount, { color: muted }]}>{charCount} characters</Text>
                    </View>
                    <TextInput
                      value={pyqs}
                      onChangeText={onPyqsChange}
                      placeholder="Paste previous year questions here (optional)…"
                      placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                      multiline
                      textAlignVertical="top"
                      style={[
                        styles.textarea,
                        hideWebFocusRing,
                        { color: ink, backgroundColor: fieldBg, borderColor: fieldBorder },
                      ]}
                    />
                    <Pressable onPress={() => void onSavePyqs()} disabled={savingPyqs} style={styles.savePyqs}>
                      <Text style={[styles.savePyqsText, { color: isDark ? '#9BB8A6' : theme.colors.secondary }]}>
                        {savingPyqs ? 'Saving…' : pyqsSaved ? 'Saved' : 'Save PYQs only'}
                      </Text>
                    </Pressable>

                    <Text style={[styles.fieldLabel, { color: muted, marginTop: 16 }]}>Type</Text>
                    <Segmented
                      isDark={isDark}
                      ink={ink}
                      muted={muted}
                      segmentBg={segmentBg}
                      options={[
                        { value: 'mcq', label: 'Multiple choice' },
                        { value: 'qa', label: 'Q&A' },
                      ]}
                      value={evalType}
                      onChange={setEvalType}
                    />

                    <View style={styles.row}>
                      <View style={styles.col}>
                        <Text style={[styles.fieldLabel, { color: muted }]}>Questions</Text>
                        <TextInput
                          value={questionCountInput}
                          onChangeText={handleQuestionCountChange}
                          onBlur={() => {
                            if (!questionCountInput.trim()) {
                              setQuestionCountError('Enter a whole number');
                              return;
                            }
                            if (parseQuestionCount(questionCountInput) == null) {
                              setQuestionCountError(
                                `Enter a whole number between ${MIN_QUESTIONS} and ${MAX_QUESTIONS}`
                              );
                            }
                          }}
                          keyboardType="number-pad"
                          inputMode="numeric"
                          placeholder="e.g. 10"
                          placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
                          style={[
                            styles.input,
                            hideWebFocusRing,
                            {
                              color: ink,
                              backgroundColor: fieldBg,
                              borderColor: questionCountError ? theme.colors.error : fieldBorder,
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.helper,
                            { color: questionCountError ? theme.colors.error : muted },
                          ]}
                        >
                          {questionCountError || `Whole number, ${MIN_QUESTIONS}–${MAX_QUESTIONS}`}
                        </Text>
                      </View>
                      <View style={styles.col}>
                        <Text style={[styles.fieldLabel, { color: muted }]}>Difficulty</Text>
                        <Pressable
                          onPress={() => setDifficultyOpen((v) => !v)}
                          style={[
                            styles.input,
                            styles.select,
                            { backgroundColor: fieldBg, borderColor: fieldBorder },
                          ]}
                        >
                          <Text style={{ color: ink, fontFamily: Fonts.ui.regular, fontSize: 14 }}>
                            {difficultyLabel}
                          </Text>
                          <Text style={{ color: muted, fontSize: 12 }}>▾</Text>
                        </Pressable>
                        {difficultyOpen
                          ? DIFFICULTIES.map((d) => (
                              <Pressable
                                key={d.value}
                                onPress={() => {
                                  setDifficulty(d.value);
                                  setDifficultyOpen(false);
                                }}
                                style={[
                                  styles.diffOption,
                                  {
                                    backgroundColor:
                                      difficulty === d.value
                                        ? isDark
                                          ? 'rgba(122,158,134,0.18)'
                                          : BRAND_COLORS.growthSoft
                                        : 'transparent',
                                  },
                                ]}
                              >
                                <Text style={{ color: ink, fontFamily: Fonts.ui.regular, fontSize: 14 }}>
                                  {d.label}
                                </Text>
                              </Pressable>
                            ))
                          : null}
                      </View>
                    </View>

                    <Text style={[styles.fieldLabel, { color: muted, marginTop: 8 }]}>Timer</Text>
                    <Segmented
                      isDark={isDark}
                      ink={ink}
                      muted={muted}
                      segmentBg={segmentBg}
                      options={[
                        { value: 'off', label: 'Off' },
                        { value: 'on', label: 'On (~1 min/Q)' },
                      ]}
                      value={timed ? 'on' : 'off'}
                      onChange={(v) => setTimed(v === 'on')}
                    />
                    {timed ? (
                      <Text style={[styles.helper, { color: muted }]}>
                        Ends automatically when time runs out; unanswered items are left blank.
                      </Text>
                    ) : null}
                  </ScrollView>

                  <View style={styles.footer}>
                    <Pressable
                      onPress={() => void handleStart()}
                      style={({ pressed }) => [
                        styles.primaryBtn,
                        { backgroundColor: BRAND_COLORS.ink, opacity: pressed ? 0.92 : 1 },
                      ]}
                    >
                      <GraduationCap size={16} strokeWidth={ICON_STROKE} color="#FFFFFF" />
                      <Text style={styles.primaryBtnText}>Start test</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleClose}
                      style={({ pressed }) => [
                        styles.secondaryBtn,
                        { backgroundColor: segmentBg, opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <Text style={[styles.secondaryBtnText, { color: ink }]}>Cancel</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

function Segmented<T extends string>({
  options,
  value,
  onChange,
  ink,
  muted,
  segmentBg,
  isDark,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ink: string;
  muted: string;
  segmentBg: string;
  isDark: boolean;
}) {
  return (
    <View style={[styles.segment, { backgroundColor: segmentBg }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.segmentBtn,
              active && {
                backgroundColor: isDark ? '#09090B' : '#FFFFFF',
                ...boxShadow('0 1px 2px rgba(0,0,0,0.06)', {
                  shadowColor: '#000',
                  shadowOpacity: 0.06,
                  shadowRadius: 2,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 1,
                }),
              },
            ]}
          >
            <Text
              style={{
                fontFamily: Fonts.ui.medium,
                fontSize: 13,
                color: active ? ink : muted,
                textAlign: 'center',
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    alignSelf: 'center',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  generating: { padding: 20 },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingRight: 48, paddingBottom: 8 },
  title: { fontFamily: Fonts.ui.semiBold, fontSize: 18 },
  description: { marginTop: 6, fontFamily: Fonts.ui.regular, fontSize: 13, lineHeight: 18 },
  scroll: { maxHeight: 460 },
  content: { paddingHorizontal: 20, paddingBottom: 8 },
  fieldHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  fieldLabel: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  charCount: { fontFamily: Fonts.ui.regular, fontSize: 11 },
  textarea: {
    minHeight: 110,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
  },
  savePyqs: { alignSelf: 'flex-end', marginTop: 8, paddingVertical: 4 },
  savePyqsText: { fontFamily: Fonts.ui.semiBold, fontSize: 12 },
  row: { flexDirection: 'row', gap: 12, marginTop: 16 },
  col: { flex: 1 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
  },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  diffOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginTop: 4 },
  helper: { marginTop: 6, fontFamily: Fonts.ui.regular, fontSize: 11, lineHeight: 16 },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 8 },
  primaryBtn: {
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { color: '#FFFFFF', fontFamily: Fonts.ui.bold, fontSize: 15 },
  secondaryBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { fontFamily: Fonts.ui.semiBold, fontSize: 15 },
});

export default ExamUploadModal;
