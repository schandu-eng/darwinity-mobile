import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  FileText,
  Folder,
  GraduationCap,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { useAuthStore } from '@/store';
import {
  TEST_PREP_TARGET_KEY,
  useExamTarget,
  useExamSessions,
  useExamReviseSummary,
  useInvalidateExamPrep,
} from '@/api/queries/testPrep';
import { prefetchContentDetail } from '@/api/queries/content';
import { testPrepService } from '@/services/testPrepService';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { HubHomeHeader } from '@/components/home/HubHomeHeader';
import { PanelLoadError } from '@/components/ui/PanelLoadError';
import ExamPrepProGate, { useExamPrepAccess } from '@/components/exam-prep/ExamPrepProGate';
import ExamDueClock from '@/components/exam-prep/ExamDueClock';
import ExamUploadModal from '@/components/exam-prep/ExamUploadModal';
import EvalPlayer from '@/components/exam-prep/EvalPlayer';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import { Fonts } from '@/config/fonts';
import { BRAND_COLORS } from '@/config/brand';
import { boxShadow } from '@/theme/webCompat';
import { preloadQuizAnswerFeedback } from '@/study-hub/quizAnswerFeedback';
import { formatWhen, sessionStatusMeta } from './testPrepFormatters';
import { navigationRef } from '@/navigation/navigationRef';
import type { ExamPrepStackParamList } from '@/types/navigation';
import type { ExamEvalSession, ExamTargetDetail } from '@/api/schemas/testPrep';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type TargetRoute = RouteProp<ExamPrepStackParamList, 'ExamPrepTarget'>;
type NavigationProp = NativeStackNavigationProp<ExamPrepStackParamList, 'ExamPrepTarget'>;

const ExamPrepTargetScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<TargetRoute>();
  const { targetId, autostart } = route.params;
  const themeMode = useAppTheme();
  const isDark = themeMode === 'dark';
  const theme = isDark ? darkTheme : lightTheme;
  const paper = isDark ? '#09090B' : BRAND_COLORS.paper;
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const { allowed } = useExamPrepAccess();
  const invalidate = useInvalidateExamPrep();
  const queryClient = useQueryClient();

  const { data: target, isLoading, isRefetching, error, refetch } = useExamTarget(
    allowed ? targetId : null,
    allowed ? userId : null
  );
  const { data: sessions = [], refetch: refetchSessions } = useExamSessions(
    allowed ? targetId : null,
    allowed ? userId : null
  );
  const { data: reviseSummary, refetch: refetchRevise } = useExamReviseSummary(
    allowed ? targetId : null,
    allowed ? userId : null
  );

  const [uploadOpen, setUploadOpen] = useState(false);
  const [pyqs, setPyqs] = useState('');
  const [savingPyqs, setSavingPyqs] = useState(false);
  const [pyqsSaved, setPyqsSaved] = useState(false);
  const [starting, setStarting] = useState(false);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const [session, setSession] = useState<ExamEvalSession | null>(null);
  const [phase, setPhase] = useState<'setup' | 'playing'>('setup');
  const autostartDoneRef = useRef(false);

  useEffect(() => {
    preloadQuizAnswerFeedback();
  }, []);

  useEffect(() => {
    if (target?.pyqs_text != null) setPyqs(target.pyqs_text);
  }, [target?.pyqs_text]);

  const hasMaterials = useMemo(() => {
    if (!target) return false;
    return (
      (target.content_count || 0) > 0 ||
      (target.folder_count || 0) > 0 ||
      (target.contents || []).length > 0 ||
      (target.folders || []).length > 0
    );
  }, [target]);

  const hasPyqs = useMemo(() => {
    if (!target) return false;
    return Boolean((pyqs || target.pyqs_text || '').trim()) || Boolean(target.has_pyqs);
  }, [target, pyqs]);

  const canGeneratePractice = hasMaterials || hasPyqs;

  const reviseQueueTotal = reviseSummary?.total_study_queue || 0;

  const patchTarget = useCallback(
    (next: ExamTargetDetail | ((prev: ExamTargetDetail | undefined) => ExamTargetDetail | undefined)) => {
      queryClient.setQueryData<ExamTargetDetail>([TEST_PREP_TARGET_KEY, targetId, userId], (prev) =>
        typeof next === 'function' ? next(prev) : next
      );
    },
    [queryClient, targetId, userId]
  );

  const ensureCanGenerate = useCallback(() => {
    if (canGeneratePractice) return true;
    Alert.alert(
      'Add materials first',
      'Add notes or folders, or paste PYQs, before generating practice'
    );
    return false;
  }, [canGeneratePractice]);

  const startEval = useCallback(
    async ({
      evalType,
      questionCount,
      difficulty,
      timed = false,
    }: {
      evalType: 'mcq' | 'qa';
      questionCount: number;
      difficulty: string;
      timed?: boolean;
    }) => {
      if (!userId) return;
      if (!ensureCanGenerate()) return;
      setStarting(true);
      try {
        const result = await testPrepService.startEvaluate(targetId, {
          userId,
          evalType,
          questionCount,
          difficulty,
        });
        if (!result.success || !result.data) {
          Alert.alert('Failed to start practice', result.message || 'Try again');
          return;
        }
        const deadlineAt = timed
          ? new Date(Date.now() + questionCount * 60 * 1000).toISOString()
          : null;
        setSession({
          ...result.data,
          timed: Boolean(timed),
          deadline_at: deadlineAt,
        });
        setPhase('playing');
        setUploadOpen(false);
        analytics.track(EVENTS.EXAM_PRACTICE_STARTED, {
          target_id: targetId,
          session_id: result.data.id,
          eval_type: evalType,
          question_count: questionCount,
          difficulty,
          timed: Boolean(timed),
        });
        await refetchSessions();
      } finally {
        setStarting(false);
      }
    },
    [targetId, userId, refetchSessions, ensureCanGenerate]
  );

  const startQuickPractice = useCallback(() => {
    if (!ensureCanGenerate()) return;
    void startEval({
      evalType: 'mcq',
      questionCount: 10,
      difficulty: 'mixed',
      timed: false,
    });
  }, [startEval, ensureCanGenerate]);

  const handleOpenGenerate = useCallback(() => {
    if (!ensureCanGenerate()) return;
    setUploadOpen(true);
  }, [ensureCanGenerate]);

  useEffect(() => {
    if (isLoading || !target || starting || phase !== 'setup') return;
    if (autostartDoneRef.current) return;
    if (!autostart) return;
    if (!hasMaterials) return;
    autostartDoneRef.current = true;
    startQuickPractice();
  }, [isLoading, target, starting, phase, autostart, startQuickPractice, hasMaterials]);

  const savePyqs = async () => {
    if (!userId) return;
    setSavingPyqs(true);
    setPyqsSaved(false);
    try {
      const data = await testPrepService.savePyqs(targetId, userId, pyqs);
      if (!data.success || !data.data) {
        Alert.alert('Failed to save PYQs', data.message || 'Try again');
        return;
      }
      patchTarget(data.data);
      setPyqsSaved(true);
    } finally {
      setSavingPyqs(false);
    }
  };

  const removeNote = async (contentId: number) => {
    if (!userId) return;
    const result = await testPrepService.removeContent(targetId, userId, contentId);
    if (!result.success) {
      Alert.alert('Failed to remove note', result.message || 'Try again');
      return;
    }
    patchTarget((prev) =>
      prev
        ? {
            ...prev,
            contents: (prev.contents || []).filter((c) => c.id !== contentId),
            content_count: Math.max(0, (prev.content_count || 1) - 1),
          }
        : prev
    );
    void refetchRevise();
  };

  const removeFolder = async (folderId: number) => {
    if (!userId) return;
    const result = await testPrepService.removeFolder(targetId, userId, folderId);
    if (!result.success) {
      Alert.alert('Failed to remove folder', result.message || 'Try again');
      return;
    }
    patchTarget((prev) =>
      prev
        ? {
            ...prev,
            folders: (prev.folders || []).filter((f) => f.id !== folderId),
            folder_count: Math.max(0, (prev.folder_count || 1) - 1),
          }
        : prev
    );
    void refetchRevise();
  };

  const openNote = (contentId: number) => {
    if (!navigationRef.isReady()) return;
    void prefetchContentDetail(contentId, userId);
    navigationRef.navigate('App', {
      screen: 'Content',
      params: { screen: 'ContentDetail', params: { contentId } },
    });
  };

  const openCards = (contentId: number) => {
    if (!navigationRef.isReady()) return;
    void prefetchContentDetail(contentId, userId);
    navigationRef.navigate('App', {
      screen: 'Content',
      params: {
        screen: 'ContentDetail',
        params: { contentId, initialTab: 'flashcards' },
      },
    });
  };

  const openSession = async (summaryId: number) => {
    if (!userId) return;
    setOpeningId(summaryId);
    try {
      const data = await testPrepService.getSession(summaryId, userId);
      if (!data.success || !data.data) {
        Alert.alert('Could not open practice', data.message || 'Try again');
        return;
      }
      setSession(data.data);
      setPhase('playing');
    } finally {
      setOpeningId(null);
    }
  };

  const exitPlayer = async () => {
    setPhase('setup');
    setSession(null);
    await refetchSessions();
    invalidate();
  };

  if (!allowed) {
    return (
      <View style={[styles.flex, { backgroundColor: paper }]}>
        <HubHomeHeader />
        <View style={styles.padded}>
          <ExamPrepProGate />
        </View>
      </View>
    );
  }

  if (error && !target) {
    return (
      <View style={[styles.flex, { backgroundColor: paper }]}>
        <HubHomeHeader />
        <View style={styles.padded}>
          <PanelLoadError
            fill
            title="Couldn't load this exam"
            description={error instanceof Error ? error.message : undefined}
            onRetry={() => {
              void refetch();
            }}
            retrying={isRefetching}
          />
        </View>
      </View>
    );
  }

  if (isLoading || !target) {
    return (
      <View style={[styles.flex, { backgroundColor: paper }]}>
        <HubHomeHeader />
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: paper }]}>
      <HubHomeHeader />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          onPress={() => navigation.navigate('ExamPrepHub')}
          style={styles.backRow}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="All exam targets"
        >
          <ArrowLeft size={16} strokeWidth={ICON_STROKE} color={theme.colors.onSurfaceVariant} />
          <Text style={[styles.backText, { color: theme.colors.onSurfaceVariant }]}>All exam targets</Text>
        </TouchableOpacity>

        <Text style={[styles.pageTitle, { color: theme.colors.onSurface }]}>{target.name}</Text>
        {target.description ? (
          <Text style={[styles.pageSub, { color: theme.colors.onSurfaceVariant }]}>{target.description}</Text>
        ) : null}
        {target.exam_date ? <ExamDueClock examDate={target.exam_date} isDark={isDark} /> : null}

        {phase === 'playing' && session ? (
          <View style={{ marginTop: 24 }}>
            <EvalPlayer
              key={session.id}
              session={session}
              userId={userId}
              onDone={() => {
                void refetchSessions();
              }}
              onExit={() => {
                void exitPlayer();
              }}
            />
          </View>
        ) : (
          <View style={{ marginTop: 32, gap: 16 }}>
            <View
              style={[
                styles.panel,
                {
                  backgroundColor: isDark ? 'rgba(24,24,27,0.8)' : 'rgba(255,255,255,0.9)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)',
                },
              ]}
            >
              <View style={styles.testsHeadLeft}>
                <View style={[styles.testsIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                  <Folder size={16} strokeWidth={ICON_STROKE} color={theme.colors.secondary} />
                </View>
                <Text style={[styles.testsTitle, { color: theme.colors.onSurface }]}>Materials</Text>
              </View>
              {(target.folders?.length || target.contents?.length) ? (
                <View style={[styles.chips, { marginTop: 14 }]}>
                  {(target.folders || []).map((folder) => (
                    <View
                      key={`f-${folder.id}`}
                      style={[
                        styles.chip,
                        {
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(228,228,231,0.8)',
                          backgroundColor: isDark ? 'rgba(24,24,27,0.6)' : '#FFFFFF',
                        },
                      ]}
                    >
                      <Folder size={14} strokeWidth={ICON_STROKE} color={theme.colors.secondary} />
                      <Text numberOfLines={1} style={[styles.chipText, { color: theme.colors.onSurfaceVariant }]}>
                        {folder.name}
                      </Text>
                      <TouchableOpacity
                        onPress={() => void removeFolder(folder.id)}
                        hitSlop={8}
                        accessibilityLabel={`Remove folder ${folder.name}`}
                      >
                        <Trash2 size={12} strokeWidth={ICON_STROKE} color={theme.colors.onSurfaceVariant} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {(target.contents || []).map((note) => (
                    <View
                      key={`n-${note.id}`}
                      style={[
                        styles.chip,
                        {
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(228,228,231,0.8)',
                          backgroundColor: isDark ? 'rgba(24,24,27,0.6)' : '#FFFFFF',
                        },
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() => openNote(note.id)}
                        style={styles.chipLink}
                        activeOpacity={0.8}
                      >
                        <FileText size={14} strokeWidth={ICON_STROKE} color={theme.colors.onSurfaceVariant} />
                        <Text numberOfLines={1} style={[styles.chipText, { color: theme.colors.onSurfaceVariant }]}>
                          {note.title}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => void removeNote(note.id)}
                        hitSlop={8}
                        accessibilityLabel={`Remove note ${note.title}`}
                      >
                        <Trash2 size={12} strokeWidth={ICON_STROKE} color={theme.colors.onSurfaceVariant} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <View
                  style={[
                    styles.empty,
                    {
                      marginTop: 14,
                      paddingVertical: 20,
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(228,228,231,0.9)',
                    },
                  ]}
                >
                  <Text style={[styles.emptyBody, { color: theme.colors.onSurfaceVariant }]}>
                    No materials linked yet. Add notes or folders from the exam hub to study against this
                    target.
                  </Text>
                </View>
              )}
            </View>

            <View
              style={[
                styles.panel,
                {
                  backgroundColor: isDark ? 'rgba(24,24,27,0.8)' : 'rgba(255,255,255,0.9)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)',
                },
              ]}
            >
              <View style={styles.testsHeadLeft}>
                <View style={[styles.testsIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                  <RotateCcw size={16} strokeWidth={ICON_STROKE} color={theme.colors.secondary} />
                </View>
                <Text style={[styles.testsTitle, { color: theme.colors.onSurface }]}>Revise</Text>
              </View>

              {reviseQueueTotal > 0 ? (
                <View style={{ gap: 8, marginTop: 14 }}>
                  {(reviseSummary?.items || [])
                    .filter((item) => (item.study_queue_count || 0) > 0)
                    .map((item) => (
                      <TouchableOpacity
                        key={item.content_id}
                        onPress={() => openCards(item.content_id)}
                        activeOpacity={0.85}
                        style={[
                          styles.reviseRow,
                          {
                            backgroundColor: isDark ? 'rgba(9,9,11,0.5)' : '#FFFFFF',
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)',
                          },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[styles.reviseTitle, { color: theme.colors.onSurface, flex: 1 }]}
                        >
                          {item.title}
                        </Text>
                        <Text style={[styles.reviseMeta, { color: isDark ? '#9BB8A6' : theme.colors.secondary }]}>
                          {item.study_queue_count} to revise
                        </Text>
                        <ArrowRight size={14} strokeWidth={ICON_STROKE} color={isDark ? '#9BB8A6' : theme.colors.secondary} />
                      </TouchableOpacity>
                    ))}
                </View>
              ) : (
                <View
                  style={[
                    styles.empty,
                    {
                      marginTop: 14,
                      paddingVertical: 20,
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(228,228,231,0.9)',
                    },
                  ]}
                >
                  <Text style={[styles.emptyBody, { color: theme.colors.onSurfaceVariant }]}>
                    {hasMaterials
                      ? 'No cards due right now. Generate flashcards on your materials, then revise here.'
                      : 'Link notes or folders as materials to revise from their study stacks.'}
                  </Text>
                </View>
              )}
            </View>

            <View
              style={[
                styles.panel,
                {
                  backgroundColor: isDark ? 'rgba(24,24,27,0.8)' : 'rgba(255,255,255,0.9)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)',
                },
              ]}
            >
              <View style={styles.testsHead}>
                <View style={styles.testsHeadLeft}>
                  <View style={[styles.testsIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                    <GraduationCap size={16} strokeWidth={ICON_STROKE} color={theme.colors.secondary} />
                  </View>
                  <Text style={[styles.testsTitle, { color: theme.colors.onSurface }]}>Practice</Text>
                </View>
                {sessions.length > 0 ? (
                  <TouchableOpacity
                    onPress={handleOpenGenerate}
                    disabled={starting}
                    style={[styles.newTestBtn, { backgroundColor: theme.colors.primary, opacity: starting ? 0.6 : 1 }]}
                    activeOpacity={0.85}
                  >
                    <Plus size={14} strokeWidth={ICON_STROKE} color={theme.colors.onPrimary} />
                    <Text style={[styles.newTestBtnText, { color: theme.colors.onPrimary }]}>Generate</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {sessions.length === 0 ? (
                <View
                  style={[
                    styles.empty,
                    { marginTop: 14, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(228,228,231,0.9)' },
                  ]}
                >
                  <ClipboardList size={28} strokeWidth={ICON_STROKE} color={theme.colors.onSurfaceVariant} />
                  <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>No practices yet</Text>
                  <Text style={[styles.emptyBody, { color: theme.colors.onSurfaceVariant }]}>
                    Generate a practice from your materials, or jump into a quick 10-question mixed MCQ.
                  </Text>
                  <View style={styles.emptyActions}>
                    <TouchableOpacity
                      onPress={handleOpenGenerate}
                      disabled={starting}
                      style={[styles.practiceBtn, { backgroundColor: theme.colors.primary, opacity: starting ? 0.7 : 1 }]}
                      activeOpacity={0.85}
                    >
                      <Plus size={14} strokeWidth={ICON_STROKE} color={theme.colors.onPrimary} />
                      <Text style={[styles.practiceBtnText, { color: theme.colors.onPrimary }]}>
                        Generate practice
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={startQuickPractice}
                      disabled={starting}
                      style={[
                        styles.practiceBtn,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E4E4E7',
                          opacity: starting ? 0.7 : 1,
                        },
                      ]}
                      activeOpacity={0.85}
                    >
                      {starting ? (
                        <ActivityIndicator color={theme.colors.onSurface} size="small" />
                      ) : (
                        <Sparkles size={14} strokeWidth={ICON_STROKE} color={theme.colors.onSurface} />
                      )}
                      <Text style={[styles.practiceBtnText, { color: theme.colors.onSurface }]}>Quick 10-Q</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={{ gap: 12, marginTop: 14 }}>
                  {sessions.map((item) => {
                    const meta = sessionStatusMeta(item.status);
                    const typeLabel = item.eval_type === 'qa' ? 'Q&A' : 'MCQ';
                    const when = formatWhen(item.completed_at || item.created_at);
                    const scoreLine =
                      item.status === 'completed' && item.score != null
                        ? `${Math.round(item.score)}%`
                        : `${item.question_count} questions`;
                    const opening = openingId === item.id;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => void openSession(item.id)}
                        disabled={opening}
                        activeOpacity={0.85}
                        style={[
                          styles.sessionCard,
                          {
                            backgroundColor: isDark ? 'rgba(9,9,11,0.5)' : '#FFFFFF',
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)',
                            opacity: opening ? 0.6 : 1,
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
                        <View style={[styles.sessionIcon, { backgroundColor: theme.colors.primaryContainer }]}>
                          {opening ? (
                            <ActivityIndicator color={theme.colors.secondary} />
                          ) : (
                            <ClipboardList size={20} strokeWidth={ICON_STROKE} color={theme.colors.secondary} />
                          )}
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={styles.sessionTitleRow}>
                            <Text style={[styles.sessionTitle, { color: theme.colors.onSurface }]}>
                              {typeLabel} · {item.question_count} questions
                            </Text>
                            <View
                              style={[
                                styles.badge,
                                { backgroundColor: isDark ? meta.darkBg : meta.bg },
                              ]}
                            >
                              <Text style={[styles.badgeText, { color: isDark ? meta.darkFg : meta.fg }]}>
                                {meta.label}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.sessionMeta, { color: theme.colors.onSurfaceVariant }]}>
                            {scoreLine}
                            {item.difficulty ? ` · ${item.difficulty}` : ''}
                          </Text>
                          {when ? (
                            <Text style={[styles.sessionWhen, { color: theme.colors.onSurfaceVariant }]}>{when}</Text>
                          ) : null}
                        </View>
                        <View style={styles.sessionCta}>
                          <Text style={[styles.sessionCtaText, { color: isDark ? '#9BB8A6' : theme.colors.secondary }]}>
                            {item.status === 'completed' ? 'View' : 'Resume'}
                          </Text>
                          <ArrowRight size={14} strokeWidth={ICON_STROKE} color={isDark ? '#9BB8A6' : theme.colors.secondary} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <ExamUploadModal
        open={uploadOpen}
        onClose={() => {
          if (!starting) setUploadOpen(false);
        }}
        pyqs={pyqs}
        onPyqsChange={(value) => {
          setPyqs(value);
          setPyqsSaved(false);
        }}
        onSavePyqs={savePyqs}
        savingPyqs={savingPyqs}
        pyqsSaved={pyqsSaved}
        onStartTest={startEval}
        starting={starting}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { flex: 1, padding: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, alignSelf: 'flex-start' },
  backText: { fontFamily: Fonts.ui.regular, fontSize: 14 },
  pageTitle: { fontFamily: Fonts.ui.bold, fontSize: 24, letterSpacing: -0.4 },
  pageSub: { marginTop: 4, fontFamily: Fonts.ui.regular, fontSize: 14, lineHeight: 20 },
  panel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  testsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  testsHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  testsIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testsTitle: { fontFamily: Fonts.ui.semiBold, fontSize: 18, letterSpacing: -0.3 },
  newTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newTestBtnText: { fontFamily: Fonts.ui.bold, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipLink: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, flexShrink: 1 },
  chipText: { fontFamily: Fonts.ui.regular, fontSize: 12, maxWidth: 180 },
  reviseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reviseTitle: { fontFamily: Fonts.ui.medium, fontSize: 14 },
  reviseMeta: { fontFamily: Fonts.ui.semiBold, fontSize: 12 },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyTitle: { marginTop: 12, fontFamily: Fonts.ui.semiBold, fontSize: 14 },
  emptyBody: { marginTop: 4, fontFamily: Fonts.ui.regular, fontSize: 14, textAlign: 'center' },
  emptyActions: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  practiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  practiceBtnText: { fontFamily: Fonts.ui.bold, fontSize: 14 },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  sessionTitle: { fontFamily: Fonts.ui.semiBold, fontSize: 14 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontFamily: Fonts.ui.medium, fontSize: 11 },
  sessionMeta: { marginTop: 4, fontFamily: Fonts.ui.regular, fontSize: 14 },
  sessionWhen: { marginTop: 4, fontFamily: Fonts.ui.regular, fontSize: 12, opacity: 0.8 },
  sessionCta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  sessionCtaText: { fontFamily: Fonts.ui.semiBold, fontSize: 12 },
});

export default ExamPrepTargetScreen;
