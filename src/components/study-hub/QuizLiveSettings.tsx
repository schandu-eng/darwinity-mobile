import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Check, RotateCcw, X } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { useAppTheme } from '@/store/appThemeStore';
import type { Chapter } from '@/api/schemas/content';
import type { QuizSessionHistoryItem } from '@/api/schemas/studyHub';
import {
  QUIZ_QUESTION_TYPES,
  type QuizSessionConfigInput,
} from '@/study-hub/quizConfig';
import { STUDY_INK, STUDY_ZINC_500 } from './studyPanelTokens';

type TabId = 'topics' | 'types' | 'reset';

const NAV: { id: TabId; label: string }[] = [
  { id: 'topics', label: 'Quiz Topics' },
  { id: 'types', label: 'Question Types' },
  { id: 'reset', label: 'Reset Quiz' },
];

type Props = {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  config: QuizSessionConfigInput;
  setConfig: React.Dispatch<React.SetStateAction<QuizSessionConfigInput>>;
  selectedChapters: number[] | null;
  setSelectedChapters: (next: number[] | null) => void;
  chapters: Chapter[];
  history?: QuizSessionHistoryItem[];
  onApply: () => void | Promise<boolean | void>;
  onReset: () => void | Promise<void>;
};

export default function QuizLiveSettings({
  open,
  onClose,
  busy = false,
  config,
  setConfig,
  selectedChapters,
  setSelectedChapters,
  chapters,
  history = [],
  onApply,
  onReset,
}: Props) {
  const themeMode = useAppTheme() as 'light' | 'dark';
  const isDark = themeMode === 'dark';
  const [tab, setTab] = useState<TabId>('topics');

  const topicStats = useMemo(() => {
    const map = new Map<string, { title: string; correct: number; incorrect: number }>();
    for (const row of history) {
      const title = row?.question?.topic || 'General';
      const cur = map.get(title) || { title, correct: 0, incorrect: 0 };
      if (row.user_answer != null) {
        if (row.is_correct) cur.correct += 1;
        else if (row.is_correct === false) cur.incorrect += 1;
      }
      map.set(title, cur);
    }
    return Array.from(map.values());
  }, [history]);

  const paper = isDark ? '#111113' : '#FFFFFF';
  const ink = isDark ? '#F4F4F5' : '#18181B';
  const muted = isDark ? '#A1A1AA' : STUDY_ZINC_500;
  const border = isDark ? 'rgba(255,255,255,0.1)' : '#E4E4E7';
  const brand = isDark ? '#9BB8A6' : STUDY_INK;

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: paper }]}>
        <View style={styles.head}>
          <Text style={[styles.title, { color: ink }]}>Settings</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityLabel="Close settings">
            <X size={18} strokeWidth={ICON_STROKE} color={muted} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.navRow}>
          {NAV.map((item) => {
            const active = tab === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => setTab(item.id)}
                style={[
                  styles.navChip,
                  {
                    backgroundColor: active
                      ? isDark
                        ? 'rgba(122,158,134,0.18)'
                        : 'rgba(26,47,35,0.08)'
                      : 'transparent',
                  },
                ]}
              >
                <Text style={{ color: active ? brand : muted, fontFamily: Fonts.ui.medium, fontSize: 13 }}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 28 }}>
          {tab === 'topics' ? (
            <View style={{ gap: 12 }}>
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionTitle, { color: ink }]}>Quiz Topics</Text>
                {chapters.length > 0 ? (
                  <TouchableOpacity onPress={() => setSelectedChapters(null)}>
                    <Text style={{ color: brand, fontFamily: Fonts.ui.medium, fontSize: 12 }}>Select all</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {topicStats.map((t) => (
                <View key={t.title} style={[styles.statCard, { borderColor: border }]}>
                  <Text style={{ color: ink, fontFamily: Fonts.ui.medium, fontSize: 14 }}>{t.title}</Text>
                  <Text style={{ color: muted, fontSize: 12, marginTop: 4 }}>
                    <Text style={{ color: '#059669' }}>✓ {t.correct}</Text>
                    {' · '}
                    <Text style={{ color: '#EF4444' }}>✗ {t.incorrect}</Text>
                  </Text>
                </View>
              ))}

              {chapters.length > 0 ? (
                <>
                  {chapters.map((ch) => {
                    const id = ch.id;
                    const allSelected = selectedChapters === null;
                    const on = allSelected || (selectedChapters || []).includes(id);
                    return (
                      <TouchableOpacity
                        key={id}
                        onPress={() => {
                          if (allSelected) {
                            setSelectedChapters(chapters.map((c) => c.id).filter((x) => x !== id));
                            return;
                          }
                          const cur = selectedChapters || [];
                          if (on) {
                            const next = cur.filter((x) => x !== id);
                            setSelectedChapters(next.length ? next : chapters.map((c) => c.id));
                          } else {
                            const next = [...cur, id];
                            setSelectedChapters(
                              next.length === chapters.length ? null : next
                            );
                          }
                        }}
                        style={[
                          styles.typeCard,
                          {
                            borderColor: on ? (isDark ? 'rgba(122,158,134,0.45)' : 'rgba(26,47,35,0.35)') : border,
                            backgroundColor: on
                              ? isDark
                                ? 'rgba(122,158,134,0.12)'
                                : 'rgba(26,47,35,0.06)'
                              : 'transparent',
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.check,
                            {
                              backgroundColor: on ? brand : isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F5',
                            },
                          ]}
                        >
                          {on ? <Check size={12} strokeWidth={ICON_STROKE} color="#fff" /> : null}
                        </View>
                        <Text style={{ color: ink, fontFamily: Fonts.ui.semiBold, fontSize: 14, flex: 1 }}>
                          {ch.title || `Chapter ${id}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity
                    disabled={busy}
                    onPress={() => void onApply()}
                    style={[styles.primaryBtn, { backgroundColor: brand, opacity: busy ? 0.5 : 1 }]}
                  >
                    <Text style={styles.primaryBtnText}>{busy ? 'Applying…' : 'Apply topics'}</Text>
                  </TouchableOpacity>
                  <Text style={{ color: muted, fontSize: 12 }}>
                    Applies from the next question — your current progress stays.
                  </Text>
                </>
              ) : (
                <Text style={{ color: muted, fontSize: 14 }}>
                  Topics follow your notes automatically. Progress above updates as you answer.
                </Text>
              )}
            </View>
          ) : null}

          {tab === 'types' ? (
            <View style={{ gap: 12 }}>
              <Text style={[styles.sectionTitle, { color: ink }]}>Question Types</Text>
              {QUIZ_QUESTION_TYPES.map((t: { value: string; label: string }) => {
                const on = config.question_types.includes(t.value);
                return (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() =>
                      setConfig((c) => {
                        const next = on
                          ? c.question_types.filter((x) => x !== t.value)
                          : [...c.question_types, t.value];
                        return {
                          ...c,
                          question_types: next.length ? next : ['multiple_choice'],
                        };
                      })
                    }
                    style={[
                      styles.typeCard,
                      {
                        borderColor: on ? (isDark ? 'rgba(122,158,134,0.45)' : 'rgba(26,47,35,0.35)') : border,
                        backgroundColor: on
                          ? isDark
                            ? 'rgba(122,158,134,0.12)'
                            : 'rgba(26,47,35,0.06)'
                          : 'transparent',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.check,
                        {
                          backgroundColor: on ? brand : isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F5',
                        },
                      ]}
                    >
                      {on ? <Check size={12} strokeWidth={ICON_STROKE} color="#fff" /> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: ink, fontFamily: Fonts.ui.semiBold, fontSize: 14 }}>{t.label}</Text>
                      <Text style={{ color: muted, fontSize: 12, marginTop: 2 }}>
                        {t.value === 'multiple_choice'
                          ? 'Classic format with answer choices.'
                          : t.value === 'true_false'
                            ? 'Quick true or false checks.'
                            : 'Type your answer directly.'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <Text style={[styles.sectionTitle, { color: ink, marginTop: 8 }]}>Mode</Text>
              <View
                style={[
                  styles.modeTrack,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F4F4F5',
                    borderColor: border,
                  },
                ]}
              >
                {(['learn', 'exam'] as const).map((mode) => {
                  const active = config.mode === mode;
                  return (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => setConfig((c) => ({ ...c, mode }))}
                      style={[
                        styles.modeBtn,
                        active && { backgroundColor: isDark ? '#3F6B4F' : STUDY_INK },
                      ]}
                    >
                      <Text
                        style={{
                          color: active ? '#FAFAFA' : muted,
                          fontFamily: Fonts.ui.medium,
                          fontSize: 13,
                          textTransform: 'capitalize',
                        }}
                      >
                        {mode}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                disabled={busy}
                onPress={() => void onApply()}
                style={[styles.primaryBtn, { backgroundColor: brand, opacity: busy ? 0.5 : 1 }]}
              >
                <Text style={styles.primaryBtnText}>{busy ? 'Applying…' : 'Apply'}</Text>
              </TouchableOpacity>
              <Text style={{ color: muted, fontSize: 12 }}>
                Applies from the next question — your current progress stays.
              </Text>
            </View>
          ) : null}

          {tab === 'reset' ? (
            <View style={{ gap: 12 }}>
              <Text style={[styles.sectionTitle, { color: ink }]}>Reset Quiz</Text>
              <Text style={{ color: muted, fontSize: 14 }}>
                Reset your progress and return to question 1.
              </Text>
              <Text style={{ color: '#DC2626', fontFamily: Fonts.ui.medium, fontSize: 14 }}>
                This cannot be undone.
              </Text>
              <TouchableOpacity
                disabled={busy}
                onPress={() => void onReset()}
                style={[styles.resetBtn, { opacity: busy ? 0.5 : 1 }]}
              >
                <RotateCcw size={16} strokeWidth={ICON_STROKE} color="#fff" />
                <Text style={styles.primaryBtnText}>{busy ? 'Resetting…' : 'Reset Progress'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '88%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  title: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 17,
  },
  navRow: {
    paddingHorizontal: 16,
    gap: 6,
    paddingBottom: 8,
  },
  navChip: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  body: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  modeTrack: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    gap: 2,
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 11,
  },
  primaryBtn: {
    marginTop: 4,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
  },
  resetBtn: {
    marginTop: 4,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#DC2626',
  },
});
