import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, SafeAreaView, Text, TouchableOpacity, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useJobStatus } from '@/api/queries/content';
import { FOLDERS_QUERY_KEY } from '@/api/queries/folders';
import CircularProgress from '@/components/ui/CircularProgress';
import StageProgressBar from '@/components/ui/StageProgressBar';
import { getJobProgressState } from '@/utils/jobProgress';
import { useStreamingNotes } from '@/hooks/useStreamingNotes';
import { useActiveJobsStore } from '@/store/activeJobsStore';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { handleUpgradeRequiredJobStatus } from '@/utils/subscriptionErrorHandler';
import { notifyIntakeFailureSupportHint } from '@/store/intakeFailureSupportHintStore';
import type { ContentStackParamList } from '@/types/navigation';

import { Fonts } from '@/config/fonts';

type UploadProgressRouteProp = RouteProp<ContentStackParamList, 'UploadProgress'>;
type UploadProgressNavigationProp = NativeStackNavigationProp<ContentStackParamList, 'UploadProgress'>;

const UploadProgressScreen: React.FC = () => {
  const navigation = useNavigation<UploadProgressNavigationProp>();
  const route = useRoute<UploadProgressRouteProp>();
  const { jobId, contentTitle, sourceScreen, folderId } = route.params;
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const invalidateContentAndFolders = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['content'] });
    queryClient.invalidateQueries({ queryKey: [FOLDERS_QUERY_KEY] });
  }, [queryClient]);

  const [job2Id, setJob2Id] = useState<string | null>(null);
  const [hasInvalidated, setHasInvalidated] = useState(false);
  const [hasNavigatedBack, setHasNavigatedBack] = useState(false);

  const addJob = useActiveJobsStore((state) => state.addJob);
  const removeJob = useActiveJobsStore((state) => state.removeJob);

  const { data: job1Data } = useJobStatus(jobId, { refetchInterval: 2000 });
  const { data: job2Data } = useJobStatus(job2Id, { refetchInterval: 2000 });

  const job1Status = job1Data?.data;
  const job2Status = job2Data?.data;

  const isError = useMemo(() => {
    return (job1Status?.status === 'blocked' || job1Status?.status === 'failed' || job1Status?.status === 'upgrade_required') ||
      (job2Status?.status === 'blocked' || job2Status?.status === 'failed' || job2Status?.status === 'upgrade_required');
  }, [job1Status?.status, job2Status?.status]);

  const errorMessage = useMemo(() => {
    return job1Status?.user_message || job2Status?.user_message || 'Processing failed.';
  }, [job1Status, job2Status]);

  const contentId = job1Status?.content_id ?? job2Status?.content_id ?? null;

  const notesFailedContentId = useMemo(() => {
    const notesFailed = job2Status?.status === 'failed' || job2Status?.status === 'blocked';
    return notesFailed && contentId ? contentId : null;
  }, [job2Status?.status, contentId]);

  const job2InProgress =
    job2Status?.status === 'processing' ||
    job2Status?.status === 'pending' ||
    job2Status?.status === 'completed';
  const streaming = !!contentId && job2InProgress && !isError;
  const streamedNotes = useStreamingNotes(contentId, streaming);

  useEffect(() => {
    if (job1Status?.result && typeof job1Status.result === 'object' && 'next_job_id' in job1Status.result) {
      const nextJobId = (job1Status.result as any).next_job_id;
      if (nextJobId && !job2Id) {
        setJob2Id(nextJobId);
      }
    }
  }, [job1Status?.result, job2Id]);

  useEffect(() => {
    const isProcessing =
      (job1Status?.status === 'processing' || job1Status?.status === 'pending') ||
      (job2Status?.status === 'processing' || job2Status?.status === 'pending');
    if (isProcessing) {
      addJob({
        jobId,
        contentTitle: contentTitle || 'Processing Content',
        timestamp: Date.now(),
        sourceScreen,
      });
    }
  }, [jobId, contentTitle, sourceScreen, addJob, job1Status?.status, job2Status?.status]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        const isStillProcessing =
          (job1Status?.status === 'processing' || job1Status?.status === 'pending') ||
          (job2Status?.status === 'processing' || job2Status?.status === 'pending');
        if (isStillProcessing) {
          addJob({
            jobId,
            contentTitle: contentTitle || 'Processing Content',
            timestamp: Date.now(),
            sourceScreen,
          });
        }
      };
    }, [jobId, contentTitle, sourceScreen, job1Status?.status, job2Status?.status, addJob])
  );

  const hasNextJobId = useMemo(() => {
    if (job1Status?.result && typeof job1Status.result === 'object' && 'next_job_id' in job1Status.result) {
      return !!(job1Status.result as { next_job_id?: string }).next_job_id;
    }
    return false;
  }, [job1Status?.result]);

  const isCompletedWithContentId = useMemo(() => {
    if (job2Status?.status === 'completed' && job2Status.content_id) return job2Status.content_id;
    if (job1Status?.status === 'completed' && job1Status.content_id && !hasNextJobId) return job1Status.content_id;
    return null;
  }, [job1Status?.status, job1Status?.content_id, job2Status?.status, job2Status?.content_id, hasNextJobId]);

  useEffect(() => {
    if (hasInvalidated || isError || !contentId) return;
    if (streamedNotes.length >= 1) {
      removeJob(jobId);
      invalidateContentAndFolders();
      setHasInvalidated(true);
      navigation.replace('ContentDetail', { contentId, notesJobId: job2Id ?? undefined });
    }
  }, [streamedNotes.length, contentId, hasInvalidated, isError, jobId, job2Id, removeJob, queryClient, navigation]);

  useEffect(() => {
    const isFailed = (job1Status?.status === 'failed' || job1Status?.status === 'blocked' || job1Status?.status === 'upgrade_required') ||
      (job2Status?.status === 'failed' || job2Status?.status === 'blocked' || job2Status?.status === 'upgrade_required');

    if (isCompletedWithContentId && !hasInvalidated) {
      removeJob(jobId);
      invalidateContentAndFolders();
      setHasInvalidated(true);
      setTimeout(() => {
        navigation.replace('ContentDetail', { contentId: isCompletedWithContentId, notesJobId: job2Id ?? undefined });
      }, 1000);
    } else if (isFailed && !hasInvalidated) {
      removeJob(jobId);
    }
  }, [isCompletedWithContentId, hasInvalidated, jobId, removeJob, job1Status?.status, job2Status?.status, navigation, queryClient, job2Id]);

  useEffect(() => {
    if (!isError || hasNavigatedBack) return;

    const activeJob = job2Status?.status === 'upgrade_required' || job2Status?.status === 'blocked' || job2Status?.status === 'failed'
      ? job2Status
      : job1Status;

    if (handleUpgradeRequiredJobStatus(activeJob)) {
      removeJob(jobId);
      setHasNavigatedBack(true);
      navigation.goBack();
      return;
    }

    if (notesFailedContentId) {
      removeJob(jobId);
      setHasNavigatedBack(true);
      invalidateContentAndFolders();
      navigation.replace('ContentDetail', { contentId: notesFailedContentId });
      return;
    }

    if (!errorMessage) return;

    notifyIntakeFailureSupportHint();
    removeJob(jobId);
    setHasNavigatedBack(true);
    if (sourceScreen === 'Home') {
      (navigation.getParent() as any)?.navigate('Home', {
        screen: 'HomeFeed',
        params: { error: errorMessage },
      });
    } else if (sourceScreen === 'ContentList') {
      navigation.navigate('ContentList', { error: errorMessage });
    } else if (sourceScreen === 'FolderDetail' && folderId != null) {
      navigation.navigate('FolderDetail', { folderId: folderId, error: errorMessage });
    } else if (sourceScreen === 'YouTubeLink' || sourceScreen === 'AudioRecording') {
      navigation.navigate(sourceScreen, { error: errorMessage });
    }
  }, [isError, errorMessage, hasNavigatedBack, sourceScreen, folderId, navigation, jobId, removeJob, job1Status, job2Status, notesFailedContentId, queryClient]);

  const progressState = useMemo(() => {
    return getJobProgressState(job1Status || null, job2Status || null, false);
  }, [job1Status, job2Status]);

  const handleBack = useCallback(() => {
    if (isCompletedWithContentId) {
      removeJob(jobId);
      navigation.replace('ContentDetail', { contentId: isCompletedWithContentId });
    } else {
      const isStillProcessing =
        (job1Status?.status === 'processing' || job1Status?.status === 'pending') ||
        (job2Status?.status === 'processing' || job2Status?.status === 'pending');
      if (isStillProcessing) {
        addJob({
          jobId,
          contentTitle: contentTitle || 'Processing Content',
          timestamp: Date.now(),
          sourceScreen,
        });
      }
      navigation.goBack();
    }
  }, [isCompletedWithContentId, navigation, jobId, job1Status?.status, job2Status?.status, contentTitle, sourceScreen, addJob, removeJob]);

  const handleErrorGoBack = useCallback(() => {
    removeJob(jobId);
    navigation.goBack();
  }, [jobId, removeJob, navigation]);

  if (isError && errorMessage) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 12 }]}>
          <TouchableOpacity onPress={handleErrorGoBack} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
            {contentTitle || 'Processing Content'}
          </Text>
          <View style={styles.menuButton} />
        </View>
        <View style={[styles.content, styles.errorContent]}>
          <ErrorBanner message={errorMessage} onDismiss={handleErrorGoBack} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 12 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]} numberOfLines={1}>
          {contentTitle || 'Processing Content'}
        </Text>
        <View style={styles.menuButton} />
      </View>

      <View style={styles.content}>
        {progressState.contextualMessage && (
          <View style={styles.contextualMessage}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.contextualText, { color: theme.colors.onSurfaceVariant }]}>
              {progressState.contextualMessage}
            </Text>
          </View>
        )}

        <View style={styles.progressWrapper}>
          <View style={styles.progressContainer}>
            <CircularProgress
              progress={progressState.progress}
              size={240}
              strokeWidth={15}
              showPercentage={true}
              statusText={progressState.statusText}
            />
          </View>
        </View>

        <View style={[styles.stagesContainer, { paddingBottom: Platform.OS === 'ios' ? 40 : insets.bottom + 40 }]}>
          <StageProgressBar currentStage={progressState.stage} theme={theme} />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: Fonts.ui.semiBold,
    textAlign: 'center',
    marginHorizontal: 16,
    letterSpacing: -0.3,
  },
  menuButton: {
    padding: 8,
    borderRadius: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contextualMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 40,
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(63, 107, 79, 0.08)',
  },
  contextualText: {
    fontSize: 13,
    fontFamily: Fonts.ui.medium,
    letterSpacing: 0.1,
  },
  progressWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stagesContainer: {
    paddingTop: 24,
    width: '100%',
  },
  errorContent: {
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
});

export default UploadProgressScreen;
