import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { focusEndpoints, type LoyaltyHistory, type LoyaltyMe } from '@/api/endpoints/concentration';
import {
  TOTAL_CHECKPOINT_PERCENT,
  buildDailySeries,
  dayBarRatio,
  dayBarSeconds,
  formatDayNumber,
  formatHoursFromSeconds,
  formatMinutes,
  formatPeriodRange,
  formatScore,
  formatShortDate,
  getCheckpointStates,
  getQuestProgress,
  niceBarCeilingSeconds,
  type DailyPoint,
} from '@/features/concentration/loyaltyCheckpoints';
import { STUDY_PAGE_LABELS } from '@/features/concentration/useStudyPageDwell';
import { BookOpen, Check, Clock, Gem, Layers, Sparkles, Timer } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { toUserFacingError } from '@/utils/userFacingError';
import { navigationRef } from '@/navigation/navigationRef';

type ThemeColors = typeof lightTheme.colors;

/** Web zinc-50/100 — cool gray, not brand paper cream. */
function mutedFill(isDark: boolean) {
  return isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F5';
}

function surfaceCard(colors: ThemeColors) {
  return {
    backgroundColor: colors.surface,
    borderColor: colors.outlineVariant,
  };
}

/** Mirrors web QuestRing (7.25rem / r=48 / stroke 10). */
function QuestRing({
  percent,
  score,
  colors,
  isDark,
}: {
  percent: number;
  score: string;
  colors: ThemeColors;
  isDark: boolean;
}) {
  const size = 116;
  const stroke = 9;
  const r = 48 * (size / 128);
  const c = 2 * Math.PI * r;
  const p = Math.min(100, Math.max(0, percent));
  const offset = c - (p / 100) * c;

  return (
    <View style={{ width: size, height: size, alignSelf: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={isDark ? 'rgba(255,255,255,0.1)' : '#F4F4F5'}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <Text style={[styles.ringLabel, { color: colors.onSurfaceVariant }]}>Score</Text>
        <Text style={[styles.ringScore, { color: colors.onSurface }]}>{score}</Text>
      </View>
    </View>
  );
}

function MetricTile({
  Icon,
  label,
  value,
  colors,
  isDark,
}: {
  Icon: typeof BookOpen;
  label: string;
  value: string;
  colors: ThemeColors;
  isDark: boolean;
}) {
  return (
    <View style={[styles.metricTile, { backgroundColor: mutedFill(isDark) }]}>
      <View style={styles.metricLabelRow}>
        <Icon size={14} strokeWidth={ICON_STROKE} color={colors.onSurfaceVariant} />
        <Text style={[styles.metricLabel, { color: colors.onSurfaceVariant }]}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color: colors.onSurface }]}>{value}</Text>
    </View>
  );
}

