import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text } from 'react-native-paper';
import { Fonts } from '@/config/fonts';
import { BRAND_COLORS } from '@/config/brand';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { boxShadow, hideWebFocusRing, pointerEventsStyle } from '@/theme/webCompat';
import KatexWebView from '@/components/ui/KatexWebView';
import { hasMath } from '@/utils/mathContent';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import { testPrepService } from '@/services/testPrepService';
import { playQuizAnswerSelected } from '@/study-hub/quizAnswerFeedback';
import { formatCountdown } from '@/screens/exam-prep/testPrepFormatters';
import type { ExamEvalSession } from '@/api/schemas/testPrep';

type Theme = typeof lightTheme;

const MathOrText: React.FC<{
  text: string;
  color: string;
  backgroundColor: string;
  fontSize: number;
  style?: object;
}> = ({ text, color, backgroundColor, fontSize, style }) => {
  if (!hasMath(text)) {
    return (
      <Text style={[{ color, fontSize, fontFamily: Fonts.ui.medium, lineHeight: fontSize * 1.45 }, style]}>
        {text}
      </Text>
    );
  }
  return (
    <View style={[{ width: '100%' }, pointerEventsStyle('none')]}>
      <KatexWebView content={text} fontSize={fontSize} textColor={color} backgroundColor={backgroundColor} />
    </View>
  );
};

type Props = {
  session: ExamEvalSession;
  userId: number | null;
  onDone?: () => void;
  onExit: () => void;
};

