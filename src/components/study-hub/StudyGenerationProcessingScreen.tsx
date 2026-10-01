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
  STUDY_PAPER,
  STUDY_PAPER_DARK,
  STUDY_ZINC_500,
} from './studyPanelTokens';
import { StudyGenerationTrailMap, type TrailStage } from './StudyGenerationTrailMap';
import {
  computeKindDisplayProgress,
  DISPLAY_PROGRESS_TICK_MS,
  easeDisplayProgress,
  easeStepForGap,
  initialDisplayProgress,
  stageIndexForProgress,
  stagesFromProgress as stagesFromProgressShared,
} from '@shared/generationProgress.js';

export type ServiceType = 'flashcards' | 'quiz' | 'podcast' | 'notes' | 'flowchart' | 'games';

interface StudyGenerationProcessingScreenProps {
  serviceType: ServiceType;
  message?: string;
  subtitle?: string;
  progress?: number;
  /** Drop the full-screen paper shell so this can sit inside a dialog. */
  embedded?: boolean;
}

const COPY: Record<ServiceType, { eyebrow: string; title: string; subtitle: string; stages: string[] }> = {
  notes: {
    eyebrow: 'Preparing',
    title: 'Starting your notes',
    subtitle: 'Reading your content and drafting a structured summary. This usually takes a minute or two.',
    stages: ['Reading', 'Drafting', 'Building', 'Almost'],
  },
  quiz: {
    eyebrow: 'Preparing',
    title: 'Preparing your quiz',
    subtitle: "Writing questions from your notes. You can switch away — we'll keep working.",
    stages: ['Reading', 'Writing', 'Checking', 'Almost'],
  },
  flashcards: {
    eyebrow: 'Building',
    title: 'Generating flashcards',
    subtitle: 'Assembling cards from your selected topics. You can leave this tab, we’ll keep working.',
    stages: ['Reading', 'Writing', 'Checking', 'Almost'],
  },
  flowchart: {
    eyebrow: 'Building',
    title: 'Building your mind map',
    subtitle: 'Mapping topics and branches from your notes. You can leave this tab, we’ll keep working.',
    stages: ['Reading', 'Mapping', 'Linking', 'Almost'],
  },
  podcast: {
    eyebrow: 'Building',
    title: 'Generating your podcast',
    subtitle: 'Writing and voicing a lesson from this note.',
    stages: ['Reading', 'Writing', 'Voicing', 'Almost'],
  },
  games: {
    eyebrow: 'Building',
    title: 'Writing game questions',
    subtitle: 'Same quality bar as quizzes and flashcards: short, testable items for play.',
    stages: ['Reading', 'Writing', 'Checking', 'Almost'],
  },
};

function stagesFromProgress(labels: string[], progress: number): TrailStage[] {
  return stagesFromProgressShared(labels, progress) as TrailStage[];
}

const StudyGenerationProcessingScreen: React.FC<StudyGenerationProcessingScreenProps> = ({
  serviceType,
  message,
  subtitle,
  progress,
  embedded = false,
}) => {
  const isDark = (useAppTheme() as 'light' | 'dark') === 'dark';
  const copy = COPY[serviceType];
  const liveProgress = Number(progress) || 0;
  const [displayProgress, setDisplayProgress] = useState(() =>
    initialDisplayProgress(
      liveProgress,
      serviceType === 'quiz' ? 'quiz' : serviceType === 'notes' ? 'strict' : 'job'
    )
  );
  const [indeterminate, setIndeterminate] = useState(false);
  const serverHeartbeatRef = useRef({
    progress: liveProgress,
    at: Date.now(),
  });

  useEffect(() => {
    if (liveProgress !== serverHeartbeatRef.current.progress) {
      serverHeartbeatRef.current = { progress: liveProgress, at: Date.now() };
    }
  }, [liveProgress]);

  useEffect(() => {
    if (liveProgress >= 100) {
      setDisplayProgress(100);
      setIndeterminate(false);
      return undefined;
    }

    const tick = setInterval(() => {
      const server = liveProgress > 0 ? liveProgress : 0;
      const elapsedSinceServerUpdate = Date.now() - serverHeartbeatRef.current.at;
      const kind =
        serviceType === 'quiz' ? 'quiz' : serviceType === 'notes' ? 'strict' : 'job';
      const next = computeKindDisplayProgress(kind, server, elapsedSinceServerUpdate);
      setDisplayProgress((prev) =>
        easeDisplayProgress(prev, next.progress, { maxStep: easeStepForGap(next.progress - prev) })
      );
      setIndeterminate(Boolean(next.indeterminate));
    }, DISPLAY_PROGRESS_TICK_MS);
    return () => clearInterval(tick);
  }, [liveProgress, serviceType]);

  const clamped = Math.min(100, Math.max(0, displayProgress));
  const activeStage = stageIndexForProgress(clamped);
  const trailStages = useMemo(
    () => stagesFromProgress(copy.stages, clamped),
    [copy.stages, clamped]
  );

  return (
    <View
      style={[
        styles.shell,
        embedded && styles.shellEmbedded,
        { backgroundColor: embedded ? 'transparent' : isDark ? STUDY_PAPER_DARK : STUDY_PAPER },
      ]}
    >
      <View
        style={[
          styles.card,
          embedded && styles.cardEmbedded,
          {
            backgroundColor: embedded ? 'transparent' : isDark ? '#15241C' : '#FFFFFF',
            borderColor: embedded
              ? 'transparent'
              : isDark
                ? 'rgba(255,255,255,0.1)'
                : 'rgba(26,47,35,0.08)',
          },
        ]}
      >
        <Text style={[styles.eyebrow, { color: isDark ? '#9BB8A6' : STUDY_GROWTH }]}>
          {copy.eyebrow}
        </Text>
        <Text
          style={[
            styles.title,
            embedded && styles.titleEmbedded,
            { color: isDark ? '#F4F7F5' : STUDY_INK },
          ]}
        >
          {message ?? copy.title}
        </Text>
        <Text
          style={[
            styles.subtitle,
            embedded && styles.subtitleEmbedded,
            { color: isDark ? '#9AA89F' : STUDY_ZINC_500 },
          ]}
        >
          {subtitle ?? copy.subtitle}
        </Text>

        <View style={styles.trail}>
          <StudyGenerationTrailMap
            stages={trailStages}
            progress={clamped}
            thresholds={serviceType === 'notes' ? [6, 28, 95] : undefined}
          />
        </View>

        <View style={styles.meta}>
          <View style={[styles.pct, { backgroundColor: isDark ? 'rgba(122,158,134,0.18)' : 'rgba(63,107,79,0.12)' }]}>
            <Sparkles size={12} strokeWidth={ICON_STROKE} color={isDark ? '#9BB8A6' : '#2F513C'} />
            <Text style={[styles.pctText, { color: isDark ? '#9BB8A6' : '#2F513C' }]}>
              {`${Math.round(clamped)}% · ${copy.stages[activeStage]}`}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  shellEmbedded: {
    flex: 0,
    padding: 0,
    alignItems: 'stretch',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
  },
  cardEmbedded: {
    maxWidth: '100%',
    borderWidth: 0,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: 'flex-start',
  },
  titleEmbedded: {
    textAlign: 'left',
    fontSize: 18,
  },
  subtitleEmbedded: {
    textAlign: 'left',
  },
  eyebrow: {
    fontFamily: Fonts.ui.bold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 22,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginTop: 6,
  },
  subtitle: {
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 360,
  },
  trail: {
    width: '100%',
    alignSelf: 'stretch',
    marginTop: 12,
  },
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
});

export default StudyGenerationProcessingScreen;
