import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Fonts } from '@/config/fonts';
import { boxShadow } from '@/theme/webCompat';
import {
  examCountdownTone,
  formatExamCountdown,
  formatExamDateLabel,
  formatExamRemaining,
  getExamDateDiffDays,
  type ExamCountdownTone,
} from '@/screens/exam-prep/testPrepFormatters';

const FACE = 168;
const CENTER = FACE / 2;
const HOUR_TICKS = Array.from({ length: 12 }, (_, i) => i);
const MINUTE_TICKS = Array.from({ length: 60 }, (_, i) => i).filter((i) => i % 5 !== 0);

const TONE_COLORS: Record<
  ExamCountdownTone,
  { ring: string; second: string; accent: string; accentDark: string }
> = {
  urgent: { ring: '#B45309', second: '#DC2626', accent: '#B45309', accentDark: '#FBBF24' },
  soon: { ring: '#3F6B4F', second: '#C45C26', accent: '#3F6B4F', accentDark: '#9BB8A6' },
  ok: { ring: '#3F6B4F', second: '#5F7F6A', accent: '#1A2F23', accentDark: '#9BB8A6' },
  past: { ring: '#71717A', second: '#A1A1AA', accent: '#71717A', accentDark: '#A1A1AA' },
};

type Props = {
  examDate?: string | null;
  isDark?: boolean;
};

function polarOffset(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Math.sin(rad) * radius,
    y: -Math.cos(rad) * radius,
  };
}

