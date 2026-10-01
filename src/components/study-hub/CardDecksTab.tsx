import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
} from 'react-native';
import { Text, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '@/store';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useContent } from '@/api/queries/content';
import { contentService } from '@/services/contentService';
import {
  useCardDeckV2,
  useCardDecksListV2,
  useCardDeckV2JobStatus,
  useGenerateCardDecksV2,
  invalidateCardDeckV2,
} from '@/api/queries/cardDecksV2';
import { cardDeckV2Service } from '@/services/cardDeckV2Service';
import { useQueryClient } from '@tanstack/react-query';
import type { FlashcardV2 } from '@/api/schemas/cardDecksV2';
import StudyGenerationProcessingScreen from './StudyGenerationProcessingScreen';
import { PanelSkeleton } from '@/components/ui/skeleton';
import CardDeckGenerateScreen from './card-decks/CardDeckGenerateScreen';
import CardDeckHome from './card-decks/CardDeckHome';
import CardDeckSession from './card-decks/CardDeckSession';
import CardDeckQuickReview from './card-decks/CardDeckQuickReview';
import {
  buildCardDeckFilterLabel,
  getDeckIconIndex,
  getTopicFilterableTopics,
  MAX_CARD_DECK_DECKS_PER_CONTENT,
  suggestUntitledDeckTitle,
  validateDeckTitle,
} from './card-decks/cardDeckUtils';
import { ArrowRight, NotebookPen, Pencil, Plus, Sparkles, Star, Trash2, Upload } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { EmptyDeckPreview } from './EmptyDeckPreview';
import { StudyPillButton } from './StudyPillButton';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { PanelLoadError } from '@/components/ui/PanelLoadError';
import CardDeckImportPanel from './card-decks/CardDeckImportPanel';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import {
  STUDY_BORDER,
  STUDY_INK,
  STUDY_PAPER,
  STUDY_PAPER_DARK,
  STUDY_ZINC_500,
  studySubStyle,
  studyTitleStyle,
} from './studyPanelTokens';

const DECK_SET_ICONS = [
  'layers-triple-outline',
  'book-open-page-variant-outline',
  'brain',
  'lightbulb-outline',
  'school-outline',
  'notebook-edit-outline',
] as const;

type ViewMode = 'collection' | 'deck' | 'study' | 'quick_review' | 'generate' | 'generate_more' | 'import';

interface CardDecksTabProps {
  contentId: number;
  recreateHandlerRef?: React.MutableRefObject<(() => void) | null>;
  onFlashcardsDisplayedChange?: (displayed: boolean) => void;
}

function normalizeTopicIds(selectedTopics: number[] | null, chapterIds: number[]): number[] | null {
  if (selectedTopics === null) return null;
  if (selectedTopics.length === 0) return null;
  const allowed = new Set(chapterIds);
  const filtered = selectedTopics.filter((id) => allowed.has(id));
  return filtered.length > 0 ? filtered : null;
}

function nextDefaultDeckTitle(sets: Array<{ title?: string | null }>): string {
  const used = new Set(
    sets.map((set) => (set.title || '').trim().toLowerCase()).filter(Boolean)
  );
  let n = sets.length + 1;
  let title = `Flashcard set ${n}`;
  while (used.has(title.toLowerCase())) {
    n += 1;
    title = `Flashcard set ${n}`;
  }
  return title;
}

function formatWhen(iso?: string | null) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

