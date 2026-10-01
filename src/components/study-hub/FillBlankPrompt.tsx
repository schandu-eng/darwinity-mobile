import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Animated, StyleProp, TextStyle } from 'react-native';
import { Text } from 'react-native-paper';
import {
  fillBlankMatches,
  joinBlankAnswers,
  normalizeQuizAnswer,
  parseFillBlankParts,
  splitBlankAnswers,
  splitCorrectAnswers,
} from '@shared/quiz/index.js';
import KatexWebView from '@/components/ui/KatexWebView';
import { hasMath } from '@/utils/mathContent';
import { Fonts } from '@/config/fonts';
import { pointerEventsStyle, USE_NATIVE_DRIVER } from '@/theme/webCompat';

export const FILL_REVEAL = {
  EDITING: 'editing',
  GRADING: 'grading',
  STRIKE: 'strike',
  CORRECT: 'correct',
  DONE: 'done',
} as const;

export type FillRevealStage = (typeof FILL_REVEAL)[keyof typeof FILL_REVEAL];

type ParsedFillBlank = {
  parts: ({ type: 'text'; text: string } | { type: 'blank'; index: number })[];
  blankCount: number;
  implicitBlank?: boolean;
};

function blankIsCorrect(userValue: string, expected: string, overallCorrect: boolean) {
  if (overallCorrect) return true;
  if (!expected) return false;
  const a = normalizeQuizAnswer(userValue);
  const c = normalizeQuizAnswer(expected);
  return a === c || fillBlankMatches(a, c);
}

function MathBit({
  text,
  color,
  fontSize,
  fontFamily,
  style,
}: {
  text: string;
  color: string;
  fontSize: number;
  fontFamily?: string;
  style?: StyleProp<TextStyle>;
}) {
  if (!hasMath(text)) {
    return (
      <Text
        style={[
          {
            color,
            fontSize,
            fontFamily: fontFamily || Fonts.ui.semiBold,
            lineHeight: Math.round(fontSize * 1.55),
          },
          style,
        ]}
      >
        {text}
      </Text>
    );
  }
  return (
    <View style={[{ minWidth: 48, flexShrink: 1 }, pointerEventsStyle('none')]}>
      <KatexWebView
        content={text}
        fontSize={fontSize}
        textColor={color}
        backgroundColor="transparent"
      />
    </View>
  );
}

type Props = {
  questionText: string;
  answer: string;
  onAnswerChange: (next: string) => void;
  locked?: boolean;
  submitted?: boolean;
  grade?: { is_correct?: boolean; correct_answer?: string } | null;
  instantReveal?: boolean;
  ink?: string;
  muted?: string;
  isDark?: boolean;
  onRevealStageChange?: (stage: FillRevealStage) => void;
  onSubmitAll?: () => void;
};

export function useFillBlankMeta(questionText: string, answer: string) {
  return useMemo(() => {
    const parsed = parseFillBlankParts(questionText) as ParsedFillBlank;
    const filled = splitBlankAnswers(answer, parsed.blankCount).every((v) => v.trim().length > 0);
    return { blankCount: parsed.blankCount, allFilled: filled, implicitBlank: Boolean(parsed.implicitBlank) };
  }, [questionText, answer]);
}

