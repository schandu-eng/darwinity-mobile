import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Platform, TouchableOpacity, Alert, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSessionTracker } from '@/analytics/useSessionTracker';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import { useStudyPageDwell } from '@/features/concentration/useStudyPageDwell';
import { Text, Button } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EyeOff, FileText, Gamepad2, Layers, ListChecks, NotebookPen, Pencil, Podcast, Route, type LucideIcon } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useContent, useJobStatus } from '@/api/queries/content';
import { contentEndpoints } from '@/api/endpoints/content';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import type { ContentStackParamList, AppStackParamList } from '@/types/navigation';
import { PanelSkeleton } from '@/components/ui/skeleton';
import { PanelLoadError } from '@/components/ui/PanelLoadError';
import ErrorBanner from '@/components/ui/ErrorBanner';
import PhoneTabBar, { PHONE_TAB_BAR_CONTENT_HEIGHT, type PhoneTabItem } from '@/components/navigation/PhoneTabBar';
import {
  FLOATING_CHAT_FAB_MARGIN,
} from '@shared/floatingChatFab.js';
import { useAuthStore } from '@/store/memberAuthStore';
import { useFeedbackPromptStore } from '@/store/feedbackPromptStore';
import apiClient from '@/api/client';
import { getEditorBlocks } from '@/utils/notesMarkdown';
import NotesViewerWebView, { type NotesViewerWebViewRef } from '@/components/content/NotesViewerWebView';
import { StudyMaterialHeader } from '@/components/content/StudyMaterialHeader';
import FloatingChatButton from '@/components/content/FloatingChatButton';
import AssessmentsTab from '@/components/study-hub/QuizzesTab';
import CardDecksTab from '@/components/study-hub/CardDecksTab';
import DiagramTab from '@/components/study-hub/FlowchartTab';
import AudioLessonTab from '@/components/study-hub/PodcastTab';
import StudyGamesPanel from '@/components/study-hub/StudyGamesPanel';
import StudyGamesProGate from '@/components/study-hub/StudyGamesProGate';
import PodcastProGate from '@/components/study-hub/PodcastProGate';
import FlashcardsProGate from '@/components/study-hub/FlashcardsProGate';
import FeatureProTag from '@/components/ui/pro/FeatureProTag';
import { useStreamingNotes } from '@/hooks/useStreamingNotes';
import { isJobGenerating } from '@/utils/notesProgress';
import {
  FeatureNewTag,
  OnboardingTourProvider,
  TourAnchor,
  dismissFeatureNew,
  CARD_DECK_REEL_NEW_TAG_IDS,
  CARD_DECK_REEL_TOUR_ID,
  LEARNING_CONTENT_TOUR_ID,
  LEARNING_CONTENT_TOUR_STEPS,
  adaptLearningContentTourSteps,
  type TourStep,
} from '@/components/ui/feature-tour';
import { buildContentNotesSummary } from '@shared/summaryNotes.js';
import { useFlowchartGate } from '@/featureFlags/useFeatureGate';
import { BRAND_COLORS } from '@/config/brand';
import { toUserFacingError } from '@/utils/userFacingError';
import {
  useProFeatureAccess,
  STUDY_GAMES_LIMIT_TYPE,
  STUDY_GAMES_UPGRADE_MESSAGE,
  PODCAST_LIMIT_TYPE,
  PODCAST_UPGRADE_MESSAGE,
  FLASHCARDS_LIMIT_TYPE,
  FLASHCARDS_UPGRADE_MESSAGE,
} from '@/hooks/useProFeatureAccess';
import { showUpgradePaywall } from '@/utils/subscriptionErrorHandler';
import { usePodcastPlaybackOptional } from '@/features/podcast/PodcastPlaybackContext';

import { pointerEventsProp, pointerEventsStyle } from '@/theme/webCompat';
import { Fonts } from '@/config/fonts';