function DailyActivityChart({
  days,
  selectedDate,
  onSelect,
  maxBar,
  colors,
  isDark,
}: {
  days: DailyPoint[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
  maxBar: number;
  colors: ThemeColors;
  isDark: boolean;
}) {
  return (
    <View>
      <Text style={[styles.chartCeil, { color: colors.onSurfaceVariant }]}>
        {formatMinutes(maxBar)}
      </Text>
      <View style={styles.bars}>
        {days.map((d, idx) => {
          const barSeconds = dayBarSeconds(d);
          const studied = barSeconds > 0 || d.L_delta > 0;
          const ratio = dayBarRatio(barSeconds, maxBar);
          const active = selectedDate === d.date;
          const heightPct = ratio > 0 ? Math.max(10, Math.round(ratio * 100)) : 0;
          return (
            <Pressable
              key={d.date}
              onPress={() => onSelect(d.date)}
              style={[styles.barCol, idx === 6 ? { marginRight: 6 } : null]}
            >
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: heightPct > 0 ? `${heightPct}%` : 6,
                      backgroundColor: active
                        ? colors.primary
                        : studied
                          ? `${colors.primary}B3`
                          : mutedFill(isDark),
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.barDay,
                  {
                    color: active ? colors.primary : colors.onSurfaceVariant,
                    fontFamily: active ? Fonts.ui.semiBold : Fonts.ui.medium,
                  },
                ]}
              >
                {formatDayNumber(d.date)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function formatMoney(amount: number, currency: string): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(amount >= 100 ? 0 : 2)} ${currency || ''}`.trim();
  }
}

function statusMeta(status: string, colors: ThemeColors, isDark: boolean) {
  if (status === 'claimed') {
    return { label: 'Claimed', bg: `${colors.primary}26`, fg: colors.primary };
  }
  if (status === 'ready') {
    return { label: 'Reached', bg: isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5', fg: isDark ? '#6EE7B7' : '#047857' };
  }
  if (status === 'current') {
    return { label: 'In progress', bg: isDark ? 'rgba(251,191,36,0.15)' : '#FFFBEB', fg: isDark ? '#FCD34D' : '#92400E' };
  }
  return { label: 'Locked', bg: mutedFill(isDark), fg: colors.onSurfaceVariant };
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ConcentrationStatsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const userId = useAuthStore((s) => s.user?.id);
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const colors = theme.colors;
  const isDark = themeMode === 'dark';

  const [me, setMe] = useState<LoyaltyMe | null>(null);
  const [history, setHistory] = useState<LoyaltyHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [loyalty, hist] = await Promise.all([
        focusEndpoints.getLoyaltyMe(userId),
        focusEndpoints.getLoyaltyHistory(userId),
      ]);
      setMe(loyalty);
      setHistory(hist);
    } catch (e) {
      console.warn('Could not load study stats:', toUserFacingError(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dailySeries = useMemo(() => buildDailySeries(history?.daily || [], 14), [history?.daily]);
  const periods = useMemo(() => {
    const all = history?.periods || [];
    const currentKey = me?.period_key;
    if (!currentKey) return all;
    return all.filter((p) => p.period_key !== currentKey);
  }, [history?.periods, me?.period_key]);
  const quest = useMemo(() => getQuestProgress(me), [me]);
  const checkpoints = useMemo(
    () => getCheckpointStates(me?.L, me?.checkpoints_claimed),
    [me?.L, me?.checkpoints_claimed]
  );

  useEffect(() => {
    if (!dailySeries.length) return;
    setSelectedDate((prev) => {
      if (prev && dailySeries.some((d) => d.date === prev)) return prev;
      const best = [...dailySeries]
        .reverse()
        .find((d) => d.dwell_seconds > 0 || d.active_seconds > 0 || d.L_delta > 0);
      return best?.date || dailySeries[dailySeries.length - 1]?.date || null;
    });
  }, [dailySeries]);

  useEffect(() => {
    setSelectedCheckpoint((prev) => {
      if (prev && checkpoints.some((c) => c.code === prev)) return prev;
      const current = checkpoints.find((c) => c.status === 'current');
      const claimed = [...checkpoints].reverse().find((c) => c.status === 'claimed');
      return current?.code || claimed?.code || checkpoints[0]?.code || null;
    });
  }, [checkpoints]);

  const maxBar = useMemo(() => {
    const peak = Math.max(...dailySeries.map((d) => dayBarSeconds(d)), 0);
    return niceBarCeilingSeconds(peak);
  }, [dailySeries]);

  const selectedDay = dailySeries.find((d) => d.date === selectedDate) || null;
  const selectedCp =
    checkpoints.find((c) => c.code === selectedCheckpoint) || checkpoints[0] || null;
  const maxEarnLabel = me?.can_earn
    ? formatMoney(Number(me.amount_for_cap) * TOTAL_CHECKPOINT_PERCENT, me.currency)
    : null;
  const cardsDone = Number.isFinite(Number(me?.fc_reviews)) ? Number(me?.fc_reviews) : 0;
  const quizDone = Number.isFinite(Number(me?.quiz_correct)) ? Number(me?.quiz_correct) : 0;
  const hasActivity =
    dailySeries.some((d) => d.dwell_seconds > 0 || d.active_seconds > 0 || d.L_delta > 0) ||
    quest.score > 0;
  const claimedCount = (me?.checkpoints_claimed || []).length;

  const goStudy = () => navigation.navigate('HomeFeed');
  const goRewards = () => {
    if (!navigationRef.isReady()) return;
    navigationRef.navigate('App', {
      screen: 'AccountModal',
      params: { screen: 'RewardsInbox' },
    });
  };

  const onToggleHow = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setHowOpen((v) => !v);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const cpStatus = selectedCp ? statusMeta(selectedCp.status, colors, isDark) : null;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header — matches web */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Study quest</Text>
        <Pressable
          onPress={onToggleHow}
          style={[styles.chipBtn, surfaceCard(colors), { borderWidth: 1 }]}
        >
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: Fonts.ui.medium, fontSize: 12 }}>
            {howOpen ? 'Hide tips' : 'How it works'}
          </Text>
        </Pressable>
      </View>

      {howOpen ? (
        <View style={[styles.howCard, surfaceCard(colors), { borderWidth: 1 }]}>
          <Text style={[styles.howText, { color: colors.onSurfaceVariant }]}>
            1. Time on notes, cards, quizzes, and other study pages is tracked automatically and counts toward your score.
          </Text>
          <Text style={[styles.howText, { color: colors.onSurfaceVariant }]}>
            2. Reviewing cards and answering quizzes also earns points. Finishing a pomodoro adds a bonus.
          </Text>
          <Text style={[styles.howText, { color: colors.onSurfaceVariant }]}>
            3. Reach checkpoints A→D to unlock rewards (up to{' '}
            {Math.round(TOTAL_CHECKPOINT_PERCENT * 100)}% back).
          </Text>
        </View>
      ) : null}

      {/* Hero card — same structure as web ConcentrationStatsPage */}
      <View style={[styles.heroCard, surfaceCard(colors), { borderWidth: 1 }]}>
        <View style={styles.heroBody}>
          <QuestRing
            percent={quest.percent}
            score={formatScore(quest.score)}
            colors={colors}
            isDark={isDark}
          />

          <View style={styles.heroCopy}>
            <View style={[styles.badge, { backgroundColor: `${colors.primary}1A` }]}>
              <Sparkles size={14} strokeWidth={ICON_STROKE} color={colors.primary} />
              <Text style={{ color: colors.primary, fontFamily: Fonts.ui.semiBold, fontSize: 12 }}>
                {quest.nextCode ? `Next: ${quest.label}` : quest.label}
              </Text>
            </View>

            <Text style={[styles.heroTitle, { color: colors.onSurface }]}>
              {hasActivity
                ? quest.nextCode
                  ? `${Math.round(quest.percent)}% of the way there`
                  : 'Period quest complete'
                : 'Your quest starts when you study'}
            </Text>

            <Text style={[styles.heroDetail, { color: colors.onSurfaceVariant }]}>
              {hasActivity ? quest.detail : 'Open notes, cards, or a quiz to begin.'}
            </Text>

            {quest.nextCode ? (
              <View style={styles.progressBlock}>
                <View style={[styles.progressTrack, { backgroundColor: mutedFill(isDark) }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${quest.percent}%`, backgroundColor: colors.primary },
                    ]}
                  />
                </View>
                <View style={styles.progressLabels}>
                  <Text style={[styles.progressHint, { color: colors.onSurfaceVariant }]}>0</Text>
                  <Text style={[styles.progressHint, { color: colors.onSurfaceVariant }]}>
                    {formatScore(quest.target)} pts
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.ctaRow}>
              <Pressable
                onPress={goStudy}
                style={[styles.ctaPrimary, { backgroundColor: colors.primary }]}
              >
                <Timer size={16} strokeWidth={ICON_STROKE} color={colors.onPrimary} />
                <Text style={{ color: colors.onPrimary, fontFamily: Fonts.ui.semiBold, fontSize: 13 }}>
                  Go study
                </Text>
              </Pressable>
              {/* Wallet / plan-credit redeem is not offered on iOS (App Store IAP). */}
              {Platform.OS !== 'ios' ? (
                <Pressable
                  onPress={goRewards}
                  style={[
                    styles.ctaSecondary,
                    { borderColor: colors.outlineVariant, backgroundColor: colors.surface },
                  ]}
                >
                  <Gem size={16} strokeWidth={ICON_STROKE} color={colors.onSurface} />
                  <Text style={{ color: colors.onSurface, fontFamily: Fonts.ui.semiBold, fontSize: 13 }}>
                    Rewards
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[styles.metricsGrid, { borderTopColor: colors.outlineVariant, backgroundColor: colors.surface }]}>
          <MetricTile
            Icon={BookOpen}
            label="Study time"
            value={formatHoursFromSeconds(me?.dwell_seconds)}
            colors={colors}
            isDark={isDark}
          />
          <MetricTile
            Icon={Clock}
            label="Focus time"
            value={`${formatScore(me?.H_time)}h`}
            colors={colors}
            isDark={isDark}
          />
          <MetricTile Icon={Layers} label="Cards" value={String(cardsDone)} colors={colors} isDark={isDark} />
          <MetricTile Icon={Check} label="Quiz" value={String(quizDone)} colors={colors} isDark={isDark} />
        </View>

        <View style={[styles.footerNote, { borderTopColor: colors.outlineVariant, backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: Fonts.ui.regular, fontSize: 14, lineHeight: 20 }}>
            {!me?.can_earn ? (
              <Text style={{ color: colors.primary, fontFamily: Fonts.ui.semiBold }}>
                {Platform.OS === 'ios'
                  ? 'Keep studying with Focus to earn rewards.'
                  : 'Keep studying with Focus to earn rewards toward your next plan.'}
              </Text>
            ) : maxEarnLabel ? (
              <>
                Earn up to{' '}
                <Text style={{ color: colors.onSurface, fontFamily: Fonts.ui.semiBold }}>
                  {maxEarnLabel}
                </Text>
                {claimedCount > 0 ? ` · ${claimedCount}/${checkpoints.length} claimed` : ''}
              </>
            ) : (
              `Hit checkpoints to earn up to ${Math.round(TOTAL_CHECKPOINT_PERCENT * 100)}% back.`
            )}
          </Text>
        </View>
      </View>

      {/* Checkpoint path — matches web */}
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.onSurface }]}>Checkpoint path</Text>
        <Text style={{ color: colors.onSurfaceVariant, fontFamily: Fonts.ui.medium, fontSize: 12 }}>
          {claimedCount}/{checkpoints.length}
        </Text>
      </View>

      <View style={styles.cpRow}>
        {checkpoints.map((cp) => {
          const active = selectedCheckpoint === cp.code;
          const claimed = cp.status === 'claimed' || cp.status === 'ready';
          const current = cp.status === 'current';
          return (
            <Pressable
              key={cp.code}
              onPress={() => setSelectedCheckpoint(cp.code)}
              style={[
                styles.cpBtn,
                {
                  backgroundColor: colors.surface,
                  borderColor: active ? colors.primary : colors.outlineVariant,
                  borderWidth: active ? 2 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.cpDot,
                  {
                    backgroundColor: claimed || current ? colors.primary : mutedFill(isDark),
                  },
                ]}
              >
                {claimed ? (
                  <Check size={16} strokeWidth={ICON_STROKE} color={colors.onPrimary} />
                ) : (
                  <Text
                    style={{
                      color: current ? colors.onPrimary : colors.onSurfaceVariant,
                      fontFamily: Fonts.ui.bold,
                      fontSize: 13,
                    }}
                  >
                    {cp.code}
                  </Text>
                )}
              </View>
              <Text style={{ color: colors.onSurface, fontFamily: Fonts.ui.semiBold, fontSize: 11 }}>
                {cp.title}
              </Text>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: Fonts.ui.regular, fontSize: 10 }}>
                {cp.minL} pts
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedCp && cpStatus ? (
        <View style={[styles.cpDetail, surfaceCard(colors), { borderWidth: 1 }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.onSurface, fontFamily: Fonts.ui.semiBold, fontSize: 14 }}>
              Checkpoint {selectedCp.code} · {selectedCp.title}
            </Text>
            <View style={styles.cpDetailMeta}>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: Fonts.ui.regular, fontSize: 12 }}>
                Need {selectedCp.minL} pts
              </Text>
              <Text style={{ color: colors.onSurfaceVariant, fontFamily: Fonts.ui.regular, fontSize: 12 }}>
                Reward: {Math.round(selectedCp.percent * 100)}% back
              </Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: cpStatus.bg }]}>
            <Text style={{ color: cpStatus.fg, fontFamily: Fonts.ui.semiBold, fontSize: 11 }}>
              {cpStatus.label}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Last 14 days — matches web */}
      <Text style={[styles.sectionTitle, { color: colors.onSurface, marginTop: 8 }]}>
        Last 14 days
      </Text>

      {!hasActivity ? (
        <View style={[styles.chartCard, surfaceCard(colors), { borderWidth: 1, borderStyle: 'dashed' }]}>
          <Text style={{ color: colors.onSurface, fontFamily: Fonts.ui.semiBold, fontSize: 15 }}>
            No study days yet
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: Fonts.ui.regular, fontSize: 13, marginTop: 4 }}>
            Each study day fills this chart with time and points.
          </Text>
          <Pressable
            onPress={goStudy}
            style={[styles.ctaPrimary, { backgroundColor: colors.primary, alignSelf: 'flex-start', marginTop: 12 }]}
          >
            <Timer size={16} strokeWidth={ICON_STROKE} color={colors.onPrimary} />
            <Text style={{ color: colors.onPrimary, fontFamily: Fonts.ui.semiBold, fontSize: 13 }}>
              Go study
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.chartCard, surfaceCard(colors), { borderWidth: 1 }]}>
          <DailyActivityChart
            days={dailySeries}
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            maxBar={maxBar}
            colors={colors}
            isDark={isDark}
          />

          {selectedDay ? (
            <View style={[styles.dayDetail, { backgroundColor: mutedFill(isDark) }]}>
              <Text style={{ color: colors.onSurface, fontFamily: Fonts.ui.medium, fontSize: 14 }}>
                {formatShortDate(selectedDay.date)}
              </Text>
              <View style={styles.dayMetrics}>
                {[
                  { label: 'Study', value: formatMinutes(selectedDay.dwell_seconds) },
                  { label: 'Focus', value: formatMinutes(selectedDay.active_seconds) },
                  { label: 'Cards', value: String(selectedDay.fc_reviews) },
                  { label: 'Quiz', value: String(selectedDay.quiz_correct) },
                  { label: 'Points', value: `+${formatScore(selectedDay.L_delta)}`, accent: true },
                ].map((m) => (
                  <View key={m.label} style={styles.dayMetric}>
                    <Text style={{ color: colors.onSurfaceVariant, fontFamily: Fonts.ui.regular, fontSize: 11 }}>
                      {m.label}
                    </Text>
                    <Text
                      style={{
                        color: m.accent ? colors.primary : colors.onSurface,
                        fontFamily: Fonts.ui.semiBold,
                        fontSize: 14,
                      }}
                    >
                      {m.value}
                    </Text>
                  </View>
                ))}
              </View>
              {selectedDay.pages?.length ? (
                <View style={[styles.pageList, { borderTopColor: colors.outlineVariant }]}>
                  {selectedDay.pages.map((page) => (
                    <View
                      key={`${page.content_id}-${page.page_type}`}
                      style={styles.pageRow}
                    >
                      <Text
                        style={{ color: colors.onSurfaceVariant, fontFamily: Fonts.ui.regular, fontSize: 12, flex: 1 }}
                        numberOfLines={1}
                      >
                        {STUDY_PAGE_LABELS[page.page_type] || page.page_type}
                        {page.content_title ? ` · ${page.content_title}` : ''}
                      </Text>
                      <Text style={{ color: colors.onSurface, fontFamily: Fonts.ui.medium, fontSize: 12 }}>
                        {formatMinutes(page.dwell_seconds)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      )}

      {/* Past periods — matches web (always shown) */}
      <Text style={[styles.sectionTitle, { color: colors.onSurface, marginTop: 8 }]}>
        Past periods
      </Text>

      {periods.length === 0 ? (
        <View style={[styles.chartCard, surfaceCard(colors), { borderWidth: 1, borderStyle: 'dashed' }]}>
          <Text style={{ color: colors.onSurface, fontFamily: Fonts.ui.semiBold, fontSize: 15 }}>
            First period in progress
          </Text>
          <Text style={{ color: colors.onSurfaceVariant, fontFamily: Fonts.ui.regular, fontSize: 13, marginTop: 4 }}>
            When this month’s quest ends, a summary lands here.
          </Text>
        </View>
      ) : (
        periods.map((p) => {
          const claimed = p.checkpoints_claimed || [];
          return (
            <View
              key={p.period_key}
              style={[styles.chartCard, surfaceCard(colors), { borderWidth: 1 }]}
            >
              <View style={styles.periodHead}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontFamily: Fonts.ui.medium, fontSize: 14 }}>
                    {formatPeriodRange(p.period_start, p.period_end)}
                  </Text>
                  <Text style={{ color: colors.onSurfaceVariant, fontFamily: Fonts.ui.regular, fontSize: 13, marginTop: 2 }}>
                    Final score {formatScore(p.L)}
                  </Text>
                </View>
                <Text style={{ color: colors.onSurfaceVariant, fontFamily: Fonts.ui.medium, fontSize: 12 }}>
                  {claimed.length}/4 claimed
                </Text>
              </View>
              <View style={styles.cpMiniRow}>
                {['A', 'B', 'C', 'D'].map((code) => {
                  const got = claimed.includes(code);
                  return (
                    <View
                      key={code}
                      style={[
                        styles.cpMini,
                        { backgroundColor: got ? colors.primary : mutedFill(isDark) },
                      ]}
                    >
                      {got ? (
                        <Check size={14} strokeWidth={ICON_STROKE} color={colors.onPrimary} />
                      ) : (
                        <Text
                          style={{
                            color: colors.onSurfaceVariant,
                            fontFamily: Fonts.ui.bold,
                            fontSize: 11,
                          }}
                        >
                          {code}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, gap: 16 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { fontFamily: Fonts.ui.bold, fontSize: 24, letterSpacing: -0.3, flex: 1 },
  chipBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  howCard: { borderRadius: 16, padding: 12, gap: 6 },
  howText: { fontFamily: Fonts.ui.regular, fontSize: 13, lineHeight: 18 },

  heroCard: { borderRadius: 24, overflow: 'hidden', marginTop: 4 },
  heroBody: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 16, gap: 14 },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    fontFamily: Fonts.ui.medium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ringScore: {
    fontFamily: Fonts.ui.bold,
    fontSize: 30,
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  heroCopy: { alignItems: 'center', gap: 6 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 2,
  },
  heroTitle: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 17,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  heroDetail: {
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    textAlign: 'center',
  },
  progressBlock: { width: '100%', marginTop: 4, gap: 6 },
  progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressHint: { fontFamily: Fonts.ui.regular, fontSize: 11 },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6,
  },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  ctaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },

  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  metricTile: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 4,
  },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricLabel: { fontFamily: Fonts.ui.medium, fontSize: 12 },
  metricValue: { fontFamily: Fonts.ui.semiBold, fontSize: 16, letterSpacing: -0.2 },
  footerNote: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { fontFamily: Fonts.ui.semiBold, fontSize: 17 },

  cpRow: { flexDirection: 'row', gap: 8 },
  cpBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 4,
  },
  cpDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cpDetail: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cpDetailMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },

  chartCard: { borderRadius: 16, padding: 16, gap: 14 },
  chartCeil: {
    alignSelf: 'flex-end',
    fontFamily: Fonts.ui.medium,
    fontSize: 10,
    marginBottom: 2,
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 3 },
  barCol: { flex: 1, height: '100%', alignItems: 'center', gap: 8 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, minHeight: 4 },
  barDay: { fontSize: 11, fontVariant: ['tabular-nums'] },

  dayDetail: { borderRadius: 12, padding: 14, gap: 10 },
  dayMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dayMetric: { width: '30%', flexGrow: 1, gap: 2 },
  pageList: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 8 },
  pageRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },

  periodHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  cpMiniRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cpMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ConcentrationStatsScreen;
