import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useContent } from '@/api/queries/content';
import type { Chapter } from '@/api/schemas/content';
import StudyGenerationProcessingScreen from './StudyGenerationProcessingScreen';
import KatexWebView from '@/components/ui/KatexWebView';
import { hasMath } from '@/utils/mathContent';
import { useQuizSession } from '@/study-hub/useQuizSession';
import { quizOptions } from '@shared/quiz/quizSession.js';
import { unwrapQuizChoice } from '@/study-hub/quizGrade';
import {
  playQuizAnswerSelected,
  preloadQuizAnswerFeedback,
} from '@/study-hub/quizAnswerFeedback';
import {
  defaultQuizConfig,
  formatSetWhen,
  quizSetActionLabel,
  setKindMeta,
  typeLabels,
} from '@/study-hub/quizConfig';
import { buildQuizChatContext } from '@/study-hub/chatContext';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lightbulb,
  Plus,
  Settings2,
  Star,
  X,
} from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import QuizCreateDialog from './QuizCreateDialog';
import QuizLiveSettings from './QuizLiveSettings';
import QuizProGate from './QuizProGate';
import FillBlankPrompt, {
  FILL_REVEAL,
  useFillBlankMeta,
  type FillRevealStage,
} from './FillBlankPrompt';
import { StudyPillButton } from './StudyPillButton';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { boxShadow, pointerEventsStyle, USE_NATIVE_DRIVER } from '@/theme/webCompat';
import {
  STUDY_BORDER,
  STUDY_GROWTH,
  STUDY_INK,
  STUDY_PAPER,
  STUDY_PAPER_DARK,
  STUDY_ZINC_500,
  studySubStyle,
  studyTitleStyle,
} from './studyPanelTokens';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const PLAY_CARD_SHADOW = boxShadow('0 1px 2px 0 rgba(0,0,0,0.05)', {
  shadowColor: '#000',
  shadowOpacity: 0.05,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
});

const ZINC_200 = '#E4E4E7';
const ZINC_500 = '#71717A';
const ZINC_600 = '#52525B';
const ZINC_700 = '#3F3F46';
const ZINC_900 = '#18181B';
const EMERALD_50 = '#ECFDF5';
const EMERALD_200 = 'rgba(167, 243, 208, 0.8)';
const EMERALD_500 = '#10B981';
const EMERALD_700 = '#047857';
const RED_50 = '#FEF2F2';
const RED_200 = 'rgba(254, 202, 202, 0.8)';
const RED_500 = '#EF4444';
const RED_700 = '#B91C1C';
const AMBER_50 = '#FFFBEB';
const AMBER_100 = '#FAF6EE';
const AMBER_200 = 'rgba(253, 230, 138, 0.7)';
const AMBER_500 = '#F59E0B';
const AMBER_800 = '#92400E';
const AMBER_950 = '#78350F';

const MathOrText: React.FC<{
  text: string;
  color: string;
  backgroundColor: string;
  fontSize: number;
  variant: React.ComponentProps<typeof Text>['variant'];
  textStyle: any;
}> = ({ text, color, backgroundColor, fontSize, variant, textStyle }) => {
  if (!hasMath(text)) {
    return (
      <Text variant={variant} style={textStyle}>
        {text}
      </Text>
    );
  }
  return (
    <View style={[{ width: '100%' }, pointerEventsStyle('none')]}>
      <KatexWebView
        content={text}
        fontSize={fontSize}
        textColor={color}
        backgroundColor={backgroundColor}
      />
    </View>
  );
};

function resultLabel(isCorrect: boolean | null | undefined): {
  text: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  color: string;
} {
  if (isCorrect === true) return { text: 'Correct', icon: 'check-circle', color: '#059669' };
  if (isCorrect === false) return { text: 'Incorrect', icon: 'close-circle', color: '#DC2626' };
  return { text: 'Unanswered', icon: 'minus-circle', color: ZINC_500 };
}


interface AssessmentsTabProps {
  contentId: number;
  onClose?: () => void;
  onAskInChat?: (context: string | null) => void;
  embedded?: boolean;
}