type ContentDetailRouteProp = RouteProp<ContentStackParamList, 'ContentDetail'>;
type ContentDetailNavigationProp = NativeStackNavigationProp<ContentStackParamList & AppStackParamList, 'ContentDetail'>;

type TabType = 'notes' | 'flashcards' | 'quiz' | 'podcast' | 'games';
type NotesPane = 'notes' | 'map';

const TAB_TOUR_STEP_ID: Partial<Record<TabType, string>> = {
  notes: 'notes',
  flashcards: 'flashcards',
  quiz: 'quizzes',
  podcast: 'podcast',
  games: 'games',
};

const TABS: Array<{
  id: TabType;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}> = [
  { id: 'notes', label: 'Notes', shortLabel: 'Notes', icon: NotebookPen },
  { id: 'quiz', label: 'Test yourself', shortLabel: 'Quiz', icon: ListChecks },
  { id: 'flashcards', label: 'Flashcards', shortLabel: 'Cards', icon: Layers },
  { id: 'podcast', label: 'Podcast', shortLabel: 'Audio', icon: Podcast },
  { id: 'games', label: 'Games', shortLabel: 'Games', icon: Gamepad2 },
];

const PodcastSessionTracker: React.FC<{ contentId: number }> = ({ contentId }) => {
  useSessionTracker(EVENTS.PODCAST_PLAY_STARTED, EVENTS.PODCAST_PLAY_ENDED, { content_id: contentId });
  return null;
};

const NotesMapSwitcher: React.FC<{
  pane: NotesPane;
  isDark: boolean;
  onChange: (pane: NotesPane) => void;
}> = ({ pane, isDark, onChange }) => (
  <View
    style={[
      notesMapStyles.row,
      {
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : BRAND_COLORS.paperDeep,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(26,47,35,0.12)',
      },
    ]}
  >
    {([
      { id: 'notes', label: 'Notes', Icon: NotebookPen, tourStepId: undefined as string | undefined },
      { id: 'map', label: 'Map', Icon: Route, tourStepId: 'flowchart' },
    ] as const).map((item) => {
      const active = pane === item.id;
      const button = (
        <TouchableOpacity
          onPress={() => onChange(item.id)}
          style={[
            notesMapStyles.btn,
            active && {
              backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#FFFFFF',
            },
          ]}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          accessibilityLabel={item.label === 'Map' ? 'Mind map' : item.label}
        >
          <item.Icon
            size={16}
            strokeWidth={ICON_STROKE}
            color={active ? (isDark ? '#E4E4E7' : BRAND_COLORS.ink) : (isDark ? '#71717A' : '#71717A')}
          />
          <Text
            style={[
              notesMapStyles.label,
              { color: active ? (isDark ? '#FAFAFA' : BRAND_COLORS.ink) : (isDark ? '#A1A1AA' : '#71717A') },
            ]}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      );
      if (!item.tourStepId) {
        return (
          <View key={item.id} style={notesMapStyles.anchor}>
            {button}
          </View>
        );
      }
      return (
        <TourAnchor key={item.id} stepId={item.tourStepId} style={notesMapStyles.anchor}>
          {button}
        </TourAnchor>
      );
    })}
  </View>
);

