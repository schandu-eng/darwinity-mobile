import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  BackHandler,
  ScrollView,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND_COLORS } from '@/config/brand';
import { Fonts } from '@/config/fonts';
import CardDeckFlipCard from '@/components/study-hub/card-decks/CardDeckFlipCard';
import { gradeQuizAnswerLocally } from '@/study-hub/quizGrade';
import {
  STUDY_ALARM_GOAL,
  alarmProgressLabel,
  isAlarmComplete,
  type CachedCardItem,
  type CachedQuizItem,
  type StudyAlarmCache,
} from '@/features/studyAlarm/logic';
import { loadStudyAlarmCache, loadStudyAlarmPrefs } from '@/features/studyAlarm/storage';
import { stopNativeRinging } from '@/features/studyAlarm/native';
import { syncStudyAlarmSchedule } from '@/features/studyAlarm/sync';

const RATINGS = [
  { value: 1, label: 'Again' },
  { value: 2, label: 'Hard' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Easy' },
];

const StudyAlarmRingScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [cache, setCache] = useState<StudyAlarmCache | null>(null);
  const [done, setDone] = useState(0);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState('');
  const [fill, setFill] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    void (async () => {
      const [prefs, nextCache] = await Promise.all([loadStudyAlarmPrefs(), loadStudyAlarmCache()]);
      if (nextCache && (!prefs.contentId || nextCache.contentId === prefs.contentId)) {
        setCache(nextCache);
      } else {
        setCache(nextCache);
      }
    })();
  }, []);

  const finish = useCallback(async () => {
    if (stopping) return;
    setStopping(true);
    try {
      await stopNativeRinging();
      await syncStudyAlarmSchedule();
    } finally {
      if (navigation.canGoBack()) navigation.goBack();
    }
  }, [navigation, stopping]);

  const completeOne = useCallback(() => {
    setDone((prev) => {
      const next = prev + 1;
      if (isAlarmComplete(next)) {
        setTimeout(() => void finish(), 0);
      } else {
        setIndex((i) => i + 1);
        setSelected('');
        setFill('');
        setFeedback(null);
        setFlipped(false);
      }
      return next;
    });
  }, [finish]);

  const quizItems = cache?.quizzes ?? [];
  const cardItems = cache?.cards ?? [];
  const quiz: CachedQuizItem | undefined = quizItems[index % Math.max(quizItems.length, 1)];
  const card: CachedCardItem | undefined = cardItems[index % Math.max(cardItems.length, 1)];
  const mode = cache?.mode ?? 'quiz';

  const submitQuiz = () => {
    if (!quiz || feedback) return;
    const answer = quiz.question_type === 'fill_blank' ? fill : selected;
    if (!answer.trim()) return;
    const grade = gradeQuizAnswerLocally(quiz, answer);
    setFeedback(grade?.is_correct ? 'Correct' : `Answer: ${quiz.correct_answer}`);
  };

  if (
    !cache ||
    (mode === 'quiz' && quizItems.length === 0) ||
    (mode === 'cards' && cardItems.length === 0)
  ) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.kicker}>Study alarm</Text>
        <Text style={styles.title}>Items aren’t cached yet</Text>
        <Text style={styles.body}>
          Keep Darwinity open on Wi-Fi once and save the alarm again. The sound stops after 10
          minutes; this screen stays until {STUDY_ALARM_GOAL} reviews are ready and completed.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.kicker}>Study alarm</Text>
      <Text style={styles.progress}>{alarmProgressLabel(done)}</Text>
      <ScrollView contentContainerStyle={styles.bodyWrap} keyboardShouldPersistTaps="handled">
        {mode === 'quiz' && quiz ? (
          <>
            <Text style={styles.title}>{quiz.question}</Text>
            {quiz.question_type === 'fill_blank' ? (
              <TextInput
                style={styles.input}
                value={fill}
                onChangeText={setFill}
                placeholder="Type your answer"
                placeholderTextColor="#8A938C"
                editable={!feedback}
              />
            ) : (
              (quiz.options.length ? quiz.options : ['True', 'False']).map((option) => {
                const on = selected === option;
                return (
                  <TouchableOpacity
                    key={option}
                    onPress={() => !feedback && setSelected(option)}
                    style={[styles.option, on && styles.optionOn]}
                    disabled={Boolean(feedback)}
                  >
                    <Text style={styles.optionText}>{option}</Text>
                  </TouchableOpacity>
                );
              })
            )}
            {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
            <TouchableOpacity style={styles.cta} onPress={feedback ? completeOne : submitQuiz}>
              <Text style={styles.ctaText}>{feedback ? 'Next' : 'Check'}</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {mode === 'cards' && card ? (
          <>
            <CardDeckFlipCard
              front={card.front}
              back={card.back}
              isFlipped={flipped}
              onFlip={() => setFlipped(true)}
            />
            {flipped ? (
              <View style={styles.ratings}>
                {RATINGS.map((rating) => (
                  <TouchableOpacity key={rating.value} style={styles.rateBtn} onPress={completeOne}>
                    <Text style={styles.rateText}>{rating.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.body}>Tap the card, then rate it. Any rating counts.</Text>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND_COLORS.ink, paddingHorizontal: 20 },
  kicker: { color: '#C5D4CB', fontFamily: Fonts.ui.medium, fontSize: 13, letterSpacing: 0.4 },
  progress: { color: '#FAF9F6', fontFamily: Fonts.ui.semiBold, fontSize: 18, marginTop: 4 },
  bodyWrap: { paddingTop: 16, paddingBottom: 32 },
  title: {
    color: '#FAF9F6',
    fontFamily: Fonts.ui.semiBold,
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 16,
  },
  body: {
    color: '#D6E0DA',
    fontFamily: Fonts.ui.regular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 16,
  },
  option: {
    borderWidth: 1,
    borderColor: 'rgba(250,249,246,0.25)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  optionOn: { backgroundColor: 'rgba(250,249,246,0.12)', borderColor: '#FAF9F6' },
  optionText: { color: '#FAF9F6', fontFamily: Fonts.ui.medium, fontSize: 16 },
  input: {
    backgroundColor: '#FAF9F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: Fonts.ui.regular,
    fontSize: 16,
    color: BRAND_COLORS.ink,
    marginBottom: 12,
  },
  feedback: { color: '#FAF9F6', fontFamily: Fonts.ui.medium, fontSize: 15, marginVertical: 12 },
  cta: {
    marginTop: 16,
    backgroundColor: '#FAF9F6',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: { color: BRAND_COLORS.ink, fontFamily: Fonts.ui.semiBold, fontSize: 16 },
  ratings: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  rateBtn: {
    backgroundColor: '#FAF9F6',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rateText: { color: BRAND_COLORS.ink, fontFamily: Fonts.ui.semiBold },
});

export default StudyAlarmRingScreen;