export default function ExamDueClock({ examDate, isDark = false }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!examDate) return undefined;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [examDate]);

  const tone = useMemo(() => examCountdownTone(examDate, now), [examDate, now]);
  const countdown = useMemo(() => formatExamCountdown(examDate, now), [examDate, now]);
  const dateLabel = useMemo(() => formatExamDateLabel(examDate), [examDate]);
  const remaining = useMemo(() => formatExamRemaining(examDate, now), [examDate, now]);
  const diffDays = useMemo(() => getExamDateDiffDays(examDate, now), [examDate, now]);

  const handAngles = useMemo(() => {
    const hours = now.getHours() % 12;
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    return {
      hour: hours * 30 + minutes * 0.5,
      minute: minutes * 6 + seconds * 0.1,
      second: seconds * 6,
    };
  }, [now]);

  if (!examDate || tone == null || countdown == null || diffDays == null) return null;

  const colors = TONE_COLORS[tone];
  const accent = isDark ? colors.accentDark : colors.accent;
  const daysNumeral = Math.abs(diffDays);
  const daysCaption =
    diffDays === 0
      ? 'Exam today'
      : diffDays > 0
        ? daysNumeral === 1
          ? 'day left'
          : 'days left'
        : daysNumeral === 1
          ? 'day ago'
          : 'days ago';

  return (
    <View
      style={styles.wrap}
      accessibilityRole="timer"
      accessibilityLabel={
        remaining ? `${countdown}. ${remaining} remaining. Exam ${dateLabel}` : countdown
      }
    >
      <View
        style={[
          styles.face,
          {
            borderColor: colors.ring,
            backgroundColor: isDark ? '#181F1B' : '#E8EDE9',
            ...boxShadow('0 10px 28px rgba(26,47,35,0.14)', {
              shadowColor: '#1A2F23',
              shadowOpacity: isDark ? 0.4 : 0.14,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 4,
            }),
          },
        ]}
      >
        {HOUR_TICKS.map((i) => {
          const { x, y } = polarOffset(i * 30, CENTER - 14);
          return (
            <View
              key={`h-${i}`}
              style={[
                styles.tickHour,
                {
                  backgroundColor: colors.ring,
                  left: CENTER + x - 1.25,
                  top: CENTER + y - 5,
                  transform: [{ rotate: `${i * 30}deg` }],
                },
              ]}
            />
          );
        })}
        {MINUTE_TICKS.map((i) => {
          const { x, y } = polarOffset(i * 6, CENTER - 12);
          return (
            <View
              key={`m-${i}`}
              style={[
                styles.tick,
                {
                  backgroundColor: isDark ? 'rgba(155,184,166,0.35)' : 'rgba(63,107,79,0.35)',
                  left: CENTER + x - 1,
                  top: CENTER + y - 3.5,
                  transform: [{ rotate: `${i * 6}deg` }],
                },
              ]}
            />
          );
        })}

        {/* Hands: full-size rotating layers so origin stays at center */}
        <View
          pointerEvents="none"
          style={[styles.handLayer, { transform: [{ rotate: `${handAngles.hour}deg` }] }]}
        >
          <View
            style={[
              styles.handHour,
              { backgroundColor: isDark ? '#E8EDE9' : '#1A2F23' },
            ]}
          />
        </View>
        <View
          pointerEvents="none"
          style={[styles.handLayer, { transform: [{ rotate: `${handAngles.minute}deg` }] }]}
        >
          <View
            style={[
              styles.handMinute,
              { backgroundColor: isDark ? '#E8EDE9' : '#1A2F23' },
            ]}
          />
        </View>
        <View
          pointerEvents="none"
          style={[styles.handLayer, { transform: [{ rotate: `${handAngles.second}deg` }], zIndex: 2 }]}
        >
          <View style={[styles.handSecond, { backgroundColor: colors.second }]} />
        </View>

        <View style={[styles.hub, { backgroundColor: colors.ring }]} />
      </View>

      <View style={styles.meta}>
        {diffDays === 0 ? (
          <Text style={[styles.label, { color: accent }]}>Exam today</Text>
        ) : (
          <>
            <Text style={[styles.days, { color: accent }]}>{daysNumeral}</Text>
            <Text style={[styles.label, { color: accent }]}>{daysCaption}</Text>
          </>
        )}
        {remaining ? (
          <Text style={[styles.remaining, { color: isDark ? '#A1A1AA' : '#52525B' }]}>
            {remaining}
          </Text>
        ) : null}
        {dateLabel ? (
          <Text style={[styles.date, { color: isDark ? '#71717A' : '#A1A1AA' }]}>
            Exam · {dateLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
  },
  face: {
    width: FACE,
    height: FACE,
    borderRadius: FACE / 2,
    borderWidth: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  tick: {
    position: 'absolute',
    width: 2,
    height: 7,
    borderRadius: 999,
  },
  tickHour: {
    position: 'absolute',
    width: 2.5,
    height: 10,
    borderRadius: 999,
    opacity: 0.7,
  },
  handLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
  },
  handHour: {
    marginTop: CENTER - FACE * 0.28,
    width: 4,
    height: FACE * 0.28,
    borderRadius: 999,
  },
  handMinute: {
    marginTop: CENTER - FACE * 0.38,
    width: 3,
    height: FACE * 0.38,
    borderRadius: 999,
    opacity: 0.85,
  },
  handSecond: {
    marginTop: CENTER - FACE * 0.42,
    width: 2,
    height: FACE * 0.42,
    borderRadius: 999,
  },
  hub: {
    position: 'absolute',
    left: CENTER - 4.5,
    top: CENTER - 4.5,
    width: 9,
    height: 9,
    borderRadius: 999,
    zIndex: 3,
  },
  meta: { alignItems: 'center' },
  days: {
    fontFamily: Fonts.ui.bold,
    fontSize: 36,
    letterSpacing: -1,
    lineHeight: 40,
  },
  label: {
    marginTop: 2,
    fontFamily: Fonts.ui.semiBold,
    fontSize: 13,
  },
  remaining: {
    marginTop: 8,
    fontFamily: Fonts.ui.semiBold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  date: {
    marginTop: 4,
    fontFamily: Fonts.ui.regular,
    fontSize: 12,
  },
});