const AssessmentsTab: React.FC<AssessmentsTabProps> = ({ contentId, onClose, onAskInChat, embedded }) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const user = useAuthStore((s) => s.user);
  const { data: contentData } = useContent(contentId);
  const content = contentData?.data;
  const chapters: Chapter[] = useMemo(() => content?.chapters || [], [content?.chapters]);
  const [selectedChapters, setSelectedChapters] = useState<number[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [fillRevealStage, setFillRevealStage] = useState<FillRevealStage>(FILL_REVEAL.EDITING);
  const pendingStartRef = useRef<{ forceNew?: boolean; configOverride?: ReturnType<typeof defaultQuizConfig> } | null>(
    null
  );

  useEffect(() => {
    preloadQuizAnswerFeedback();
  }, []);

  const chapterIds = useMemo(() => {
    if (selectedChapters === null) return null;
    return selectedChapters.length ? selectedChapters : null;
  }, [selectedChapters]);

  const quiz = useQuizSession({
    contentId,
    userId: user?.id,
    chapterIds,
  });

  const wrongShakeX = useRef(new Animated.Value(0)).current;
  const lastWrongShakeKey = useRef('');

  useEffect(() => {
    setFillRevealStage(FILL_REVEAL.EDITING);
    setHintOpen(false);
  }, [quiz.displayPosition, quiz.currentQuestionId]);

  useEffect(() => {
    if (!quiz.displaySubmitted || quiz.displayGrade?.is_correct !== false || quiz.viewingPast) return;
    // Fill-blank uses its own strike animation instead of the option shake.
    const dq = quiz.displayQuestion;
    const shakeOptions = quizOptions(dq);
    if (!shakeOptions) return;
    const key = `${quiz.currentQuestionId}-${quiz.displayPosition}`;
    if (lastWrongShakeKey.current === key) return;
    lastWrongShakeKey.current = key;
    wrongShakeX.setValue(0);
    Animated.sequence([
      Animated.timing(wrongShakeX, { toValue: -10, duration: 64, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(wrongShakeX, { toValue: 10, duration: 64, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(wrongShakeX, { toValue: -6, duration: 64, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(wrongShakeX, { toValue: 4, duration: 64, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(wrongShakeX, { toValue: 0, duration: 64, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [
    quiz.displaySubmitted,
    quiz.displayGrade?.is_correct,
    quiz.viewingPast,
    quiz.currentQuestionId,
    quiz.displayPosition,
    quiz.displayQuestion,
    wrongShakeX,
  ]);

  const timerLabel = quiz.timerLabel;

  const q = quiz.displayQuestion;
  const options = quizOptions(q);
  const isFillBlank = Boolean(q) && !options;
  const fillMeta = useFillBlankMeta(
    isFillBlank ? q?.question || '' : '',
    (quiz.viewingPast || quiz.displaySubmitted ? quiz.displayAnswer : quiz.selectedAnswer) || ''
  );
  const fillFeedbackReady =
    !isFillBlank ||
    quiz.viewingPast ||
    quiz.mode !== 'learn' ||
    fillRevealStage === FILL_REVEAL.DONE;
  const showFeedback =
    quiz.mode === 'learn' &&
    quiz.displaySubmitted &&
    quiz.displayGrade &&
    !quiz.advancing &&
    fillFeedbackReady;
  const answersLocked =
    quiz.displaySubmitted ||
    quiz.viewingPast ||
    quiz.remainingSeconds === 0 ||
    quiz.busy ||
    quiz.crafting;
  const hintText = useMemo((): string => {
    const customHint = (q as { hint?: string | null } | null | undefined)?.hint;
    if (typeof customHint === 'string' && customHint.trim()) return customHint;
    if (q?.topic) {
      return `Think back to “${q.topic}” in your notes before choosing.`;
    }
    return 'Eliminate options that contradict the source, then pick the strongest remaining answer.';
  }, [q]);
  const questionChoices = useMemo(() => {
    const items: {
      index: number;
      ready: boolean;
      answered: boolean;
      correct: boolean;
      incorrect: boolean;
    }[] = [];
    for (let i = 1; i <= quiz.total; i += 1) {
      const row = quiz.history[i - 1];
      items.push({
        index: i,
        ready: Boolean(row),
        answered: Boolean(row?.user_answer != null),
        correct: row?.is_correct === true,
        incorrect: row?.is_correct === false,
      });
    }
    return items;
  }, [quiz.history, quiz.total]);

  if (quiz.loading && !quiz.generating) {
    return <StudyGenerationProcessingScreen serviceType="quiz" message="Loading quiz…" />;
  }

  const c = theme.colors;
  const paper = themeMode === 'dark' ? STUDY_PAPER_DARK : STUDY_PAPER;
  const hasNotes = (content?.topics?.length ?? 0) > 0 || (content?.chapters?.length ?? 0) > 0;
  const hasHistory = quiz.quizSets.length > 0;

  const runStart = async (opts?: { forceNew?: boolean; configOverride?: ReturnType<typeof defaultQuizConfig> }) => {
    setCreateOpen(false);
    return quiz.startSession({ forceNew: true, ...opts });
  };

  const requestStart = (opts?: { configOverride?: ReturnType<typeof defaultQuizConfig> }) => {
    if (quiz.inProgressSet) {
      pendingStartRef.current = opts || {};
      setConfirmNewOpen(true);
      return;
    }
    void runStart(opts);
  };

  const renderSetup = () => (
    <>
      <ScrollView contentContainerStyle={styles.setupPad} style={{ backgroundColor: paper }}>
        <Text style={[studyTitleStyle, { color: themeMode === 'dark' ? '#FAFAFA' : STUDY_INK }]}>
          Quiz
        </Text>
        <Text style={[studySubStyle, { color: STUDY_ZINC_500, marginBottom: 20 }]}>
          {quiz.quotaExhausted
            ? 'You have used your 5 free questions on this note.'
            : 'Start when you are ready. The first 5 questions unlock together, then more arrive in batches while you play.'}
        </Text>

        {quiz.error ? (
          <Text style={styles.errorText}>{quiz.error}</Text>
        ) : null}

        {quiz.quotaExhausted && !quiz.inProgressSet ? (
          <QuizProGate />
        ) : quiz.quotaExhausted ? null : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyKicker}>Practice from your notes</Text>
          <Text style={styles.emptyTitle}>Start quiz</Text>
          <Text style={styles.emptyCopy}>
            We’ll craft a first set of 5 questions, then keep filling the rest in the background.
          </Text>
          {!hasNotes ? (
            <Text style={styles.emptyHint}>Notes are still processing. Start unlocks when they’re ready.</Text>
          ) : (
            <View style={styles.emptyCta}>
              <StudyPillButton
                label="Start quiz"
                loading={quiz.busy}
                disabled={quiz.busy || !hasNotes}
                onPress={() => requestStart()}
              />
              <StudyPillButton
                label="Customize"
                variant="secondary"
                disabled={quiz.busy || !hasNotes}
                onPress={() => setCreateOpen(true)}
              />
            </View>
          )}
        </View>
        )}

        {quiz.starred.length > 0 ? (
          <TouchableOpacity
            onPress={() => quiz.setPhase('starred')}
            style={[styles.setCard, { backgroundColor: '#fff', borderColor: STUDY_BORDER }]}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.setTitleRow}>
                <Text style={styles.setTitle}>Starred questions</Text>
                <View style={styles.setBadge}>
                  <Text style={styles.setBadgeText}>Set</Text>
                </View>
              </View>
              <Text style={styles.setMeta}>
                {quiz.starred.length} saved · open to review or remove
              </Text>
            </View>
            <ArrowRight size={16} strokeWidth={ICON_STROKE} color="#A1A1AA" />
          </TouchableOpacity>
        ) : null}

        {hasHistory
          ? quiz.quizSets.map((set) => {
            const meta = setKindMeta(set.kind);
            const cfg = set.config || {};
            const when = formatSetWhen(set.updated_at || set.completed_at || set.started_at);
            const scoreLine =
              set.kind === 'in_progress'
                ? `${set.answered_count || 0} of ${set.question_count} answered`
                : set.score
                  ? `${set.score.correct}/${set.score.total ?? set.question_count}${
                      set.score.unanswered ? ` · ${set.score.unanswered} unanswered` : ''
                    }`
                  : `${set.answered_count || 0}/${set.question_count}`;
            return (
              <TouchableOpacity
                key={set.session_id}
                disabled={quiz.busy}
                onPress={() => void quiz.openQuizSet(set)}
                style={[
                  styles.setCard,
                  {
                    backgroundColor: '#fff',
                    borderColor:
                      set.kind === 'in_progress' ? 'rgba(63,107,79,0.22)' : STUDY_BORDER,
                    opacity: quiz.busy ? 0.6 : 1,
                  },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.setTitleRow}>
                    <Text style={styles.setTitle}>
                      {cfg.mode === 'exam' ? 'Exam' : 'Learn'} · {set.question_count} questions
                    </Text>
                    <View style={[styles.setBadge, { backgroundColor: meta.backgroundColor }]}>
                      <Text style={[styles.setBadgeText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.setMeta}>
                    {scoreLine}
                    {cfg.difficulty ? ` · ${cfg.difficulty}` : ''}
                    {typeLabels(cfg.question_types as string[] | undefined)
                      ? ` · ${typeLabels(cfg.question_types as string[] | undefined)}`
                      : ''}
                    {cfg.timed ? ' · Timed' : ''}
                  </Text>
                  {when ? <Text style={styles.setWhen}>{when}</Text> : null}
                </View>
                <Text style={styles.setAction}>{quizSetActionLabel(set)}</Text>
              </TouchableOpacity>
            );
          })
        : null}

      </ScrollView>
    </>
  );

  const renderPlaying = () => {
    const isDark = themeMode === 'dark';
    const playInk = isDark ? '#E4E4E7' : ZINC_900;
    const playMuted = isDark ? '#A1A1AA' : ZINC_500;
    const playNav = isDark ? '#D4D4D8' : ZINC_600;
    const cardBg = isDark ? '#111113' : '#FFFFFF';
    const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,47,35,0.15)';
    const brandTint = isDark ? '#9BB8A6' : STUDY_INK;
    const showCrafting = (quiz.crafting || quiz.generating || (!q && quiz.advancing)) && !quiz.needsUpgrade;
    const firstBatchWait = Boolean(quiz.generating && !q);
    const checkDisabled =
      quiz.busy ||
      quiz.remainingSeconds === 0 ||
      (isFillBlank ? !fillMeta.allFilled : !quiz.selectedAnswer.trim());

    const actionBtn = (label: string, onPress: () => void, disabled: boolean) => (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        style={[
          styles.playAction,
          { backgroundColor: isDark ? '#3F6B4F' : STUDY_INK, opacity: disabled ? 0.5 : 1 },
        ]}
      >
        <Text style={styles.playActionText}>{label}</Text>
      </TouchableOpacity>
    );

    const topChrome = (
      <>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={quiz.leavePlaying} hitSlop={12} style={styles.backRow}>
            <ArrowLeft size={16} strokeWidth={ICON_STROKE} color={playNav} />
            <Text style={[styles.playNavLabel, { color: playNav }]}>Test yourself</Text>
          </TouchableOpacity>
          <View style={[styles.topDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : ZINC_200 }]} />
          <View style={styles.topRight}>
            {timerLabel != null ? (
              <Text
                style={{
                  color: (quiz.remainingSeconds ?? 1) <= 30 ? RED_500 : brandTint,
                  fontFamily: Fonts.ui.semiBold,
                  fontSize: 14,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {timerLabel}
              </Text>
            ) : null}
            {!embedded && onAskInChat && !quiz.viewingPast && q ? (
              <TouchableOpacity
                onPress={() => onAskInChat(buildQuizChatContext(q, quiz.selectedAnswer))}
                hitSlop={12}
                accessibilityLabel="Ask AI about this question"
              >
                <MaterialCommunityIcons name="robot-outline" size={22} color={brandTint} />
              </TouchableOpacity>
            ) : null}
            {q ? (
              <TouchableOpacity
                onPress={() => quiz.toggleStarCurrent(q)}
                hitSlop={12}
                accessibilityLabel={quiz.isCurrentStarred ? 'Unstar question' : 'Star question'}
              >
                <Star
                  size={20}
                  strokeWidth={ICON_STROKE}
                  color={quiz.isCurrentStarred ? '#F59E0B' : '#A1A1AA'}
                  fill={quiz.isCurrentStarred ? '#F59E0B' : 'none'}
                />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              onPress={() => setSettingsOpen(true)}
              hitSlop={12}
              accessibilityLabel="Quiz settings"
              style={[
                styles.settingsChip,
                {
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : ZINC_200,
                },
              ]}
            >
              <Settings2 size={14} strokeWidth={ICON_STROKE} color={playMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.progressHeader}>
          <Award size={20} strokeWidth={ICON_STROKE} color={AMBER_500} />
          <View
            style={[
              styles.progressTrack,
              {
                flex: 1,
                marginBottom: 0,
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                borderColor: isDark ? 'transparent' : 'rgba(0,0,0,0.06)',
              },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: isDark ? '#7A9E86' : STUDY_GROWTH,
                  width: `${Math.min(100, (quiz.displayPosition / Math.max(1, quiz.total)) * 100)}%`,
                },
              ]}
            />
          </View>
          <TouchableOpacity
            onPress={() => setJumpOpen(true)}
            style={[
              styles.jumpTrigger,
              {
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : ZINC_200,
                backgroundColor: isDark ? '#111113' : '#FFFFFF',
              },
            ]}
            accessibilityLabel={`Question ${quiz.displayPosition}`}
          >
            <View style={[styles.jumpAccent, { backgroundColor: brandTint }]} />
            <Text style={{ color: playInk, fontFamily: Fonts.ui.semiBold, fontSize: 13 }}>
              Question {quiz.displayPosition}
            </Text>
            <ChevronDown size={14} strokeWidth={ICON_STROKE} color={playMuted} />
          </TouchableOpacity>
        </View>
      </>
    );

    if (quiz.needsUpgrade) {
      return (
        <View style={styles.flex}>
          {topChrome}
          <QuizProGate>
            <View style={{ paddingHorizontal: 24, paddingTop: 24, alignItems: 'center' }}>
              <Text style={{ color: playInk, fontFamily: Fonts.ui.semiBold, fontSize: 18, textAlign: 'center' }}>
                You’re on Pro
              </Text>
              <Text style={{ color: playMuted, fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 16 }}>
                Continue this quiz from where you left off.
              </Text>
              <StudyPillButton
                label="Continue quiz"
                loading={quiz.busy || quiz.advancing}
                onPress={() => void quiz.continueAfterUpgrade()}
              />
            </View>
          </QuizProGate>
        </View>
      );
    }

    if (!q && !showCrafting) {
      return (
        <View style={[styles.flex, styles.setupPad]}>
          <Text style={{ color: c.onSurface, fontFamily: Fonts.ui.semiBold, marginBottom: 8 }}>
            Couldn’t load this question
          </Text>
          <Text style={{ color: c.onSurfaceVariant, marginBottom: 16 }}>
            Your quiz was interrupted before questions finished generating. Retry to pick up where it left off, or go back and start fresh.
          </Text>
          {quiz.error ? (
            <Text style={[styles.errorText, { marginBottom: 12 }]}>{quiz.error}</Text>
          ) : null}
          <TouchableOpacity
            onPress={() => quiz.sessionId && quiz.recoverEmptySession(quiz.sessionId)}
            disabled={quiz.busy || !quiz.sessionId}
            style={[styles.primaryBtn, { backgroundColor: c.primary, opacity: quiz.busy || !quiz.sessionId ? 0.5 : 1 }]}
          >
            <Text style={styles.primaryBtnText}>{quiz.busy ? 'Loading…' : 'Retry'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={quiz.leavePlaying} style={{ marginTop: 12 }}>
            <Text style={{ color: c.primary, textAlign: 'center', fontFamily: Fonts.ui.medium }}>
              Back
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.flex}>
        {quiz.error ? (
          <View style={[styles.errorBanner, { backgroundColor: isDark ? 'rgba(248,113,113,0.12)' : '#FEF2F2' }]}>
            <Text style={[styles.errorText, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>{quiz.error}</Text>
          </View>
        ) : null}
        <View style={styles.playShell}>
          {topChrome}

          {quiz.remainingSeconds === 0 ? (
            <View
              style={[
                styles.timeoutBanner,
                {
                  backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : AMBER_50,
                  borderColor: isDark ? 'rgba(245,158,11,0.3)' : AMBER_200,
                },
              ]}
            >
              <Text
                style={{
                  color: isDark ? '#FDE68A' : AMBER_950,
                  fontFamily: Fonts.ui.regular,
                  fontSize: 13,
                  flex: 1,
                }}
              >
                {quiz.timeoutFinalizeFailed
                  ? "Time's up — we couldn't save your results. Tap Retry to finish."
                  : "Time's up — saving your results…"}
              </Text>
              {quiz.timeoutFinalizeFailed ? (
                <TouchableOpacity
                  onPress={() => void quiz.completeDueToTimeout()}
                  disabled={quiz.busy}
                  style={[styles.timeoutRetry, { opacity: quiz.busy ? 0.5 : 1 }]}
                >
                  <Text style={{ color: '#fff', fontFamily: Fonts.ui.semiBold, fontSize: 13 }}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.playScroll}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.playCard,
                { backgroundColor: cardBg, borderColor: cardBorder },
                isDark ? null : PLAY_CARD_SHADOW,
              ]}
            >
              {showCrafting ? (
                <View style={styles.craftingWrap}>
                  <View
                    style={[
                      styles.craftingIcon,
                      {
                        backgroundColor: isDark ? 'rgba(122,158,134,0.15)' : 'rgba(26,47,35,0.08)',
                      },
                    ]}
                  >
                    <Clock size={24} strokeWidth={ICON_STROKE} color={brandTint} />
                  </View>
                  <Text style={[styles.craftingTitle, { color: playInk }]}>
                    {firstBatchWait ? 'Crafting your first questions…' : 'Crafting your next question…'}
                  </Text>
                  <Text style={{ color: playMuted, fontSize: 14, textAlign: 'center', marginTop: 4 }}>
                    {firstBatchWait
                      ? 'The first 5 unlock together, then more arrive while you play.'
                      : 'Hang tight — this stays live while we write.'}
                  </Text>
                  <View style={styles.craftingBars}>
                    {[100, 92, 96, 88].map((w, i) => (
                      <View
                        key={i}
                        style={[
                          styles.craftingBar,
                          {
                            width: `${w}%`,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F4F4F5',
                            borderColor: isDark ? 'rgba(255,255,255,0.06)' : ZINC_200,
                            opacity: 0.85 - i * 0.08,
                          },
                        ]}
                      />
                    ))}
                  </View>
                </View>
              ) : (
                <>
                  {q?.topic ? (
                    <View
                      style={[
                        styles.topicPill,
                        {
                          backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : AMBER_50,
                        },
                      ]}
                    >
                      <Text style={[styles.topic, { color: isDark ? '#FDE68A' : AMBER_800, marginBottom: 0 }]}>
                        {q.topic}
                      </Text>
                    </View>
                  ) : null}
                  {options ? (
                    <>
                      <MathOrText
                        text={q?.question || ''}
                        color={playInk}
                        backgroundColor={cardBg}
                        fontSize={18}
                        variant="titleLarge"
                        textStyle={[styles.questionText, { color: playInk }]}
                      />
                      <Animated.View style={{ transform: [{ translateX: wrongShakeX }] }}>
                        {options.map((opt, idx) => {
                          const choice = unwrapQuizChoice(opt);
                          const selected = unwrapQuizChoice(quiz.displayAnswer) === choice;
                          const letter = OPTION_LETTERS[idx] || String(idx + 1);
                          let bg = isDark ? 'transparent' : '#FFFFFF';
                          let border = isDark ? 'rgba(255,255,255,0.1)' : ZINC_200;
                          let text = isDark ? '#F4F4F5' : ZINC_900;
                          let opacity = 1;
                          let badgeBg = isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F5';
                          let badgeColor = isDark ? '#D4D4D8' : ZINC_600;
                          let badgeIcon: 'check' | 'x' | null = null;
                          if (showFeedback && quiz.displayGrade) {
                            const correct = unwrapQuizChoice(quiz.displayGrade.correct_answer) === choice;
                            if (correct) {
                              bg = isDark ? 'rgba(122,158,134,0.10)' : EMERALD_50;
                              border = isDark ? 'rgba(122,158,134,0.55)' : EMERALD_500;
                              badgeBg = EMERALD_500;
                              badgeColor = '#FFFFFF';
                              badgeIcon = 'check';
                            } else if (selected) {
                              bg = isDark ? 'rgba(239,68,68,0.10)' : RED_50;
                              border = isDark ? 'rgba(248,113,113,0.5)' : RED_500;
                              badgeBg = RED_500;
                              badgeColor = '#FFFFFF';
                              badgeIcon = 'x';
                            } else {
                              opacity = isDark ? 0.5 : 0.7;
                              border = isDark ? 'rgba(255,255,255,0.08)' : ZINC_200;
                              text = isDark ? '#A1A1AA' : ZINC_900;
                              badgeBg = isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F5';
                              badgeColor = isDark ? '#A1A1AA' : ZINC_500;
                            }
                          } else if (selected) {
                            border = isDark ? 'rgba(122,158,134,0.4)' : STUDY_INK;
                            bg = isDark ? 'rgba(63,107,79,0.15)' : 'rgba(26,47,35,0.05)';
                            badgeBg = isDark ? '#7A9E86' : STUDY_INK;
                            badgeColor = '#FFFFFF';
                          }
                          return (
                            <TouchableOpacity
                              key={`${choice}-${idx}`}
                              disabled={answersLocked}
                              onPress={() => {
                                if (unwrapQuizChoice(quiz.selectedAnswer) !== choice) playQuizAnswerSelected();
                                void quiz.selectAnswer(choice);
                              }}
                              style={[styles.option, { backgroundColor: bg, borderColor: border, opacity }]}
                            >
                              <View style={[styles.optionBadge, { backgroundColor: badgeBg }]}>
                                {badgeIcon === 'check' ? (
                                  <Check size={14} strokeWidth={ICON_STROKE} color={badgeColor} />
                                ) : badgeIcon === 'x' ? (
                                  <X size={14} strokeWidth={ICON_STROKE} color={badgeColor} />
                                ) : (
                                  <Text style={{ color: badgeColor, fontFamily: Fonts.ui.semiBold, fontSize: 12 }}>
                                    {letter}
                                  </Text>
                                )}
                              </View>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <MathOrText
                                  text={choice}
                                  color={text}
                                  backgroundColor={bg}
                                  fontSize={14}
                                  variant="bodyLarge"
                                  textStyle={{
                                    color: text,
                                    fontFamily: Fonts.ui.regular,
                                    fontSize: 14,
                                    lineHeight: 20,
                                  }}
                                />
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </Animated.View>
                    </>
                  ) : (
                    <FillBlankPrompt
                      questionText={q?.question || ''}
                      answer={
                        quiz.viewingPast || quiz.displaySubmitted
                          ? quiz.displayAnswer || ''
                          : quiz.selectedAnswer || ''
                      }
                      onAnswerChange={quiz.setSelectedAnswer}
                      locked={answersLocked}
                      submitted={Boolean(
                        quiz.displaySubmitted && quiz.displayGrade && quiz.mode === 'learn'
                      )}
                      grade={
                        quiz.displaySubmitted && quiz.displayGrade && quiz.mode === 'learn'
                          ? {
                              is_correct: quiz.displayGrade.is_correct ?? undefined,
                              correct_answer: quiz.displayGrade.correct_answer ?? undefined,
                            }
                          : null
                      }
                      instantReveal={quiz.viewingPast}
                      ink={playInk}
                      muted={playMuted}
                      isDark={isDark}
                      onRevealStageChange={setFillRevealStage}
                      onSubmitAll={() => {
                        if (fillMeta.allFilled) void quiz.submitAnswerOnly();
                      }}
                    />
                  )}

                  {!quiz.viewingPast &&
                  (!quiz.displaySubmitted ||
                    (isFillBlank && quiz.mode === 'learn' && !fillFeedbackReady)) ? (
                    <View style={styles.hintRow}>
                      {isFillBlank &&
                      quiz.mode === 'learn' &&
                      (!quiz.displaySubmitted || !fillFeedbackReady)
                        ? actionBtn(
                            quiz.busy || (quiz.displaySubmitted && !fillFeedbackReady)
                              ? 'Grading…'
                              : 'Submit',
                            quiz.submitAnswerOnly,
                            checkDisabled || Boolean(quiz.displaySubmitted)
                          )
                        : null}
                      {!quiz.displaySubmitted ? (
                        <TouchableOpacity
                          onPress={() => setHintOpen((v) => !v)}
                          style={[
                            styles.hintBtn,
                            isFillBlank
                              ? {
                                  borderWidth: 1,
                                  borderColor: isDark ? 'rgba(122,158,134,0.35)' : 'rgba(26,47,35,0.2)',
                                  backgroundColor: isDark ? 'transparent' : '#FFFFFF',
                                }
                              : {
                                  backgroundColor: isDark
                                    ? 'rgba(122,158,134,0.15)'
                                    : 'rgba(26,47,35,0.08)',
                                  flex: 1,
                                },
                          ]}
                        >
                          <Lightbulb size={16} strokeWidth={ICON_STROKE} color={brandTint} />
                          <Text style={{ color: brandTint, fontFamily: Fonts.ui.medium, fontSize: 14 }}>
                            {hintOpen ? 'Hide hint' : 'Show hint'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}

                  {hintOpen && !quiz.displaySubmitted ? (
                    <View
                      style={[
                        styles.hintPanel,
                        {
                          backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(255,251,235,0.9)',
                          borderColor: isDark ? 'rgba(245,158,11,0.25)' : AMBER_200,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: isDark ? '#FDE68A' : AMBER_950,
                          fontFamily: Fonts.ui.regular,
                          fontSize: 14,
                          lineHeight: 20,
                        }}
                      >
                        {hintText}
                      </Text>
                    </View>
                  ) : null}

                  {showFeedback && quiz.displayGrade ? (
                    isFillBlank ? (
                      <View
                        style={[
                          styles.feedback,
                          {
                            backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : AMBER_100,
                            borderColor: isDark ? 'rgba(245,158,11,0.25)' : AMBER_200,
                            borderLeftWidth: 3,
                            borderLeftColor: isDark ? 'rgba(245,158,11,0.5)' : 'rgba(245,158,11,0.8)',
                          },
                        ]}
                      >
                        <View style={styles.feedbackTitleRow}>
                          <Lightbulb size={16} strokeWidth={ICON_STROKE} color={AMBER_500} />
                          <Text
                            style={{
                              color: playInk,
                              fontFamily: Fonts.ui.semiBold,
                              fontSize: 14,
                            }}
                          >
                            {quiz.displayGrade.is_correct ? "That's correct" : 'Explanation'}
                          </Text>
                        </View>
                        {!!quiz.displayGrade.explanation ? (
                          <View style={{ marginTop: 8 }}>
                            <MathOrText
                              text={quiz.displayGrade.explanation}
                              color={isDark ? '#D4D4D8' : ZINC_700}
                              backgroundColor="transparent"
                              fontSize={14}
                              variant="bodyMedium"
                              textStyle={{
                                color: isDark ? '#D4D4D8' : ZINC_700,
                                fontFamily: Fonts.ui.regular,
                                fontSize: 14,
                                lineHeight: 20,
                              }}
                            />
                          </View>
                        ) : (
                          <Text
                            style={{
                              color: isDark ? '#A1A1AA' : ZINC_600,
                              marginTop: 8,
                              fontSize: 14,
                            }}
                          >
                            {quiz.displayGrade.is_correct
                              ? 'Nice work — keep the streak going.'
                              : `Correct answer: ${unwrapQuizChoice(quiz.displayGrade.correct_answer) || '—'}`}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.feedback,
                          quiz.displayGrade.is_correct
                            ? {
                                backgroundColor: isDark ? 'rgba(122,158,134,0.10)' : EMERALD_50,
                                borderColor: isDark ? 'rgba(122,158,134,0.25)' : EMERALD_200,
                              }
                            : {
                                backgroundColor: isDark ? 'rgba(239,68,68,0.10)' : RED_50,
                                borderColor: isDark ? 'rgba(248,113,113,0.25)' : RED_200,
                              },
                        ]}
                      >
                        <Text
                          style={{
                            color: quiz.displayGrade.is_correct
                              ? isDark
                                ? '#9BB8A6'
                                : EMERALD_700
                              : isDark
                                ? '#FCA5A5'
                                : RED_700,
                            fontFamily: Fonts.ui.semiBold,
                            fontSize: 14,
                          }}
                        >
                          {quiz.displayGrade.is_correct ? "That's correct!" : 'Not quite'}
                        </Text>
                        {!!quiz.displayGrade.explanation && (
                          <View style={{ marginTop: 8 }}>
                            <MathOrText
                              text={quiz.displayGrade.explanation}
                              color={isDark ? '#D4D4D8' : ZINC_700}
                              backgroundColor="transparent"
                              fontSize={14}
                              variant="bodyMedium"
                              textStyle={{
                                color: isDark ? '#D4D4D8' : ZINC_700,
                                fontFamily: Fonts.ui.regular,
                                fontSize: 14,
                                lineHeight: 20,
                              }}
                            />
                          </View>
                        )}
                      </View>
                    )
                  ) : null}

                  <View style={styles.playFooter}>
                    <View style={styles.navRow}>
                      <TouchableOpacity
                        onPress={quiz.goPrevSlide}
                        disabled={!quiz.canGoPrev}
                        style={[styles.navBtn, { opacity: quiz.canGoPrev ? 1 : 0.3 }]}
                        accessibilityLabel="Previous question"
                      >
                        <ChevronLeft size={16} strokeWidth={ICON_STROKE} color={playNav} />
                        <Text style={[styles.playNavLabel, { color: playNav }]}>Back</Text>
                      </TouchableOpacity>
                      {quiz.canGoNext ? (
                        <TouchableOpacity
                          onPress={quiz.goNextSlide}
                          style={styles.navBtn}
                          accessibilityLabel="Next question"
                        >
                          <Text style={[styles.playNavLabel, { color: playNav }]}>Next</Text>
                          <ChevronRight size={16} strokeWidth={ICON_STROKE} color={playNav} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    {quiz.timeoutFinalizeFailed
                      ? actionBtn('Retry', () => void quiz.completeDueToTimeout(), quiz.busy)
                      : !quiz.viewingPast &&
                          quiz.mode === 'learn' &&
                          quiz.submitted &&
                          fillFeedbackReady
                        ? actionBtn(
                            quiz.advancing || quiz.crafting
                              ? 'Loading…'
                              : quiz.position >= quiz.total
                                ? 'See results'
                                : 'Continue',
                            quiz.continueAfterFeedback,
                            quiz.advancing
                          )
                        : !quiz.viewingPast &&
                            quiz.mode === 'learn' &&
                            quiz.submitted &&
                            !fillFeedbackReady
                          ? actionBtn('Grading…', () => {}, true)
                          : !quiz.viewingPast && quiz.mode === 'exam' && !quiz.crafting
                            ? actionBtn(
                                quiz.busy
                                  ? 'Saving…'
                                  : quiz.position >= quiz.total
                                    ? 'Finish'
                                    : 'Next',
                                quiz.submitAndContinue,
                                checkDisabled
                              )
                            : null}
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </View>

        <Modal visible={jumpOpen} transparent animationType="fade" onRequestClose={() => setJumpOpen(false)}>
          <Pressable style={styles.jumpBackdrop} onPress={() => setJumpOpen(false)} />
          <View
            style={[
              styles.jumpSheet,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
              },
            ]}
          >
            <Text style={{ color: playInk, fontFamily: Fonts.ui.semiBold, fontSize: 15, marginBottom: 8 }}>
              Jump to question
            </Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {questionChoices.map((item) => {
                const disabled = !item.ready && item.index !== quiz.displayPosition;
                return (
                  <TouchableOpacity
                    key={item.index}
                    disabled={disabled}
                    onPress={() => {
                      quiz.jumpToQuestion(item.index);
                      setJumpOpen(false);
                    }}
                    style={[
                      styles.jumpItem,
                      {
                        opacity: disabled ? 0.4 : 1,
                        backgroundColor:
                          item.index === quiz.displayPosition
                            ? isDark
                              ? 'rgba(122,158,134,0.12)'
                              : 'rgba(26,47,35,0.06)'
                            : 'transparent',
                      },
                    ]}
                  >
                    <Text style={{ color: playInk, fontFamily: Fonts.ui.medium, fontSize: 14 }}>
                      Question {item.index}
                    </Text>
                    {item.correct ? (
                      <Check size={14} strokeWidth={ICON_STROKE} color={EMERALD_500} />
                    ) : item.incorrect ? (
                      <X size={14} strokeWidth={ICON_STROKE} color={RED_500} />
                    ) : !item.ready ? (
                      <Text style={{ color: playMuted, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                        Soon
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Modal>
      </View>
    );
  };

  const renderReview = () => {
    const isDark = themeMode === 'dark';
    const cardBg = isDark ? '#111113' : '#FFFFFF';
    const cardBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(26,47,35,0.15)';
    const playNav = isDark ? '#D4D4D8' : ZINC_600;
    return (
      <ScrollView contentContainerStyle={styles.playPad} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={quiz.resetToCollection} style={styles.backRow}>
          <ArrowLeft size={16} strokeWidth={ICON_STROKE} color={playNav} />
          <Text style={[styles.playNavLabel, { color: playNav }]}>Test yourself</Text>
        </TouchableOpacity>
        <View
          style={[
            styles.playCard,
            { backgroundColor: cardBg, borderColor: cardBorder, marginTop: 16, flexGrow: 0 },
            isDark ? null : PLAY_CARD_SHADOW,
          ]}
        >
          <Text style={[styles.reviewTitle, { color: isDark ? '#F4F4F5' : ZINC_900 }]}>
            {quiz.timedOut ? "Time's up" : 'Quiz complete'}
          </Text>
          {quiz.score && quiz.scoreSummary ? (
            <Text style={[styles.sub, { color: ZINC_500, marginBottom: 0, marginTop: 4 }]}>
              Score: {quiz.score.correct} / {quiz.scoreSummary.denom} ({quiz.scoreSummary.pct}%)
              {quiz.scoreSummary.unanswered > 0 ? ` · ${quiz.scoreSummary.unanswered} unanswered` : ''}
            </Text>
          ) : null}
          {quiz.quotaExhausted ? <QuizProGate compact /> : null}
          {quiz.history.length === 0 ? (
            <Text style={{ color: ZINC_500, marginTop: 12, fontSize: 14 }}>
              No questions were answered in this session.
            </Text>
          ) : null}
          <View style={{ marginTop: 16, gap: 12 }}>
            {quiz.history.map((h, i) => {
              const label = resultLabel(h.is_correct);
              const starredItem = quiz.findStarredForQuestion(h.question);
              return (
                <View
                  key={h.id}
                  style={[
                    styles.reviewCard,
                    { borderColor: isDark ? 'rgba(255,255,255,0.08)' : ZINC_200, backgroundColor: isDark ? '#09090B' : '#FFFFFF' },
                  ]}
                >
                  <View style={styles.reviewHeader}>
                    <Text style={{ color: label.color, fontFamily: Fonts.ui.medium, fontSize: 12 }}>
                      Q{i + 1} · {label.text}
                    </Text>
                    <TouchableOpacity onPress={() => quiz.toggleStarCurrent(h.question, h.topic_id ?? null)}>
                      <Star
                        size={16}
                        strokeWidth={ICON_STROKE}
                        color={starredItem ? '#F59E0B' : '#A1A1AA'}
                        fill={starredItem ? '#F59E0B' : 'none'}
                      />
                    </TouchableOpacity>
                  </View>
                  <MathOrText
                    text={h.question.question}
                    color={isDark ? '#F4F4F5' : ZINC_900}
                    backgroundColor={cardBg}
                    fontSize={15}
                    variant="bodyLarge"
                    textStyle={{ color: isDark ? '#F4F4F5' : ZINC_900 }}
                  />
                  <Text style={{ color: ZINC_500, marginTop: 8, fontSize: 14 }}>
                    Your answer: {unwrapQuizChoice(h.user_answer) || '-'}
                  </Text>
                  <Text style={{ color: ZINC_500, fontSize: 14 }}>
                    Correct: {unwrapQuizChoice(h.question.correct_answer) || '-'}
                  </Text>
                  {!!h.question.explanation && (
                    <Text style={{ color: isDark ? '#D4D4D8' : ZINC_600, marginTop: 8, fontSize: 14 }}>
                      {h.question.explanation}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.reviewActions}>
            {quiz.quotaExhausted ? (
              <QuizProGate compact />
            ) : (
              <>
                <TouchableOpacity
                  onPress={() => quiz.resetToCollection()}
                  style={[styles.playAction, { backgroundColor: isDark ? '#3F6B4F' : STUDY_INK }]}
                >
                  <Text style={styles.playActionText}>Keep practicing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSettingsOpen(true)}
                  style={styles.reviewSecondary}
                >
                  <Text style={{ color: isDark ? '#D4D4D8' : STUDY_INK, fontFamily: Fonts.ui.medium, fontSize: 14 }}>
                    Quiz settings
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderStarred = () => {
    const isDark = themeMode === 'dark';
    const playNav = isDark ? '#D4D4D8' : ZINC_600;
    const cardBg = isDark ? '#111113' : '#FFFFFF';
    const brandTint = isDark ? '#9BB8A6' : STUDY_INK;
    return (
      <ScrollView contentContainerStyle={styles.playPad} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => quiz.setPhase('setup')} style={styles.backRow}>
          <ArrowLeft size={16} strokeWidth={ICON_STROKE} color={playNav} />
          <Text style={[styles.playNavLabel, { color: playNav }]}>Test yourself</Text>
        </TouchableOpacity>
        <View
          style={[
            styles.playCard,
            {
              backgroundColor: cardBg,
              borderColor: isDark ? 'rgba(245,158,11,0.25)' : 'rgba(253,230,138,0.7)',
              marginTop: 16,
              flexGrow: 0,
            },
            isDark ? null : PLAY_CARD_SHADOW,
          ]}
        >
          <View style={styles.starredHead}>
            <Star size={20} strokeWidth={ICON_STROKE} color="#F59E0B" fill="#F59E0B" />
            <Text style={[styles.reviewTitle, { color: isDark ? '#F4F4F5' : ZINC_900 }]}>Starred questions</Text>
          </View>
          <Text style={{ color: ZINC_500, fontSize: 14, marginBottom: 16 }}>
            {quiz.starred.length === 0
              ? 'Nothing starred yet, star items while taking a quiz.'
              : `${quiz.starred.length} question${quiz.starred.length === 1 ? '' : 's'} in this set`}
          </Text>
          {quiz.starred.length === 0 ? (
            <View
              style={{
                marginTop: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : ZINC_200,
                paddingHorizontal: 16,
                paddingVertical: 40,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: ZINC_500, fontSize: 14, marginBottom: 16 }}>No starred questions yet</Text>
              <StudyPillButton
                label="Create a set"
                icon={Plus}
                onPress={() => {
                  quiz.setPhase('setup');
                  setCreateOpen(true);
                }}
              />
            </View>
          ) : (
            quiz.starred.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.reviewCard,
                  { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(228,228,231,0.9)' },
                ]}
              >
                <View style={styles.reviewHeader}>
                  <View style={{ flex: 1 }}>
                    {item.question?.topic ? (
                      <Text style={[styles.topic, { color: brandTint, marginBottom: 8 }]}>{item.question.topic}</Text>
                    ) : null}
                    <MathOrText
                      text={item.question.question}
                      color={isDark ? '#F4F4F5' : ZINC_900}
                      backgroundColor={cardBg}
                      fontSize={14}
                      variant="bodyLarge"
                      textStyle={{
                        color: isDark ? '#F4F4F5' : ZINC_900,
                        fontFamily: Fonts.ui.medium,
                        fontSize: 14,
                      }}
                    />
                  </View>
                  <TouchableOpacity onPress={() => quiz.unstar(item.id)} hitSlop={8}>
                    <Star size={20} strokeWidth={ICON_STROKE} color="#F59E0B" fill="#F59E0B" />
                  </TouchableOpacity>
                </View>
                {item.question?.correct_answer ? (
                  <Text style={{ color: ZINC_500, marginTop: 8, fontSize: 12 }}>
                    Answer: {unwrapQuizChoice(item.question.correct_answer)}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    );
  };

  const rootStyle = [styles.flex, { backgroundColor: paper }];
  const body = (
    <>
      {onClose && (quiz.phase === 'setup' || quiz.phase === 'playing') && (
        <TouchableOpacity onPress={onClose} style={styles.closeAbs} hitSlop={12}>
          <MaterialCommunityIcons name="close" size={22} color={c.onSurface} />
        </TouchableOpacity>
      )}
      {quiz.phase === 'setup' && renderSetup()}
      {quiz.phase === 'playing' && renderPlaying()}
      {quiz.phase === 'review' && renderReview()}
      {quiz.phase === 'starred' && renderStarred()}

      <QuizCreateDialog
        visible={createOpen && !quiz.generating}
        busy={quiz.busy || quiz.generating}
        generationProgress={quiz.generationProgress}
        config={quiz.draftConfig}
        setConfig={quiz.setDraftConfig}
        selectedChapters={selectedChapters}
        setSelectedChapters={setSelectedChapters}
        chapters={chapters}
        error={quiz.error}
        hasNotes={hasNotes}
        inProgress={Boolean(quiz.inProgressSet)}
        onClose={() => setCreateOpen(false)}
        onStart={() => void runStart()}
        maxQuestionCount={quiz.maxQuestionCount}
      />

      <QuizLiveSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        config={quiz.draftConfig}
        setConfig={quiz.setDraftConfig}
        selectedChapters={selectedChapters}
        setSelectedChapters={setSelectedChapters}
        chapters={chapters}
        history={quiz.history}
        busy={quiz.busy}
        onApply={async () => {
          const ok = await quiz.applyLiveSettings();
          if (ok) setSettingsOpen(false);
        }}
        onReset={async () => {
          await quiz.resetLiveQuiz();
          setSettingsOpen(false);
        }}
      />

      <ConfirmModal
        visible={confirmNewOpen}
        title="Quiz in progress"
        message="You have a quiz in progress. Starting a new one will save the current one as incomplete. Continue?"
        confirmText="Start new"
        cancelText="Cancel"
        onCancel={() => {
          setConfirmNewOpen(false);
          pendingStartRef.current = null;
        }}
        onConfirm={() => {
          const opts = pendingStartRef.current;
          pendingStartRef.current = null;
          setConfirmNewOpen(false);
          void runStart(opts || {});
        }}
      />
    </>
  );

  if (embedded) {
    return <View style={rootStyle}>{body}</View>;
  }

  return (
    <SafeAreaView style={rootStyle} edges={['top']}>
      {body}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  setupPad: { padding: 20, paddingBottom: 48 },
  title: { fontFamily: Fonts.ui.semiBold, marginBottom: 8 },
  sub: { fontFamily: Fonts.ui.regular, marginBottom: 20, lineHeight: 20 },
  primaryBtn: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontFamily: Fonts.ui.semiBold, fontSize: 16 },
  setCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  setTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  setTitle: { fontFamily: Fonts.ui.semiBold, fontSize: 14, color: STUDY_INK },
  setMeta: { fontFamily: Fonts.ui.regular, fontSize: 13, color: STUDY_ZINC_500, marginTop: 4 },
  setWhen: { fontFamily: Fonts.ui.regular, fontSize: 12, color: '#A1A1AA', marginTop: 4 },
  setAction: {
    marginTop: 2,
    fontFamily: Fonts.ui.medium,
    fontSize: 12,
    color: STUDY_GROWTH,
  },
  setBadge: {
    borderRadius: 999,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  setBadgeText: { fontFamily: Fonts.ui.medium, fontSize: 11, color: '#B45309' },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: STUDY_BORDER,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyKicker: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: STUDY_GROWTH,
    marginTop: 8,
  },
  emptyTitle: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: STUDY_INK,
    marginTop: 4,
  },
  emptyCopy: {
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    lineHeight: 20,
    color: STUDY_ZINC_500,
    textAlign: 'center',
    marginTop: 6,
    maxWidth: 320,
  },
  emptyCta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  emptyHint: {
    fontFamily: Fonts.ui.regular,
    fontSize: 12,
    color: STUDY_ZINC_500,
    textAlign: 'center',
    marginTop: 12,
  },
  errorText: {
    fontFamily: Fonts.ui.regular,
    fontSize: 13,
    color: '#B91C1C',
    marginBottom: 12,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  playShell: { flex: 1, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  playPad: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  topDivider: { width: 1, height: 16, flexShrink: 0 },
  playProgressLabel: { flex: 1, minWidth: 0, fontFamily: Fonts.ui.regular, fontSize: 14 },
  playNavLabel: { fontFamily: Fonts.ui.medium, fontSize: 14 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 'auto' },
  settingsChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
  },
  progressFill: { height: '100%', borderRadius: 999 },
  jumpTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  jumpAccent: { width: 2, height: 14, borderRadius: 99 },
  jumpBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  jumpSheet: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '22%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    maxHeight: '56%',
  },
  jumpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  timeoutBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  timeoutRetry: {
    backgroundColor: STUDY_INK,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  craftingWrap: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 4,
  },
  craftingIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  craftingTitle: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 16,
    textAlign: 'center',
  },
  craftingBars: { width: '100%', maxWidth: 360, gap: 10, marginTop: 20 },
  craftingBar: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
  },
  topicPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  playScroll: { flexGrow: 1, paddingBottom: 8 },
  playCard: {
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  topic: {
    fontFamily: Fonts.ui.medium,
    marginBottom: 8,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  questionText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 18,
    lineHeight: 25,
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  optionBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  hintRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
  },
  hintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 40,
  },
  hintPanel: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fillInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
  },
  feedback: { marginTop: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  feedbackTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playFooter: {
    marginTop: 'auto',
    paddingTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  playAction: {
    minHeight: 40,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playActionText: {
    color: '#FAFAFA',
    fontFamily: Fonts.ui.medium,
    fontSize: 14,
  },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8 },
  reviewTitle: { fontFamily: Fonts.ui.semiBold, fontSize: 20, letterSpacing: -0.3 },
  reviewActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 24 },
  reviewSecondary: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(26,47,35,0.12)',
  },
  reviewCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 10,
  },
  starredHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  closeAbs: { position: 'absolute', right: 16, top: 12, zIndex: 2 },
});

export default AssessmentsTab;
