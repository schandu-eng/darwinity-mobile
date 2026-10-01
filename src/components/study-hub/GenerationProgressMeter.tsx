import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { Sparkles } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { useAppTheme } from '@/store/appThemeStore';
import { STUDY_GROWTH } from './studyPanelTokens';

export type TrailStage = {
  label: string;
  status: 'done' | 'active' | 'pending';
};

type Props = {
  progress: number;
  stageLabel?: string | null;
  stages: TrailStage[];
  align?: 'center' | 'start';
};

/** Linear generation meter — same pattern as web `GenerationProgressMeter`. */
export const GenerationProgressMeter: React.FC<Props> = ({
  progress,
  stageLabel,
  stages,
  align = 'center',
}) => {
  const isDark = useAppTheme() === 'dark';
  const clamped = Math.min(100, Math.max(0, Number(progress) || 0));
  const growth = isDark ? '#9BB8A6' : STUDY_GROWTH;
  const track = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.08)';
  const mute = isDark ? '#8A9A90' : '#71717A';
  const pending = isDark ? 'rgba(255,255,255,0.12)' : '#E4E4E7';
  const start = align === 'start';

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.stageRow}>
          <Sparkles size={13} strokeWidth={ICON_STROKE} color={growth} />
          <Text style={[styles.stageLabel, { color: mute }]} numberOfLines={1}>
            {stageLabel || 'Working…'}
          </Text>
        </View>
        <Text style={[styles.pct, { color: growth }]}>{Math.round(clamped)}%</Text>
      </View>

      <View style={[styles.track, { backgroundColor: track }]}>
        <View
          style={[
            styles.fill,
            { width: `${Math.max(clamped, 4)}%`, backgroundColor: growth },
          ]}
        />
      </View>

      {stages.length > 0 ? (
        <View style={styles.ticks}>
          {stages.map((stage) => {
            const on = stage.status === 'done' || stage.status === 'active';
            const active = stage.status === 'active';
            return (
              <View key={stage.label} style={[styles.tick, start && styles.tickStart]}>
                <View
                  style={[
                    styles.tickBar,
                    { backgroundColor: on ? growth : pending },
                  ]}
                />
                <Text
                  style={[
                    styles.tickLabel,
                    {
                      color: active ? growth : mute,
                      opacity: on ? 1 : 0.55,
                      fontFamily: active ? Fonts.ui.semiBold : Fonts.ui.medium,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {stage.label}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  stageRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stageLabel: {
    flex: 1,
    fontFamily: Fonts.ui.medium,
    fontSize: 12,
  },
  pct: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  ticks: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 4,
  },
  tick: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
  },
  tickStart: {
    alignItems: 'flex-start',
  },
  tickBar: {
    height: 6,
    width: '100%',
    maxWidth: 44,
    borderRadius: 999,
  },
  tickLabel: {
    fontSize: 10,
    textAlign: 'center',
    width: '100%',
  },
});