export default function FillBlankPrompt({
  questionText,
  answer,
  onAnswerChange,
  locked = false,
  submitted = false,
  grade = null,
  instantReveal = false,
  ink = '#18181B',
  muted = '#71717A',
  isDark = false,
  onRevealStageChange,
  onSubmitAll,
}: Props) {
  const [stage, setStage] = useState<FillRevealStage>(FILL_REVEAL.EDITING);
  const strikeAnim = useRef(new Animated.Value(0)).current;
  const correctAnim = useRef(new Animated.Value(0)).current;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const parsed = useMemo(
    () => parseFillBlankParts(questionText) as ParsedFillBlank,
    [questionText]
  );
  const values = useMemo(
    () => splitBlankAnswers(answer, parsed.blankCount),
    [answer, parsed.blankCount]
  );
  const expected = useMemo(
    () => splitCorrectAnswers(grade?.correct_answer, parsed.blankCount),
    [grade?.correct_answer, parsed.blankCount]
  );
  const allFilled = useMemo(
    () => values.every((v) => v.trim().length > 0),
    [values]
  );

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const go = (next: FillRevealStage) => {
    setStage(next);
    onRevealStageChange?.(next);
  };

  useEffect(() => {
    clearTimers();
    strikeAnim.setValue(0);
    correctAnim.setValue(0);
    if (!submitted || !grade) {
      go(FILL_REVEAL.EDITING);
      return undefined;
    }
    if (instantReveal) {
      strikeAnim.setValue(1);
      correctAnim.setValue(1);
      go(FILL_REVEAL.DONE);
      return undefined;
    }

    go(FILL_REVEAL.GRADING);
    const isCorrect = grade.is_correct === true;
    timers.current.push(
      setTimeout(() => {
        go(isCorrect ? FILL_REVEAL.CORRECT : FILL_REVEAL.STRIKE);
        if (!isCorrect) {
          Animated.timing(strikeAnim, {
            toValue: 1,
            duration: 480,
            useNativeDriver: false,
          }).start(({ finished }) => {
            if (!finished) return;
            go(FILL_REVEAL.CORRECT);
            Animated.timing(correctAnim, {
              toValue: 1,
              duration: 320,
              useNativeDriver: USE_NATIVE_DRIVER,
            }).start(() => go(FILL_REVEAL.DONE));
          });
        } else {
          correctAnim.setValue(1);
          timers.current.push(setTimeout(() => go(FILL_REVEAL.DONE), 320));
        }
      }, 260)
    );

    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitted, grade?.is_correct, grade?.correct_answer, instantReveal, questionText]);

  const onBlankChange = (index: number, next: string) => {
    if (locked || submitted) return;
    const nextValues = values.slice();
    nextValues[index] = next;
    onAnswerChange(joinBlankAnswers(nextValues));
  };

  const handleSubmitEditing = () => {
    if (!onSubmitAll || locked || submitted) return;
    if (!allFilled) return;
    onSubmitAll();
  };

  const showGraded = submitted && !!grade && stage !== FILL_REVEAL.EDITING;
  const showStrike =
    showGraded &&
    (stage === FILL_REVEAL.STRIKE || stage === FILL_REVEAL.CORRECT || stage === FILL_REVEAL.DONE);
  const showCorrectText =
    showGraded && (stage === FILL_REVEAL.CORRECT || stage === FILL_REVEAL.DONE);

  return (
    <View style={[styles.wrap, parsed.implicitBlank ? styles.wrapImplicit : null]}>
      {parsed.parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <MathBit
              key={`t-${i}`}
              text={part.text}
              color={ink}
              fontSize={18}
              fontFamily={Fonts.ui.semiBold}
              style={parsed.implicitBlank ? styles.stemBlock : undefined}
            />
          );
        }

        const idx = part.index;
        const value = values[idx] || '';
        const expect = expected[idx] || '';
        const overallCorrect = grade?.is_correct === true;
        const thisCorrect = blankIsCorrect(value, expect, overallCorrect);
        const showThisStrike = showStrike && !thisCorrect && !!value.trim();
        const showThisGreen = showCorrectText && !thisCorrect && !!expect;

        if (!showGraded) {
          return (
            <TextInput
              key={`b-${idx}`}
              value={value}
              onChangeText={(t) => onBlankChange(idx, t)}
              onSubmitEditing={handleSubmitEditing}
              returnKeyType="done"
              blurOnSubmit={false}
              editable={!locked && !submitted}
              placeholder="…"
              placeholderTextColor={muted}
              style={[
                styles.input,
                {
                  color: ink,
                  borderColor: isDark ? 'rgba(255,255,255,0.14)' : '#D4D4D8',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                  minWidth: Math.max(56, Math.min(220, (value.length || 2) * 11 + 24)),
                },
              ]}
            />
          );
        }

        return (
          <View key={`b-${idx}`} style={styles.gradedSlot}>
            {value.trim() ? (
              <View>
                <Text
                  style={[
                    styles.userText,
                    {
                      color: thisCorrect
                        ? isDark
                          ? '#6EE7B7'
                          : '#047857'
                        : showThisStrike
                          ? isDark
                            ? '#FCA5A5'
                            : '#B91C1C'
                          : ink,
                    },
                  ]}
                >
                  {value}
                </Text>
                {showThisStrike ? (
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      styles.strike,
                      {
                        backgroundColor: isDark ? '#F87171' : '#DC2626',
                        width: strikeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '104%'],
                        }),
                      },
                    ]}
                  />
                ) : null}
              </View>
            ) : null}
            {showThisGreen ? (
              <Animated.View
                style={{
                  opacity: correctAnim,
                  transform: [
                    {
                      translateY: correctAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [6, 0],
                      }),
                    },
                  ],
                }}
              >
                <MathBit
                  text={expect}
                  color={isDark ? '#6EE7B7' : '#047857'}
                  fontSize={18}
                  fontFamily={Fonts.ui.bold}
                />
              </Animated.View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  wrapImplicit: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },
  stemBlock: {
    marginBottom: 2,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontFamily: Fonts.ui.semiBold,
    fontSize: 16,
    marginVertical: 2,
  },
  gradedSlot: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginVertical: 2,
  },
  userText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 18,
    lineHeight: 28,
  },
  strike: {
    position: 'absolute',
    left: 0,
    top: '52%',
    height: 2,
    borderRadius: 99,
    transform: [{ rotate: '-3.5deg' }],
  },
});
