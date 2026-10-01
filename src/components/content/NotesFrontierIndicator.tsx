import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { notesStageLabel, formatNotesEta, type JobProgress } from '@/utils/notesProgress';

import { Fonts } from '@/config/fonts';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const FRAME_MS = 90;
const ACCENT = '#1A2F23';

type Props = {
  job: JobProgress;
  isDark: boolean;
};

const StudyNotesFrontier: React.FC<Props> = ({ job, isDark }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), FRAME_MS);
    return () => clearInterval(id);
  }, []);

  const verb = notesStageLabel(job.stage) ?? 'Preparing your notes';
  const eta = formatNotesEta(job.etaSeconds, job.completed, job.total);
  const muted = isDark ? '#9CA3AF' : '#6B7280';
  const faint = isDark ? '#6B7280' : '#9CA3AF';

  return (
    <View style={styles.row}>
      <Text style={styles.spinner}>{FRAMES[frame]}</Text>
      <Text style={[styles.verb, { color: muted }]}>{verb}</Text>
      {eta ? (
        <>
          <Text style={[styles.sep, { color: faint }]}>·</Text>
          <Text style={[styles.eta, { color: faint }]}>{eta}</Text>
        </>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 8,
  },
  spinner: {
    fontFamily: Fonts.ui.regular,
    fontSize: 16,
    color: ACCENT,
    width: 18,
    textAlign: 'center',
  },
  verb: {
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
  },
  sep: {
    fontSize: 14,
  },
  eta: {
    fontFamily: Fonts.ui.regular,
    fontSize: 13,
  },
});

export default StudyNotesFrontier;