const CardDecksTab: React.FC<CardDecksTabProps> = ({
  contentId,
  recreateHandlerRef,
  onFlashcardsDisplayedChange,
}) => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const { data: contentData } = useContent(contentId);
  const content = contentData?.data;

  const userIdRaw = user?.id;
  const userId = userIdRaw != null && Number.isFinite(Number(userIdRaw)) ? Number(userIdRaw) : null;
  const { data: decksList, isLoading: setsLoading, isError: setsError, error: setsErrorObj, refetch: refetchSets, isFetching: setsFetching } = useCardDecksListV2(
    contentId,
    userId
  );
  const deckSets = decksList?.items || [];
  const starredSummary = decksList?.starred || { total_count: 0, study_queue_count: 0 };

  const [viewMode, setViewMode] = useState<ViewMode>('collection');
  const [selectedDeckId, setSelectedDeckId] = useState<number | null>(null);
  const [isStarredCollection, setIsStarredCollection] = useState(false);
  const [starredStudyQueueCount, setStarredStudyQueueCount] = useState<number | null>(null);
  const [flashcards, setFlashcards] = useState<FlashcardV2[] | null>(null);
  const [deckTitle, setDeckTitle] = useState<string | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<number[] | null>(null);
  const [cardCount, setCardCount] = useState(20);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [srsFilters, setSrsFilters] = useState({ topicIds: [] as number[], starredOnly: false });
  const [quickReviewFilters] = useState({
    topicIds: [] as number[],
    starredOnly: false,
    shuffle: false,
  });
  const [creatingBlankDeck, setCreatingBlankDeck] = useState(false);
  const [importingDeck, setImportingDeck] = useState(false);
  const [renamingDeckId, setRenamingDeckId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deletingDeckId, setDeletingDeckId] = useState<number | null>(null);

  const { data: deckPayload, isLoading: deckLoading, refetch: refetchDeck } = useCardDeckV2(
    contentId,
    userId,
    selectedDeckId
  );

  const generateMutation = useGenerateCardDecksV2();
  const { data: jobStatusData } = useCardDeckV2JobStatus(generationJobId);
  const jobStatus = jobStatusData?.data;
  const jobMissing = Boolean(
    generationJobId &&
      jobStatusData &&
      jobStatusData.success === false &&
      jobStatusData.message === 'Job not found'
  );

  const chapters = useMemo(() => content?.chapters || [], [content?.chapters]);
  const contentType = content?.content_type || 'PDF';

  const topics = useMemo(
    () =>
      chapters
        .filter((c) => c?.id != null)
        .map((c) => ({ id: c.id!, title: c.title, order: c.order })),
    [chapters]
  );

  const chapterIds = useMemo(
    () => chapters.map((c) => c.id).filter((id): id is number => id != null),
    [chapters]
  );

  useEffect(() => {
    if (!deckPayload || selectedDeckId == null || isStarredCollection) return;
    const cards = deckPayload.flashcards || [];
    setFlashcards(cards.length > 0 ? cards : []);
    setDeckTitle(deckPayload.title || null);
  }, [deckPayload, selectedDeckId, isStarredCollection]);

  const studyQueueCount = useMemo(() => {
    if (isStarredCollection) {
      return starredStudyQueueCount != null && starredStudyQueueCount > 0
        ? starredStudyQueueCount
        : null;
    }
    const count = deckPayload?.study_queue_count;
    if (count == null || count <= 0) return null;
    return count;
  }, [isStarredCollection, starredStudyQueueCount, deckPayload?.study_queue_count]);

  const checkForPendingJob = useCallback(async () => {
    if (!user?.id || !contentId || generationJobId) return;
    try {
      const result = await contentService.getUserJobs(user.id, 'card_deck_generation', contentId);
      if (result.success && result.data) {
        const pendingJob = result.data.find((job) => {
          if (job.status !== 'pending' && job.status !== 'processing') return false;
          if (!job.created_at) return true;
          const ageMs = Date.now() - new Date(job.created_at).getTime();
          return Number.isFinite(ageMs) && ageMs < 10 * 60 * 1000;
        });
        if (pendingJob?.job_id) {
          setGenerationJobId(pendingJob.job_id);
          setIsGenerating(true);
        }
      }
    } catch {
      
    }
  }, [user?.id, contentId, generationJobId]);

  useEffect(() => {
    checkForPendingJob();
  }, [checkForPendingJob]);

  const finishGenerating = useCallback(
    async (opts?: { failed?: boolean; message?: string }) => {
      setGenerationJobId(null);
      setIsGenerating(false);
      generateMutation.reset();
      if (opts?.failed) {
        setError(opts.message || 'Flashcard generation failed');
        setViewMode('collection');
        await refetchSets();
        return;
      }
      const refreshed = await refetchSets();
      const items = refreshed.data?.items || [];
      if (items.length > 0) {
        const newest = items[0];
        setSelectedDeckId(newest.deck_id);
        setViewMode('deck');
      } else {
        setViewMode('collection');
      }
    },
    [generateMutation, refetchSets]
  );

  const finishGeneratingRef = useRef(finishGenerating);
  finishGeneratingRef.current = finishGenerating;
  const handledJobRef = useRef<string | null>(null);

  useEffect(() => {
    const key = jobMissing
      ? `missing:${generationJobId}`
      : jobStatus?.status
        ? `${jobStatus.status}:${generationJobId}`
        : null;
    if (!key || handledJobRef.current === key) return;
    if (jobStatus?.status === 'completed' || jobMissing) {
      handledJobRef.current = key;
      void finishGeneratingRef.current();
    } else if (jobStatus?.status === 'failed' || jobStatus?.status === 'blocked') {
      handledJobRef.current = key;
      void finishGeneratingRef.current({
        failed: true,
        message: jobStatus.user_message || 'Flashcard generation failed',
      });
    } else if (jobStatus?.status === 'processing' || jobStatus?.status === 'pending') {
      setIsGenerating(true);
    }
  }, [jobStatus?.status, jobStatus?.user_message, jobMissing, generationJobId]);

  useEffect(() => {
    if (!isGenerating && !generationJobId) return undefined;
    const timeout = setTimeout(() => {
      void finishGeneratingRef.current({
        failed: true,
        message: 'Flashcard generation timed out. Please try again.',
      });
    }, 10 * 60 * 1000);
    return () => clearTimeout(timeout);
  }, [isGenerating, generationJobId]);

  const handleGenerate = useCallback(
    async (
      options: {
        regenerate?: boolean;
        append?: boolean;
        createNew?: boolean;
        deckId?: number | null;
      } = {}
    ) => {
      if (!user?.id) {
        setError('User not found. Please login again.');
        return;
      }
      if (options.createNew && deckSets.length >= MAX_CARD_DECK_DECKS_PER_CONTENT) {
        setError(
          `Maximum of ${MAX_CARD_DECK_DECKS_PER_CONTENT} flashcard sets per note. Delete a set to create another.`
        );
        return;
      }
      setError('');
      setIsGenerating(true);
      handledJobRef.current = null;
      try {
        const result = await generateMutation.mutateAsync({
          contentId,
          userId: user.id,
          chapterIds: normalizeTopicIds(selectedTopics, chapterIds),
          regenerate: options.regenerate ?? false,
          append: options.append ?? false,
          createNew: options.createNew ?? false,
          deckId: options.createNew ? null : (options.deckId ?? selectedDeckId),
          title: options.createNew ? nextDefaultDeckTitle(deckSets) : undefined,
          cardCount,
          specialInstructions,
        });
        if (!result.success) {
          setIsGenerating(false);
          setError(result.message || 'Failed to generate flashcards');
          return;
        }
        if (result.data?.job_id) {
          setGenerationJobId(result.data.job_id);
        } else if (result.data?.status === 'completed') {
          await finishGenerating();
        } else {
          await finishGenerating({
            failed: true,
            message: result.data?.message || 'Failed to generate flashcards',
          });
        }
      } catch (err: any) {
        setIsGenerating(false);
        setError(err.message || 'Failed to generate flashcards');
      }
    },
    [
      user?.id,
      contentId,
      selectedTopics,
      chapterIds,
      cardCount,
      specialInstructions,
      generateMutation,
      selectedDeckId,
      refetchSets,
      deckSets,
      finishGenerating,
    ]
  );

  const atDeckLimit = deckSets.length >= MAX_CARD_DECK_DECKS_PER_CONTENT;
  const hasNotes = (content?.topics?.length ?? 0) > 0 || (content?.chapters?.length ?? 0) > 0;
  const paper = themeMode === 'dark' ? STUDY_PAPER_DARK : STUDY_PAPER;

  const handleQuickGenerate = useCallback(() => {
    void handleGenerate({ createNew: true, regenerate: false, append: false });
  }, [handleGenerate]);

  const handleRecreate = useCallback(() => {
    if (deckSets.length >= MAX_CARD_DECK_DECKS_PER_CONTENT) {
      setError(
        `Maximum of ${MAX_CARD_DECK_DECKS_PER_CONTENT} flashcard sets per note. Delete a set to create another.`
      );
      return;
    }
    setFlashcards(null);
    setSelectedDeckId(null);
    setViewMode('generate');
  }, [deckSets.length]);

  const guardDeckLimit = useCallback(() => {
    if (deckSets.length >= MAX_CARD_DECK_DECKS_PER_CONTENT) {
      setError(
        `Maximum of ${MAX_CARD_DECK_DECKS_PER_CONTENT} flashcard sets per note. Delete a set to create another.`
      );
      return true;
    }
    return false;
  }, [deckSets.length]);

  const nextScratchTitle = useCallback(
    () => suggestUntitledDeckTitle(deckSets, 'Flashcards'),
    [deckSets]
  );

  const handleOpenImport = useCallback(() => {
    if (guardDeckLimit()) return;
    setSelectedDeckId(null);
    setViewMode('import');
  }, [guardDeckLimit]);

  const handleCreateBlankDeck = useCallback(async () => {
    if (!userId) {
      setError('User not found. Please login again.');
      return;
    }
    if (guardDeckLimit()) return;
    const titleError = validateDeckTitle(nextScratchTitle(), deckSets);
    const title = titleError ? suggestUntitledDeckTitle(deckSets, 'Untitled set') : nextScratchTitle();
    setCreatingBlankDeck(true);
    setError('');
    let createdDeckId: number | null = null;
    try {
      const result = await cardDeckV2Service.createDeck(contentId, userId, title);
      if (!result.success || result.data?.deck_id == null) {
        throw new Error(result.message || 'Could not create a blank set');
      }
      createdDeckId = result.data.deck_id;
      analytics.track(EVENTS.CARD_DECK_DECK_CREATED, {
        content_id: contentId,
        deck_id: createdDeckId,
        source: 'blank',
      });
      await refetchSets();
      setFlashcards(result.data.flashcards || []);
      setDeckTitle(result.data.title || title);
      setSelectedDeckId(createdDeckId);
      setIsStarredCollection(false);
      setViewMode('deck');
    } catch (err: any) {
      if (createdDeckId) {
        await cardDeckV2Service.deleteDeck(contentId, createdDeckId, userId);
        await refetchSets();
      }
      setError(err.message || 'Could not create a blank set. Please try again.');
    } finally {
      setCreatingBlankDeck(false);
    }
  }, [userId, guardDeckLimit, nextScratchTitle, deckSets, contentId, refetchSets]);

  const handleImportCards = useCallback(
    async (cards: Array<{ front: string; back: string }>) => {
      if (!userId || cards.length === 0) return;
      if (guardDeckLimit()) return;
      const title = nextScratchTitle();
      setImportingDeck(true);
      setError('');
      let createdDeckId: number | null = null;
      try {
        const created = await cardDeckV2Service.createDeck(contentId, userId, title);
        createdDeckId = created.data?.deck_id ?? null;
        if (!created.success || createdDeckId == null) {
          throw new Error(created.message || 'Could not create set');
        }
        const payload = cards.map((c) => ({
          front: c.front,
          back: c.back,
          hint: '',
          topic_id: null as number | null,
        }));
        const saved = await cardDeckV2Service.saveDeck(contentId, userId, payload, createdDeckId);
        if (!saved.success) throw new Error(saved.message || 'Could not import cards');
        analytics.track(EVENTS.CARD_DECK_DECK_CREATED, {
          content_id: contentId,
          deck_id: createdDeckId,
          source: 'import',
        });
        analytics.track(EVENTS.CARD_DECK_IMPORT_COMPLETED, {
          content_id: contentId,
          deck_id: createdDeckId,
          card_count: payload.length,
        });
        await refetchSets();
        setFlashcards(saved.data?.flashcards ?? []);
        setDeckTitle(saved.data?.title || title);
        setSelectedDeckId(createdDeckId);
        setIsStarredCollection(false);
        setViewMode('deck');
      } catch (err: any) {
        if (createdDeckId) {
          await cardDeckV2Service.deleteDeck(contentId, createdDeckId, userId);
          await refetchSets();
        }
        setError(err.message || 'Could not import flashcards. Please try again.');
      } finally {
        setImportingDeck(false);
      }
    },
    [userId, guardDeckLimit, nextScratchTitle, contentId, refetchSets]
  );

  const saveRenameSet = useCallback(
    async (deckId: number) => {
      if (!userId) return;
      const next = renameDraft.trim();
      const titleError = validateDeckTitle(next, deckSets, deckId);
      if (titleError) {
        setError(titleError);
        return;
      }
      setRenameSaving(true);
      const result = await cardDeckV2Service.renameDeck(contentId, deckId, userId, next);
      setRenameSaving(false);
      if (!result.success) {
        setError(result.message || 'Could not rename set');
        return;
      }
      setRenamingDeckId(null);
      setRenameDraft('');
      await refetchSets();
    },
    [userId, renameDraft, deckSets, contentId, refetchSets]
  );

  useEffect(() => {
    if (recreateHandlerRef) {
      recreateHandlerRef.current = handleRecreate;
    }
  }, [handleRecreate, recreateHandlerRef]);

  const handleToggleStar = useCallback(
    async (cardId: number) => {
      if (!user?.id) return;
      const current = (flashcards || []).find((c) => c.id === cardId);
      const previous = !!current?.is_starred;
      const optimistic = !previous;
      setFlashcards((prev) =>
        prev ? prev.map((c) => (c.id === cardId ? { ...c, is_starred: optimistic } : c)) : prev
      );
      const result = await cardDeckV2Service.toggleStar(
        contentId,
        cardId,
        user.id,
        selectedDeckId
      );
      if (!result.success || !result.data) {
        setFlashcards((prev) =>
          prev ? prev.map((c) => (c.id === cardId ? { ...c, is_starred: previous } : c)) : prev
        );
        return;
      }
      setFlashcards((prev) =>
        prev ? prev.map((c) => (c.id === cardId ? { ...c, is_starred: result.data!.is_starred } : c)) : prev
      );
    },
    [contentId, user?.id, selectedDeckId, flashcards]
  );

  const refreshDeck = useCallback(async () => {
    if (!userId) return;
    if (isStarredCollection) {
      const result = await cardDeckV2Service.getStarred(contentId, userId);
      if (result.success && result.data) {
        const cards = result.data.flashcards || [];
        setFlashcards(cards);
        setStarredStudyQueueCount(result.data.study_queue_count ?? cards.length);
      }
      invalidateCardDeckV2(queryClient, contentId, userId);
      return;
    }
    if (selectedDeckId == null) return;
    const { data } = await refetchDeck();
    if (data) {
      const cards = data.flashcards || [];
      setFlashcards(cards.length > 0 ? cards : []);
      setDeckTitle(data.title || null);
    }
    invalidateCardDeckV2(queryClient, contentId, userId);
  }, [
    userId,
    isStarredCollection,
    contentId,
    selectedDeckId,
    refetchDeck,
    queryClient,
  ]);

  const openDeck = useCallback((deckId: number) => {
    setIsStarredCollection(false);
    setStarredStudyQueueCount(null);
    setSelectedDeckId(deckId);
    setViewMode('deck');
  }, []);

  const openStarredSet = useCallback(async () => {
    if (!userId) return;
    setSelectedDeckId(null);
    setIsStarredCollection(true);
    const result = await cardDeckV2Service.getStarred(contentId, userId);
    if (!result.success || !result.data) {
      setError(result.message || 'Could not open starred cards');
      setIsStarredCollection(false);
      return;
    }
    const cards = result.data.flashcards || [];
    setFlashcards(cards);
    setDeckTitle('Starred');
    setStarredStudyQueueCount(result.data.study_queue_count ?? cards.length);
    setViewMode('deck');
  }, [userId, contentId]);

  const goToCollection = useCallback(() => {
    setSelectedDeckId(null);
    setIsStarredCollection(false);
    setStarredStudyQueueCount(null);
    setFlashcards(null);
    setDeckTitle(null);
    setViewMode('collection');
    refetchSets();
  }, [refetchSets]);

  const handleDeleteSet = useCallback((deckId: number) => {
    setDeleteTarget(deckId);
  }, []);

  const confirmDeleteSet = useCallback(async () => {
    if (!userId || deleteTarget == null) return;
    setDeletingDeckId(deleteTarget);
    const result = await cardDeckV2Service.deleteDeck(contentId, deleteTarget, userId);
    setDeletingDeckId(null);
    setDeleteTarget(null);
    if (!result.success) {
      setError(result.message || 'Could not delete set');
      return;
    }
    if (selectedDeckId === deleteTarget) {
      goToCollection();
    } else {
      refetchSets();
    }
  }, [userId, deleteTarget, contentId, selectedDeckId, goToCollection, refetchSets]);

  const srsFilterLabel = useMemo(
    () =>
      buildCardDeckFilterLabel({
        starredOnly: srsFilters.starredOnly,
        topicIds: srsFilters.topicIds,
        topics: getTopicFilterableTopics(topics, flashcards || []),
      }),
    [srsFilters, topics, flashcards]
  );

  const generateScreenProps = {
    chapters,
    selectedTopics,
    onSelectedTopicsChange: setSelectedTopics,
    contentType,
    cardCount,
    onCardCountChange: setCardCount,
    specialInstructions,
    onSpecialInstructionsChange: setSpecialInstructions,
    disabled: isGenerating,
  };

  const showDeckHome = Boolean(flashcards && flashcards.length > 0 && viewMode === 'deck');

  useEffect(() => {
    onFlashcardsDisplayedChange?.(showDeckHome);
  }, [showDeckHome, onFlashcardsDisplayedChange]);

  if (isGenerating || generateMutation.isPending || generationJobId) {
    return (
      <StudyGenerationProcessingScreen
        serviceType="flashcards"
        progress={jobStatus?.progress}
      />
    );
  }

  if (viewMode === 'import') {
    return (
      <View style={[styles.container, { backgroundColor: paper }]}>
        {error ? (
          <Text style={[styles.formError, { color: theme.colors.error }]}>{error}</Text>
        ) : null}
        <CardDeckImportPanel
          importing={importingDeck}
          onCancel={() => setViewMode('generate')}
          onImport={handleImportCards}
        />
      </View>
    );
  }

  if (viewMode === 'generate' || viewMode === 'generate_more') {
    const addingMore = viewMode === 'generate_more';
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {error ? (
          <Text style={[styles.formError, { color: theme.colors.error }]}>{error}</Text>
        ) : null}
        <CardDeckGenerateScreen
          {...generateScreenProps}
          title={addingMore ? 'Add more cards' : 'Create a flashcard set'}
          subtitle={
            addingMore
              ? 'New cards will be added to your current set. Nothing is removed'
              : 'Creates a new set. Existing sets stay as they are.'
          }
          submitLabel={
            addingMore ? `Add ${cardCount} cards` : `Create ${cardCount}-card set`
          }
          allowImport={!addingMore}
          onImport={!addingMore ? handleOpenImport : undefined}
          onStartBlank={!addingMore ? handleCreateBlankDeck : undefined}
          blankCreating={creatingBlankDeck}
          notesReady={hasNotes}
          onCancel={() => setViewMode(addingMore ? 'deck' : 'collection')}
          onGenerate={async () => {
            if (addingMore) {
              await handleGenerate({
                append: true,
                regenerate: false,
                createNew: false,
                deckId: selectedDeckId,
              });
              setViewMode('deck');
            } else {
              await handleGenerate({ createNew: true, regenerate: false, append: false });
            }
          }}
        />
      </View>
    );
  }

  if (viewMode === 'study' && userId && selectedDeckId) {
    return (
      <CardDeckSession
        contentId={contentId}
        userId={userId}
        deckId={selectedDeckId}
        topicIds={srsFilters.topicIds}
        starredOnly={srsFilters.starredOnly}
        filterLabel={srsFilterLabel}
        onBack={() => setViewMode('deck')}
        onDeckRefresh={refreshDeck}
        onStarChange={(cardId, isStarred) => {
          setFlashcards((prev) =>
            prev ? prev.map((c) => (c.id === cardId ? { ...c, is_starred: isStarred } : c)) : prev
          );
        }}
      />
    );
  }

  if (viewMode === 'quick_review' && flashcards) {
    return (
      <CardDeckQuickReview
        flashcards={flashcards}
        topics={topics}
        topicIds={quickReviewFilters.topicIds}
        starredOnly={quickReviewFilters.starredOnly}
        shuffle={quickReviewFilters.shuffle}
        onToggleStar={handleToggleStar}
        onBack={() => setViewMode('deck')}
      />
    );
  }

  if (viewMode === 'deck') {
    if (deckLoading && flashcards == null) {
      return <PanelSkeleton label="Loading flashcards" rows={4} />;
    }
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.backRow}>
          <Button mode="text" onPress={goToCollection}>
            All sets
          </Button>
        </View>
        <CardDeckHome
          flashcards={flashcards || []}
          studyQueueCount={studyQueueCount}
          deckTitle={isStarredCollection ? 'Starred' : deckTitle}
          isStarredCollection={isStarredCollection}
          onStartStudying={({ topicIds, starredOnly }) => {
            setSrsFilters({
              topicIds,
              starredOnly: isStarredCollection ? true : starredOnly,
            });
            setViewMode('study');
          }}
          onGenerateMore={isStarredCollection ? undefined : () => setViewMode('generate_more')}
          onToggleStar={handleToggleStar}
        />
      </View>
    );
  }

  if (!userId || setsLoading) {
    return <PanelSkeleton label="Loading flashcard sets" rows={4} />;
  }

  if (setsError && deckSets.length === 0) {
    return (
      <PanelLoadError
        fill
        title="Couldn't load flashcards"
        description={setsErrorObj instanceof Error ? setsErrorObj.message : undefined}
        onRetry={() => refetchSets()}
        retrying={setsFetching}
      />
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: paper }]}
      contentContainerStyle={styles.collectionContent}
    >
      <Text style={[studyTitleStyle, { color: themeMode === 'dark' ? '#FAFAFA' : STUDY_INK }]}>
        Flashcards
      </Text>
      <Text style={[studySubStyle, { color: STUDY_ZINC_500, marginBottom: 24 }]}>
        Generate from your notes and start reviewing.
      </Text>

      {error ? (
        <Text style={[styles.formError, { color: theme.colors.error }]}>{error}</Text>
      ) : null}

      {deckSets.length === 0 ? (
        <View style={styles.emptyCard}>
          <EmptyDeckPreview />
          <Text style={styles.emptyTitle}>No flashcards yet</Text>
          <Text style={styles.emptyCopy}>
            {decksList?.has_created_any_deck
              ? 'Pick size and topics, or leave the defaults.'
              : 'One tap builds a set from your notes.'}
          </Text>
          <View style={styles.emptyCta}>
            {decksList?.has_created_any_deck ? (
              <StudyPillButton
                label="Customize"
                disabled={isGenerating || atDeckLimit}
                onPress={handleRecreate}
              />
            ) : (
              <StudyPillButton
                label="Generate flashcards"
                icon={Sparkles}
                loading={isGenerating}
                disabled={!hasNotes || isGenerating || atDeckLimit}
                onPress={handleQuickGenerate}
              />
            )}
            <View style={styles.altActions}>
              <Pressable
                onPress={handleCreateBlankDeck}
                disabled={isGenerating || creatingBlankDeck || atDeckLimit}
                style={styles.textLink}
              >
                <NotebookPen size={14} strokeWidth={ICON_STROKE} color={STUDY_ZINC_500} />
                <Text style={styles.textLinkLabel}>Scratch</Text>
              </Pressable>
              <Text style={styles.dot}>·</Text>
              <Pressable
                onPress={handleOpenImport}
                disabled={isGenerating || creatingBlankDeck || atDeckLimit}
                style={styles.textLink}
              >
                <Upload size={14} strokeWidth={ICON_STROKE} color={STUDY_ZINC_500} />
                <Text style={styles.textLinkLabel}>Import</Text>
              </Pressable>
            </View>
          </View>
          {!hasNotes ? (
            <Text style={styles.emptyHint}>
              Notes are still processing. Generate unlocks when they’re ready. Scratch and import
              work anytime.
            </Text>
          ) : null}
        </View>
      ) : (
        <>
          {(starredSummary.total_count || 0) > 0 ? (
            <Pressable
              onPress={openStarredSet}
              style={[styles.setCard, { backgroundColor: '#fff', borderColor: STUDY_BORDER }]}
            >
              <View style={styles.starIcon}>
                <Star size={18} strokeWidth={ICON_STROKE} color="#D97706" fill="#FBBF24" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.setTitleRow}>
                  <Text style={styles.setTitle}>Starred cards</Text>
                  <View style={styles.setBadge}>
                    <Text style={styles.setBadgeText}>Set</Text>
                  </View>
                </View>
                <Text style={styles.setMeta}>
                  {`${starredSummary.total_count} starred${
                    starredSummary.study_queue_count
                      ? ` · ${starredSummary.study_queue_count} ready to study`
                      : ''
                  }`}
                </Text>
              </View>
              <ArrowRight size={16} strokeWidth={ICON_STROKE} color="#A1A1AA" />
            </Pressable>
          ) : null}

          {deckSets.map((set) => {
            const isRenaming = renamingDeckId === set.deck_id;
            const setLabel = set.title || `Flashcard set ${set.deck_id}`;
            return (
              <View
                key={set.deck_id}
                style={[styles.setCard, { backgroundColor: '#fff', borderColor: STUDY_BORDER }]}
              >
                <Pressable
                  onPress={() => !isRenaming && openDeck(set.deck_id)}
                  disabled={isRenaming}
                  style={styles.setIcon}
                >
                  <MaterialCommunityIcons
                    name={DECK_SET_ICONS[getDeckIconIndex(set.deck_id, DECK_SET_ICONS.length)]}
                    size={20}
                    color={STUDY_INK}
                  />
                </Pressable>
                <View style={{ flex: 1 }}>
                  {isRenaming ? (
                    <View style={styles.renameRow}>
                      <TextInput
                        value={renameDraft}
                        onChangeText={setRenameDraft}
                        autoFocus
                        maxLength={80}
                        editable={!renameSaving}
                        style={styles.renameInput}
                      />
                      <StudyPillButton
                        label="Save"
                        disabled={renameSaving}
                        loading={renameSaving}
                        onPress={() => saveRenameSet(set.deck_id)}
                      />
                      <StudyPillButton
                        label="Cancel"
                        variant="secondary"
                        disabled={renameSaving}
                        onPress={() => {
                          setRenamingDeckId(null);
                          setRenameDraft('');
                        }}
                      />
                    </View>
                  ) : (
                    <Pressable onPress={() => openDeck(set.deck_id)}>
                      <View style={styles.setTitleRow}>
                        <Text style={styles.setTitle}>{setLabel}</Text>
                        {set.study_queue_count && set.study_queue_count > 0 ? (
                          <View style={styles.readyBadge}>
                            <Text style={styles.readyBadgeText}>{set.study_queue_count} ready</Text>
                          </View>
                        ) : (
                          <View style={styles.readyBadge}>
                            <Text style={styles.setBadgeText}>Set</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.setMeta}>
                        {set.study_queue_count && set.study_queue_count > 0
                          ? `${set.study_queue_count} ready to study`
                          : `${set.total_count || 0} cards`}
                        {set.due_count ? ` · ${set.due_count} due` : ''}
                        {set.new_count ? ` · ${set.new_count} new` : ''}
                      </Text>
                      {formatWhen(set.updated_at || set.created_at) ? (
                        <Text style={styles.setWhen}>
                          Updated {formatWhen(set.updated_at || set.created_at)}
                        </Text>
                      ) : null}
                    </Pressable>
                  )}
                </View>
                {!isRenaming ? (
                  <Pressable
                    onPress={() => {
                      setRenamingDeckId(set.deck_id);
                      setRenameDraft(set.title || '');
                    }}
                    hitSlop={8}
                    style={styles.iconBtn}
                  >
                    <Pencil size={16} strokeWidth={ICON_STROKE} color="#A1A1AA" />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => handleDeleteSet(set.deck_id)}
                  hitSlop={8}
                  style={styles.iconBtn}
                  disabled={deletingDeckId === set.deck_id}
                >
                  <Trash2 size={16} strokeWidth={ICON_STROKE} color="#A1A1AA" />
                </Pressable>
                {!isRenaming ? (
                  <Pressable onPress={() => openDeck(set.deck_id)}>
                    <Text style={styles.openLink}>Open</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          <View style={styles.bottomCreate}>
            <StudyPillButton
              label="Create a set"
              icon={Plus}
              disabled={atDeckLimit || creatingBlankDeck}
              onPress={handleRecreate}
            />
            <View style={styles.bottomAlts}>
              <StudyPillButton
                label="Scratch"
                icon={NotebookPen}
                variant="secondary"
                disabled={atDeckLimit || creatingBlankDeck}
                loading={creatingBlankDeck}
                onPress={handleCreateBlankDeck}
              />
              <StudyPillButton
                label="Import"
                icon={Upload}
                variant="secondary"
                disabled={atDeckLimit || creatingBlankDeck}
                onPress={handleOpenImport}
              />
            </View>
            {atDeckLimit ? (
              <Text style={styles.emptyHint}>
                Limit reached ({MAX_CARD_DECK_DECKS_PER_CONTENT} sets). Delete one to add another.
              </Text>
            ) : null}
          </View>
        </>
      )}
      <ConfirmModal
        visible={deleteTarget != null}
        title="Delete set"
        message="Delete this flashcard set? Cards and study progress for it will be removed."
        confirmText="Delete"
        destructive
        isLoading={deletingDeckId != null}
        onConfirm={confirmDeleteSet}
        onCancel={() => setDeleteTarget(null)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  backRow: { paddingHorizontal: 8, paddingTop: 4 },
  collectionContent: { padding: 20, paddingBottom: 40 },
  formError: {
    fontFamily: Fonts.ui.regular,
    fontSize: 13,
    lineHeight: 18,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  heading: { fontSize: 22, fontFamily: Fonts.ui.bold },
  subheading: { marginTop: 4, marginBottom: 16, fontSize: 14 },
  createBtn: { alignSelf: 'flex-start', marginBottom: 16 },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 24,
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: STUDY_BORDER,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 22,
    letterSpacing: -0.4,
    color: STUDY_INK,
    marginTop: 8,
  },
  emptyCopy: {
    fontFamily: Fonts.ui.regular,
    fontSize: 14,
    lineHeight: 20,
    color: STUDY_ZINC_500,
    textAlign: 'center',
    marginTop: 6,
  },
  emptyCta: { width: '100%', gap: 10, marginTop: 20, alignItems: 'stretch' },
  emptyHint: {
    fontFamily: Fonts.ui.regular,
    fontSize: 12,
    color: STUDY_ZINC_500,
    textAlign: 'center',
    marginTop: 12,
  },
  setCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  starIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: STUDY_PAPER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  setTitle: { fontFamily: Fonts.ui.semiBold, fontSize: 14, color: STUDY_INK },
  setMeta: { fontFamily: Fonts.ui.regular, fontSize: 13, color: STUDY_ZINC_500, marginTop: 4 },
  setWhen: { fontFamily: Fonts.ui.regular, fontSize: 12, color: '#A1A1AA', marginTop: 4 },
  setBadge: {
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  setBadgeText: { fontFamily: Fonts.ui.semiBold, fontSize: 11, color: '#92400E' },
  readyBadge: {
    borderRadius: 999,
    backgroundColor: STUDY_PAPER,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  readyBadgeText: { fontFamily: Fonts.ui.semiBold, fontSize: 11, color: '#3F3F46' },
  iconBtn: { padding: 6 },
  openLink: { fontFamily: Fonts.ui.semiBold, fontSize: 12, color: STUDY_INK },
  bottomCreate: { alignItems: 'center', paddingTop: 12, gap: 8 },
  bottomAlts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  altActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 4 },
  textLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
  textLinkLabel: { fontFamily: Fonts.ui.medium, fontSize: 14, color: STUDY_ZINC_500 },
  dot: { color: '#D4D4D8', fontSize: 16 },
  renameRow: { gap: 8 },
  renameInput: {
    borderWidth: 1,
    borderColor: 'rgba(63,107,79,0.2)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
    color: STUDY_INK,
    backgroundColor: '#fff',
  },
});

export default CardDecksTab;