const EvalPlayer: React.FC<Props> = ({ session, userId, onDone, onExit }) => {
  const themeMode = useAppTheme();
  const isDark = themeMode === 'dark';
  const theme: Theme = isDark ? darkTheme : lightTheme;
  const questions = session?.questions || [];
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ExamEvalSession | null>(
    session?.status === 'completed' ? session : null
  );
  const [now, setNow] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);
  const deadlineAt = session?.deadline_at ? Date.parse(session.deadline_at) : null;
  const submittingRef = useRef(false);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  useEffect(() => {
    if (!deadlineAt || result) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [deadlineAt, result]);

  const remainingSeconds =
    deadlineAt == null ? null : Math.max(0, Math.floor((deadlineAt - now) / 1000));

  const q = questions[index];
  const isLast = index >= questions.length - 1;
  const cardBg = isDark ? 'rgba(24,24,27,0.8)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)';

  const setAnswer = (value: string) => {
    if (remainingSeconds === 0) return;
    setAnswers((prev) => ({ ...prev, [index]: value }));
  };

  const handleSubmit = useCallback(
    async ({ fromTimeout = false }: { fromTimeout?: boolean } = {}) => {
      if (!userId || submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      if (fromTimeout) setTimedOut(true);
      try {
        const payload = questions.map((_, i) => ({
          index: i,
          answer: answersRef.current[i] || '',
        }));
        const data = await testPrepService.submitEvaluate(session.id, userId, payload);
        if (!data.success || !data.data) {
          Alert.alert('Submit failed', data.message || 'Try again');
          if (fromTimeout) setTimedOut(false);
          return;
        }
        setResult(data.data);
        analytics.track(EVENTS.EXAM_PRACTICE_COMPLETED, {
          session_id: session.id,
          score: data.data.score ?? null,
          question_count: questions.length,
          timed_out: fromTimeout,
        });
        onDone?.();
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [questions, session.id, userId, onDone]
  );

  useEffect(() => {
    if (result || remainingSeconds == null || remainingSeconds > 0) return;
    void handleSubmit({ fromTimeout: true });
  }, [remainingSeconds, result, handleSubmit]);

  if (result) {
    const graded = result.answers || [];
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor: cardBorder,
            ...boxShadow('0 1px 2px rgba(26,47,35,0.06)', {
              shadowColor: '#1A2F23',
              shadowOpacity: 0.06,
              shadowRadius: 4,
              shadowOffset: { width: 0, height: 1 },
              elevation: 1,
            }),
          },
        ]}
      >
        <Text style={[styles.resultTitle, { color: theme.colors.onSurface }]}>
          {timedOut ? "Time's up" : `Score: ${result.score ?? 0}%`}
        </Text>
        <Text style={[styles.resultSub, { color: theme.colors.onSurfaceVariant }]}>
          {timedOut ? `Score: ${result.score ?? 0}% · ` : ''}
          {graded.filter((a) => a.is_correct).length} of {questions.length} correct
        </Text>
        {questions.map((question, i) => {
          const grade = graded.find((a) => a.index === i) || {};
          const ok = Boolean(grade.is_correct);
          return (
            <View
              key={i}
              style={[
                styles.resultItem,
                {
                  borderColor: ok
                    ? isDark
                      ? '#064E3B'
                      : '#A7F3D0'
                    : isDark
                      ? '#7F1D1D'
                      : '#FECACA',
                  backgroundColor: ok
                    ? isDark
                      ? 'rgba(6,78,59,0.2)'
                      : 'rgba(236,253,245,0.5)'
                    : isDark
                      ? 'rgba(127,29,29,0.2)'
                      : 'rgba(254,242,242,0.5)',
                },
              ]}
            >
              <MathOrText
                text={`Q${i + 1}. ${question.question || ''}`}
                color={theme.colors.onSurface}
                backgroundColor="transparent"
                fontSize={14}
              />
              <Text style={[styles.resultMeta, { color: theme.colors.onSurfaceVariant }]}>
                Your answer: {grade.answer || '-'}
              </Text>
              <Text style={[styles.resultMeta, { color: theme.colors.onSurfaceVariant }]}>
                Correct: {grade.correct_answer || question.correct_answer || '-'}
              </Text>
              {grade.explanation || question.explanation ? (
                <View style={{ marginTop: 8 }}>
                  <MathOrText
                    text={grade.explanation || question.explanation || ''}
                    color={theme.colors.onSurfaceVariant}
                    backgroundColor="transparent"
                    fontSize={12}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: theme.colors.primary }]}
          onPress={onExit}
          activeOpacity={0.85}
        >
          <Text style={[styles.primaryBtnText, { color: theme.colors.onPrimary }]}>Back to practice</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!q) return null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBg,
          borderColor: cardBorder,
          ...boxShadow('0 1px 2px rgba(26,47,35,0.06)', {
            shadowColor: '#1A2F23',
            shadowOpacity: 0.06,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
          }),
        },
      ]}
    >
      <View style={styles.playerTop}>
        <Text style={[styles.meta, { color: theme.colors.onSurfaceVariant }]}>
          Question {index + 1} of {questions.length}
          {session?.timed ? ' · Timed' : ''}
        </Text>
        <View style={styles.playerTopRight}>
          {remainingSeconds != null ? (
            <Text
              style={[
                styles.timer,
                { color: remainingSeconds <= 30 ? theme.colors.error : theme.colors.secondary },
              ]}
            >
              {formatCountdown(remainingSeconds)}
            </Text>
          ) : null}
          <TouchableOpacity onPress={onExit} hitSlop={8}>
            <Text style={[styles.exit, { color: theme.colors.onSurfaceVariant }]}>Exit</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: isDark ? '#3F3F46' : '#FFFFFF' }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: BRAND_COLORS.ink,
              width: `${Math.min(100, ((index + 1) / Math.max(1, questions.length)) * 100)}%`,
            },
          ]}
        />
      </View>
      <MathOrText
        text={q.question || ''}
        color={theme.colors.onSurface}
        backgroundColor="transparent"
        fontSize={16}
      />
      {q.question_type === 'multiple_choice' && Array.isArray(q.options) ? (
        <View style={{ marginTop: 16, gap: 8 }}>
          {q.options.map((opt) => {
            const selected = answers[index] === opt;
            return (
              <TouchableOpacity
                key={opt}
                disabled={remainingSeconds === 0 || submitting}
                onPress={() => {
                  if (answers[index] !== opt) playQuizAnswerSelected();
                  setAnswer(opt);
                }}
                activeOpacity={0.85}
                style={[
                  styles.option,
                  {
                    borderColor: selected
                      ? theme.colors.primary
                      : isDark
                        ? 'rgba(255,255,255,0.1)'
                        : '#E4E4E7',
                    backgroundColor: selected
                      ? isDark
                        ? 'rgba(122,158,134,0.2)'
                        : 'rgba(26,47,35,0.08)'
                      : 'transparent',
                    opacity: remainingSeconds === 0 || submitting ? 0.6 : 1,
                  },
                ]}
              >
                <MathOrText
                  text={opt}
                  color={theme.colors.onSurface}
                  backgroundColor="transparent"
                  fontSize={14}
                />
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <TextInput
          value={answers[index] || ''}
          onChangeText={setAnswer}
          editable={remainingSeconds !== 0 && !submitting}
          placeholder="Type your answer"
          placeholderTextColor={theme.colors.onSurfaceVariant}
          style={[
            styles.input,
            hideWebFocusRing,
            {
              color: theme.colors.onSurface,
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E4E4E7',
              backgroundColor: isDark ? '#09090B' : '#FFFFFF',
              opacity: remainingSeconds === 0 || submitting ? 0.6 : 1,
            },
          ]}
        />
      )}
      <View style={styles.navRow}>
        <TouchableOpacity
          style={[
            styles.prevBtn,
            {
              borderColor: theme.colors.outline,
              opacity: index === 0 || submitting ? 0.4 : 1,
            },
          ]}
          disabled={index === 0 || submitting}
          onPress={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <Text style={{ color: theme.colors.onSurface, fontFamily: Fonts.ui.semiBold }}>Previous</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: theme.colors.primary }]}
          disabled={submitting || remainingSeconds === 0}
          onPress={() => {
            if (isLast) void handleSubmit();
            else setIndex((i) => i + 1);
          }}
        >
          {submitting ? (
            <ActivityIndicator color={theme.colors.onPrimary} />
          ) : (
            <Text style={{ color: theme.colors.onPrimary, fontFamily: Fonts.ui.bold }}>
              {isLast ? 'Submit' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  resultTitle: { fontFamily: Fonts.ui.semiBold, fontSize: 18 },
  resultSub: { marginTop: 4, fontFamily: Fonts.ui.regular, fontSize: 14 },
  resultItem: { borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 16 },
  resultMeta: { marginTop: 8, fontFamily: Fonts.ui.regular, fontSize: 12 },
  primaryBtn: {
    marginTop: 20,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: { fontFamily: Fonts.ui.bold, fontSize: 15 },
  playerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  playerTopRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meta: { fontFamily: Fonts.ui.regular, fontSize: 12 },
  timer: { fontFamily: Fonts.ui.bold, fontSize: 13, fontVariant: ['tabular-nums'] },
  exit: { fontFamily: Fonts.ui.regular, fontSize: 12 },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    marginVertical: 16,
  },
  progressFill: { height: '100%' },
  option: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 },
  input: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
  },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 20 },
  prevBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  nextBtn: {
    flex: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
});

export default EvalPlayer;
