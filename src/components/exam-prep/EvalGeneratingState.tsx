import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Sparkles } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { useAppTheme } from '@/store/appThemeStore';
import {
  STUDY_GROWTH,
  STUDY_INK,
  STUDY_ZINC_500,
} from '@/components/study-hub/studyPanelTokens';
import { StudyGenerationTrailMap, type TrailStage } from '@/components/study-hub/StudyGenerationTrailMap';
import { EVAL_BUILD_STAGES, EVAL_WAIT_TIPS } from '@/screens/exam-prep/testPrepConstants';

function stageIndexForProgress(progress: number, thresholds = [22, 48, 78]): number {
  const p = Math.min(100, Math.max(0, Number(progress) || 0));
  for (let i = 0; i < thresholds.length; i += 1) {
    if (p < thresholds[i]) return i;
  }
  return thresholds.length;
}

function stagesFromProgress(progress: number): TrailStage[] {
  const activeStage = stageIndexForProgress(progress);
  return EVAL_BUILD_STAGES.map((stage, i) => ({
    label: stage.label.split(' ')[0],
    status: i < activeStage ? 'done' : i === activeStage ? 'active' : 'pending',
  }));
}

type Props = {
  questionCount?: number;
  evalType?: string;
};

const EvalGeneratingState: React.FC<Props> = ({ questionCount = 10, evalType = 'mcq' }) => {
  const isDark = useAppTheme() === 'dark';
  const [progress, setProgress] = useState(4);
  const [tipIndex, setTipIndex] = useState(0);
  const [tipVisible, setTipVisible] = useState(true);
  const startedAtRef = useRef(Date.now());

  useEffect(() => {
    startedAtRef.current = Date.now();
    setProgress(4);
    const expectedMs = Math.min(75_000, 10_000 + (Number(questionCount) || 10) * 2_200);
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const next = Math.min(92, (1 - Math.exp(-elapsed / (expectedMs * 0.42))) * 100);
      setProgress(Math.max(4, next));
    }, 180);
    return () => clearInterval(tick);
  }, [questionCount]);

  useEffect(() => {
    if (EVAL_WAIT_TIPS.length <= 1) return undefined;
    let fadeTimeout: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      setTipVisible(false);
      fadeTimeout = setTimeout(() => {
        setTipIndex((i) => (i + 1) % EVAL_WAIT_TIPS.length);
        setTipVisible(true);
      }, 220);
    }, 4200);
    return () => {
      clearInterval(interval);
      if (fadeTimeout) clearTimeout(fadeTimeout);
    };
  }, []);

  const activeStage = stageIndexForProgress(progress);
  const trailStages = useMemo(() => stagesFromProgress(progress), [progress]);
  const countLabel = `${questionCount || 10} question${questionCount === 1 ? '' : 's'}`;
  const typeLabel = evalType === 'qa' ? 'Q&A' : 'MCQ';
  const ink = isDark ? '#F4F7F5' : STUDY_INK;
  const muted = isDark ? '#9AA89F' : STUDY_ZINC_500;
  const growth = isDark ? '#9BB8A6' : STUDY_GROWTH;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.eyebrow, { color: growth }]}>Preparing</Text>
      <Text style={[styles.title, { color: ink }]}>Generating your test</Text>
      <Text style={[styles.subtitle, { color: muted }]}>
        Building a {countLabel} · {typeLabel} set from your notes and past papers.
      </Text>
      <View style={styles.trail}>
        <StudyGenerationTrailMap stages={trailStages} progress={progress} />
      </View>
      <View style={styles.meta}>
        <View style={[styles.pct, { backgroundColor: isDark ? 'rgba(122,158,134,0.18)' : 'rgba(63,107,79,0.12)' }]}>
          <Sparkles size={12} strokeWidth={ICON_STROKE} color={isDark ? '#9BB8A6' : '#2F513C'} />
          <Text style={[styles.pctText, { color: isDark ? '#9BB8A6' : '#2F513C' }]}>
            {Math.round(progress)}% · {EVAL_BUILD_STAGES[activeStage]?.label}
          </Text>
        </View>
      </View>
      <Text style={[styles.hint, { color: muted, opacity: tipVisible ? 1 : 0 }]}>
        {EVAL_WAIT_TIPS[tipIndex]}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingVertical: 4 },
  eyebrow: {
    fontFamily: Fonts.ui.bold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 18,
    letterSpacing: -0.4,
    marginTop: 6,
  },
  subtitle: {
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  trail: { width: '100%', marginTop: 12 },
  meta: {
    marginTop: 8,
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
  },
  pct: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pctText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 12,
  },
  hint: {
    marginTop: 12,
    fontFamily: Fonts.ui.regular,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default EvalGeneratingState;