const MaterialDetailScreen: React.FC = () => {
  const navigation = useNavigation<ContentDetailNavigationProp>();
  const route = useRoute<ContentDetailRouteProp>();
  const { contentId, notesJobId, initialTab } = route.params;
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const queryClient = useQueryClient();
  const flowchartEnabled = useFlowchartGate();
  const { locked: proFeaturesLocked } = useProFeatureAccess();
  const podcastPlayback = usePodcastPlaybackOptional();

  const studyMaterialTourSteps = useMemo(
    () =>
      adaptLearningContentTourSteps(LEARNING_CONTENT_TOUR_STEPS as TourStep[], {
        isPhone: true,
        flowchartEnabled,
      }) as TourStep[],
    [flowchartEnabled],
  );

  const handleLearningTourStepChange = useCallback((step: TourStep) => {
    const webTab = typeof step.tab === 'string' ? step.tab : null;
    if (webTab === 'flowchart') {
      setActiveTab('notes');
      setNotesPane('map');
      setMapVisited(true);
      return;
    }
    const mobileTab: TabType | null =
      webTab === 'summary' ? 'notes'
        : webTab === 'quizzes' ? 'quiz'
          : webTab === 'flashcards' ? 'flashcards'
            : webTab === 'podcast' ? 'podcast'
              : webTab === 'games' ? 'games'
                : null;
    if (!mobileTab) return;
    if (mobileTab === 'notes') setNotesPane('notes');
    setActiveTab(mobileTab);
    setVisitedTabs((prev) => {
      if (prev.has(mobileTab)) return prev;
      const next = new Set(prev);
      next.add(mobileTab);
      return next;
    });
  }, []);

  const handleLearningTourEnd = useCallback(() => {
    setActiveTab('notes');
    setNotesPane('notes');
  }, []);

  const [activeTab, setActiveTab] = useState<TabType>(initialTab && TABS.some((t) => t.id === initialTab) ? initialTab : 'notes');
  const [notesPane, setNotesPane] = useState<NotesPane>('notes');
  const [mapVisited, setMapVisited] = useState(false);
  const [visitedTabs, setVisitedTabs] = useState<Set<TabType>>(() => {
    const first: TabType = initialTab && TABS.some((t) => t.id === initialTab) ? initialTab : 'notes';
    return new Set<TabType>(['notes', first]);
  });
  const [podcastDisplayed, setPodcastDisplayed] = useState(false);
  const [podcastHoldProcessing, setPodcastHoldProcessing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const notesViewerRef = useRef<NotesViewerWebViewRef>(null);
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const initializeFeedbackPrompt = useFeedbackPromptStore((s) => s.initialize);
  const contentPromptShown = useFeedbackPromptStore((s) => s.contentPromptShown);
  const contentViewerOpenedAt = useFeedbackPromptStore((s) => s.contentViewerOpenedAt);
  const markContentViewed = useFeedbackPromptStore((s) => s.markContentViewed);

  const {
    data: contentData,
    isLoading,
    error,
    refetch,
  } = useContent(contentId);

  const content = contentData?.data;
  const activeJobId = notesJobId ?? content?.active_job_id ?? null;

  const { data: jobStatusData } = useJobStatus(activeJobId);

  const jobStatus = jobStatusData?.data;
  const generating = isJobGenerating(jobStatus);
  const streamedNotes = useStreamingNotes(contentId, generating);

  useSessionTracker(EVENTS.CONTENT_VIEWER_OPENED, EVENTS.CONTENT_VIEWER_CLOSED, { content_id: contentId });
  const dwellPageType = activeTab === 'notes' && notesPane === 'map' ? 'flowchart' : activeTab;
  useStudyPageDwell({ contentId, pageType: dwellPageType, title: content?.title });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const active = document.activeElement as HTMLElement | null;
    if (active && typeof active.blur === 'function' && active !== document.body) {
      active.blur();
    }
  }, [activeTab, notesPane]);

  useFocusEffect(
    useCallback(() => {
      podcastPlayback?.setStudyFocused(true);
      analytics.track(EVENTS.NOTES_VIEW_STARTED, { content_id: contentId });
      const startTime = Date.now();
      return () => {
        podcastPlayback?.setStudyFocused(false);
        analytics.track(EVENTS.NOTES_VIEW_ENDED, {
          content_id: contentId,
          time_spent_seconds: Math.round((Date.now() - startTime) / 1000),
        });
      };
    }, [contentId, podcastPlayback])
  );

  const contentPromptShownRef = useRef(contentPromptShown);
  const contentViewerOpenedAtRef = useRef(contentViewerOpenedAt);
  useEffect(() => { contentPromptShownRef.current = contentPromptShown; }, [contentPromptShown]);
  useEffect(() => { contentViewerOpenedAtRef.current = contentViewerOpenedAt; }, [contentViewerOpenedAt]);

  useEffect(() => {
    if (!content?.id || isLoading) return;
    const init = async () => {
      await initializeFeedbackPrompt();
      if (contentPromptShownRef.current) return;
      if (contentViewerOpenedAtRef.current) return;
      await markContentViewed();
    };
    init().catch(() => { });
  }, [content?.id, isLoading, initializeFeedbackPrompt, markContentViewed]);

  useEffect(() => {
    if (!content?.id || isLoading || !user?.id) return;
    apiClient.post('/api/activity/record', { user_id: user.id }).catch(() => { });
  }, [content?.id, isLoading, user?.id]);

  const prevJobStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const status = jobStatus?.status;
    if (status === 'completed' && prevJobStatusRef.current && prevJobStatusRef.current !== 'completed') {
      refetch();
    }
    prevJobStatusRef.current = status;
  }, [jobStatus?.status, refetch]);

  const handleBackToHome = useCallback(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate('Home' as never, { screen: 'HomeFeed' } as never);
    } else {
      navigation.goBack();
    }
  }, [navigation]);

  const editorBlocks = useMemo(() => getEditorBlocks(content?.editor_blocks), [content?.editor_blocks]);
  const hasFinalNotes = useMemo(() => {
    if (!content) return false;
    const notesSummary = buildContentNotesSummary(content);
    return (
      (editorBlocks?.length ?? 0) > 0
      || (notesSummary?.detailed_notes?.length ?? 0) > 0
      || (content.topics?.length ?? 0) > 0
    );
  }, [content, editorBlocks]);

  const studyMaterialTourReady = hasFinalNotes && !generating;

  const [blocksPollCount, setBlocksPollCount] = useState(0);
  useEffect(() => {
    const status = jobStatus?.status;
    const haveBlocks = (editorBlocks?.length ?? 0) > 0;
    if (status !== 'completed' || haveBlocks) {
      if (blocksPollCount !== 0) setBlocksPollCount(0);
      return;
    }
    if (blocksPollCount >= 5) return;
    const timer = setTimeout(() => {
      refetch();
      setBlocksPollCount((c) => c + 1);
    }, 1500);
    return () => clearTimeout(timer);
  }, [jobStatus?.status, editorBlocks, refetch, blocksPollCount]);

  const handleRename = useCallback(() => {
    navigation.navigate('RenameNoteModal', { contentId, currentTitle: content?.title || '' });
  }, [navigation, contentId, content?.title]);

  const handleExportPDF = useCallback(() => {
    navigation.navigate('ExportModal', { contentId, type: 'pdf' });
  }, [navigation, contentId]);

  const handleEditNotes = useCallback(() => {
    navigation.navigate('NotesEditor', { contentId });
  }, [navigation, contentId]);

  const selectTab = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!initialTab || !TABS.some((t) => t.id === initialTab)) return;
    selectTab(initialTab);
  }, [initialTab, selectTab]);

  const selectNotesPane = useCallback((pane: NotesPane) => {
    setNotesPane(pane);
    if (pane === 'map') setMapVisited(true);
  }, []);

  useEffect(() => {
    if (flowchartEnabled && hasFinalNotes && !generating) {
      setMapVisited(true);
    }
  }, [flowchartEnabled, hasFinalNotes, generating]);

  useEffect(() => {
    if (!flowchartEnabled) setNotesPane('notes');
  }, [flowchartEnabled]);

  const exitStudyMode = useCallback(() => {
    setStudyMode(false);
  }, []);

  const handleAskAi = useCallback(() => {
    if (!content) return;
    navigation.navigate('Chat', { contentId: content.id });
  }, [content, navigation]);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    notesViewerRef.current?.reload();
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const retryNotesMutation = useMutation({
    mutationFn: () => {
      if (!user?.id) throw new Error('You need to be signed in to retry.');
      return contentEndpoints.retryNotes(contentId, user.id);
    },
    onSuccess: (data) => {
      navigation.setParams({ notesJobId: data.job_id });
      queryClient.invalidateQueries({ queryKey: ['content'] });
      refetch();
    },
    onError: (err: any) => {
      Alert.alert(
        'Retry failed',
        toUserFacingError(err, 'Could not restart notes generation.')
      );
    },
  });

  const handleRetryNotes = useCallback(() => {
    retryNotesMutation.mutate();
  }, [retryNotesMutation]);

  const notesFailed =
    !!content &&
    (jobStatus?.status === 'failed' ||
      jobStatus?.status === 'blocked' ||
      content.notes_status === 'failed');
  const notesStreaming = generating || (streamedNotes.length > 0 && !hasFinalNotes);
  const showNotesWebView =
    !!content &&
    !notesFailed &&
    (generating || hasFinalNotes || notesStreaming);

  const prevNotesRevisionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!showNotesWebView) return;
    const revision = JSON.stringify(editorBlocks ?? []);
    if (prevNotesRevisionRef.current !== null && prevNotesRevisionRef.current !== revision) {
      notesViewerRef.current?.reload();
    }
    prevNotesRevisionRef.current = revision;
  }, [editorBlocks, showNotesWebView]);

  const notesEmpty = useMemo(() => {
    if (showNotesWebView) return null;
    if (!content) return null;
    if (notesFailed) {
      const isRecording = content.content_type === 'AUDIO_RECORDING';
      return (
        <View style={styles.errorContainer}>
          <ErrorBanner
            message={jobStatus?.user_message || 'Failed to generate notes. Please try again.'}
          />
          {isRecording ? (
            <>
              <Text
                variant="bodyMedium"
                style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}
              >
                Your recording and its transcript are saved. You can generate the notes again.
              </Text>
              <Button
                mode="contained"
                onPress={handleRetryNotes}
                loading={retryNotesMutation.isPending}
                disabled={retryNotesMutation.isPending}
                style={styles.retryNotesButton}
              >
                Retry notes
              </Button>
            </>
          ) : null}
        </View>
      );
    }
    if (notesStreaming && streamedNotes.length === 0) {
      return (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      );
    }
    if (!hasFinalNotes && !notesStreaming) {
      return (
        <View style={styles.emptyContainer}>
          <FileText size={64} strokeWidth={ICON_STROKE} color={theme.colors.onSurfaceVariant} />
          <Text variant="titleMedium" style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
            No Notes Yet
          </Text>
          <Text variant="bodyMedium" style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
            Generate notes to get a summary of this content
          </Text>
        </View>
      );
    }
    return null;
  }, [
    showNotesWebView,
    content,
    notesFailed,
    notesStreaming,
    streamedNotes.length,
    hasFinalNotes,
    jobStatus?.user_message,
    theme.colors.onSurfaceVariant,
    theme.colors.onSurface,
    handleRetryNotes,
    retryNotesMutation.isPending,
  ]);

  const handleAskInChat = useCallback(
    (context: string | null) => {
      navigation.navigate('Chat', {
        contentId,
        selectedText: context || undefined,
      });
    },
    [navigation, contentId]
  );

  const renderStudyPanels = useCallback(() => {
    const hidden = (show: boolean) => [
      show ? styles.panelShown : styles.panelHidden,
      pointerEventsStyle(show ? 'auto' : 'none'),
    ];
    const hiddenA11y = (show: boolean) => ({
      pointerEvents: pointerEventsProp(show ? 'auto' : 'none'),
      accessibilityElementsHidden: !show,
      importantForAccessibility: (show ? 'auto' : 'no-hide-descendants') as 'auto' | 'no-hide-descendants',
      collapsable: false as const,
    });

    return (
      <View style={styles.panels}>
        {visitedTabs.has('notes') ? (
          <View
            style={[
              ...hidden(activeTab === 'notes' && notesPane === 'notes'),
              { backgroundColor: themeMode === 'dark' ? '#121214' : '#FFFFFF' },
            ]}
            {...hiddenA11y(activeTab === 'notes' && notesPane === 'notes')}
          >
            {showNotesWebView ? (
              <>
                <ScrollView
                  style={[styles.scrollView, { backgroundColor: themeMode === 'dark' ? '#121214' : '#FFFFFF' }]}
                  contentContainerStyle={styles.notesWebViewScroll}
                  scrollEnabled={false}
                  refreshControl={
                    studyMode ? undefined : (
                      <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={themeMode === 'dark' ? '#7A9E86' : '#1A2F23'}
                        colors={[themeMode === 'dark' ? '#7A9E86' : '#1A2F23']}
                        progressBackgroundColor={themeMode === 'dark' ? '#26262A' : '#FFFFFF'}
                      />
                    )
                  }
                >
                  <NotesViewerWebView
                    ref={notesViewerRef}
                    contentId={contentId}
                    visible={activeTab === 'notes' && notesPane === 'notes'}
                    style={styles.notesWebView}
                  />
                </ScrollView>
                {hasFinalNotes && !generating && !studyMode ? (
                  <TouchableOpacity
                    onPress={handleEditNotes}
                    style={styles.notesEditBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Edit notes"
                    activeOpacity={0.7}
                  >
                    <Pencil
                      size={18}
                      strokeWidth={ICON_STROKE}
                      color={themeMode === 'dark' ? '#D4D4D8' : '#3F3F46'}
                    />
                  </TouchableOpacity>
                ) : null}
              </>
            ) : (
              <View
                style={[
                  styles.scrollView,
                  styles.scrollContent,
                  styles.notesScrollContent,
                  notesEmpty ? styles.scrollContentSkeleton : null,
                  { backgroundColor: themeMode === 'dark' ? '#121214' : '#FFFFFF' },
                ]}
              >
                {notesEmpty}
              </View>
            )}
          </View>
        ) : null}
        {visitedTabs.has('quiz') ? (
          <View style={hidden(activeTab === 'quiz')} {...hiddenA11y(activeTab === 'quiz')}>
            <AssessmentsTab contentId={contentId} embedded onAskInChat={handleAskInChat} />
          </View>
        ) : null}
        {visitedTabs.has('flashcards') ? (
          <View style={hidden(activeTab === 'flashcards')} {...hiddenA11y(activeTab === 'flashcards')}>
            <FlashcardsProGate>
              <CardDecksTab contentId={contentId} />
            </FlashcardsProGate>
          </View>
        ) : null}
        {mapVisited && flowchartEnabled ? (
          <View
            style={hidden(activeTab === 'notes' && notesPane === 'map')}
            {...hiddenA11y(activeTab === 'notes' && notesPane === 'map')}
          >
            <DiagramTab contentId={contentId} onNavigateToTab={() => selectNotesPane('notes')} />
          </View>
        ) : null}
        {visitedTabs.has('podcast') ? (
          <View style={hidden(activeTab === 'podcast')} {...hiddenA11y(activeTab === 'podcast')}>
            <PodcastProGate>
              {podcastDisplayed ? <PodcastSessionTracker contentId={contentId} /> : null}
              <AudioLessonTab
                contentId={contentId}
                visible={activeTab === 'podcast'}
                onPodcastDisplayedChange={setPodcastDisplayed}
                holdProcessing={podcastHoldProcessing}
                onHoldProcessingChange={setPodcastHoldProcessing}
              />
            </PodcastProGate>
          </View>
        ) : null}
        {visitedTabs.has('games') ? (
          <View style={hidden(activeTab === 'games')} {...hiddenA11y(activeTab === 'games')}>
            <StudyGamesProGate>
              <StudyGamesPanel
                contentId={contentId}
                onNavigateToTab={(tab) => selectTab(tab)}
              />
            </StudyGamesProGate>
          </View>
        ) : null}
      </View>
    );
  }, [
    activeTab,
    notesPane,
    visitedTabs,
    mapVisited,
    studyMode,
    insets.bottom,
    insets.top,
    refreshing,
    handleRefresh,
    themeMode,
    showNotesWebView,
    notesEmpty,
    hasFinalNotes,
    generating,
    handleEditNotes,
    contentId,
    handleAskInChat,
    flowchartEnabled,
    selectTab,
    selectNotesPane,
    podcastDisplayed,
    podcastHoldProcessing,
    podcastPlayback,
  ]);

  const renderContentSkeleton = useMemo(() => {
    return <PanelSkeleton label="Loading your study space" />;
  }, []);

  const renderBottomTabs = useCallback((disabled: boolean = false) => {
    const isProLockedTab = (tabId: string) =>
      proFeaturesLocked && (tabId === 'games' || tabId === 'podcast' || tabId === 'flashcards' || tabId === 'quiz');
    const items: PhoneTabItem[] = TABS.map((tab) => ({
      id: tab.id,
      label: isProLockedTab(tab.id) ? `${tab.label}, Pro feature, locked` : tab.label,
      shortLabel: tab.shortLabel,
      icon: tab.icon,
      active: activeTab === tab.id,
      disabled,
      locked: isProLockedTab(tab.id),
      tourStepId: TAB_TOUR_STEP_ID[tab.id],
      accessory: isProLockedTab(tab.id) ? (
        <FeatureProTag />
      ) : tab.id === 'flashcards' ? (
        <FeatureNewTag
          featureId={CARD_DECK_REEL_NEW_TAG_IDS.NOTES_TAB}
          tourId={CARD_DECK_REEL_TOUR_ID}
          variant="icon"
        />
      ) : null,
      onPress: () => {
        if (disabled || !content) return;
        if (tab.id === 'games' && isProLockedTab('games')) {
          showUpgradePaywall(STUDY_GAMES_UPGRADE_MESSAGE, STUDY_GAMES_LIMIT_TYPE);
          return;
        }
        if (tab.id === 'podcast' && isProLockedTab('podcast')) {
          showUpgradePaywall(PODCAST_UPGRADE_MESSAGE, PODCAST_LIMIT_TYPE);
          return;
        }
        if (tab.id === 'flashcards' && isProLockedTab('flashcards')) {
          showUpgradePaywall(FLASHCARDS_UPGRADE_MESSAGE, FLASHCARDS_LIMIT_TYPE);
          return;
        }
        if (tab.id === 'flashcards') {
          void dismissFeatureNew(CARD_DECK_REEL_NEW_TAG_IDS.NOTES_TAB);
        }
        selectTab(tab.id);
      },
    }));

    return (
      <PhoneTabBar items={items} />
    );
  }, [activeTab, content, selectTab, proFeaturesLocked]);

  if (isLoading) {
    const paper = themeMode === 'dark' ? '#09090B' : BRAND_COLORS.paper;
    return (
      <View style={[styles.container, { backgroundColor: paper }]}>
        <StudyMaterialHeader
          title="Notes"
          onBack={handleBackToHome}
        />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContentSkeleton}
          showsVerticalScrollIndicator={false}
        >
          {renderContentSkeleton}
        </ScrollView>
        {renderBottomTabs(true)}
      </View>
    );
  }

  if (error || !content) {
    const paper = themeMode === 'dark' ? '#09090B' : BRAND_COLORS.paper;
    const notFound = contentData?.message === 'Content not found';
    return (
      <View style={[styles.container, { backgroundColor: paper }]}>
        <StudyMaterialHeader
          title="Notes"
          onBack={handleBackToHome}
        />
        <PanelLoadError
          fill
          title={notFound ? 'Content not found' : "Couldn't load this note"}
          description={
            notFound
              ? "It may have been removed, or you don't have access."
              : toUserFacingError(contentData?.message)
          }
          onRetry={notFound ? undefined : () => refetch()}
        />
      </View>
    );
  }

  const paper = themeMode === 'dark' ? '#09090B' : BRAND_COLORS.paper;
  const showAskAi = (activeTab === 'notes' && notesPane === 'notes') || activeTab === 'quiz';
  const showNotesMapSwitch = activeTab === 'notes' && flowchartEnabled && !studyMode;

  return (
    <OnboardingTourProvider
      tourId={LEARNING_CONTENT_TOUR_ID}
      steps={studyMaterialTourSteps}
      autoStart={studyMaterialTourReady}
      autoStartDelay={280}
      onStepChange={handleLearningTourStepChange}
      onComplete={handleLearningTourEnd}
      onSkip={handleLearningTourEnd}
    >
    <View style={[styles.container, { backgroundColor: paper }]}>
      <StatusBar
        barStyle={themeMode === 'dark' ? 'light-content' : 'dark-content'}
        hidden={studyMode && Platform.OS === 'ios' ? false : undefined}
      />
      {!studyMode ? (
        <>
          <StudyMaterialHeader
            title={content?.title}
            onBack={handleBackToHome}
            onDownload={activeTab === 'notes' && notesPane === 'notes' ? handleExportPDF : undefined}
            onTitlePress={handleRename}
          />
          {showNotesMapSwitch ? (
            <NotesMapSwitcher
              pane={notesPane}
              isDark={themeMode === 'dark'}
              onChange={selectNotesPane}
            />
          ) : null}
        </>
      ) : null}
      {renderStudyPanels()}
      {!studyMode ? renderBottomTabs(false) : null}
      {showAskAi && !studyMode && !proFeaturesLocked ? (
        <FloatingChatButton
          onPress={handleAskAi}
          bottomInset={PHONE_TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 8) + FLOATING_CHAT_FAB_MARGIN}
        />
      ) : null}
      {studyMode ? (
        <TouchableOpacity
          style={[
            styles.studyExitButton,
            {
              bottom: Math.max(insets.bottom, 12) + 8,
              backgroundColor: themeMode === 'dark' ? 'rgba(38,38,42,0.92)' : 'rgba(255,255,255,0.94)',
              borderColor: theme.colors.outlineVariant,
            },
          ]}
          onPress={exitStudyMode}
          activeOpacity={0.8}
          accessibilityLabel="Exit study mode"
        >
          <EyeOff size={18} strokeWidth={ICON_STROKE} color={theme.colors.onSurface} />
          <Text style={[styles.studyExitText, { color: theme.colors.onSurface }]}>Exit study</Text>
        </TouchableOpacity>
      ) : null}
    </View>
    </OnboardingTourProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'visible',
  },
  scrollView: {
    flex: 1,
  },
  panels: {
    flex: 1,
  },
  panelShown: {
    flex: 1,
  },
  panelHidden: {
    height: 0,
    overflow: 'hidden',
    opacity: 0,
  },
  scrollContent: {
    paddingHorizontal: 15,
    paddingTop: 0,
    paddingBottom: 100,
  },
  scrollContentSkeleton: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  contentWrapper: {
    minHeight: 200,
  },
  notesScrollContent: {
    paddingHorizontal: 13,
    paddingTop: 20,
    paddingBottom: 32,
  },
  notesScrollContentWithEdit: {
    paddingRight: 48,
  },
  notesEditBtn: {
    position: 'absolute',
    top: 12,
    right: 6,
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  notesWebViewScroll: {
    flexGrow: 1,
  },
  notesWebView: {
    flex: 1,
    minHeight: 400,
  },
  notesContainer: {
    gap: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    gap: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: Fonts.ui.semiBold,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
    gap: 12,
  },
  retryNotesButton: {
    marginTop: 4,
    minWidth: 180,
  },
  bottomTabs: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  tabButtonFill: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  tabIconWrap: {
    position: 'relative',
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  headerBackButton: {
    padding: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  askAiButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  studyExitButton: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  studyExitText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
  },
});

const notesMapStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 4,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  anchor: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    justifyContent: 'center',
  },
  btn: {
    width: '100%',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  label: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
});

export default MaterialDetailScreen;
