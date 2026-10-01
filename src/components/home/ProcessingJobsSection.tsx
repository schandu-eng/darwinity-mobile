import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useAuthStore } from '@/store';
import { useActiveJobsStore } from '@/store/activeJobsStore';
import type { ActiveJob } from '@/store/activeJobsStore';
import { useJobStatus, prefetchContentDetail } from '@/api/queries/content';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { handleUpgradeRequiredJobStatus } from '@/utils/subscriptionErrorHandler';
import { notifyIntakeFailureSupportHint } from '@/store/intakeFailureSupportHintStore';
import { useQueryClient } from '@tanstack/react-query';
import type { AppStackParamList, ContentStackParamList } from '@/types/navigation';

import { Fonts } from '@/config/fonts';

type UploadProgressSourceScreen = ContentStackParamList['UploadProgress']['sourceScreen'];

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;

interface ProcessingJobItemProps {
  job: ActiveJob;
  theme: typeof lightTheme | typeof darkTheme;
  onRemove: (jobId: string) => void;
}

const ProcessingJobItem: React.FC<ProcessingJobItemProps> = ({ job, theme, onRemove }) => {
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [trackedJobId, setTrackedJobId] = useState(job.jobId);
  const { data: jobData } = useJobStatus(trackedJobId, { refetchInterval: 2000 });

  const jobStatus = jobData?.data;
  const nextJobId = useMemo(() => {
    if (
      jobStatus?.result &&
      typeof jobStatus.result === 'object' &&
      'next_job_id' in jobStatus.result
    ) {
      return (jobStatus.result as { next_job_id?: string | null }).next_job_id ?? null;
    }
    return null;
  }, [jobStatus?.result]);
  const hasNextJob = !!nextJobId;
  const isCompleted = jobStatus?.status === 'completed' && !!jobStatus?.content_id;
  const isFailed = jobStatus?.status === 'failed' || jobStatus?.status === 'blocked' || jobStatus?.status === 'upgrade_required';
  const hasContentId = isCompleted;

  useEffect(() => {
    if (jobStatus?.status === 'completed' && nextJobId && trackedJobId !== nextJobId) {
      setTrackedJobId(nextJobId);
    }
  }, [jobStatus?.status, nextJobId, trackedJobId]);

  useEffect(() => {
    if (jobStatus?.status === 'upgrade_required') {
      handleUpgradeRequiredJobStatus(jobStatus);
      onRemove(job.jobId);
      return;
    }
    if (isCompleted && hasContentId) {
      queryClient.invalidateQueries({ queryKey: ['content'] });
      setTimeout(() => onRemove(job.jobId), 2000);
    }
    if (isFailed && jobStatus?.status !== 'upgrade_required') {
      notifyIntakeFailureSupportHint();
    }
  }, [isCompleted, hasContentId, isFailed, job.jobId, onRemove, queryClient, jobStatus]);

  const handlePress = useCallback(() => {
    if (isCompleted && hasContentId) {
      const contentId = jobStatus.content_id!;
      void prefetchContentDetail(contentId, userId);
      navigation.navigate('Content', {
        screen: 'ContentDetail',
        params: { contentId },
      });
    } else {
      navigation.navigate('Content', {
        screen: 'UploadProgress',
        params: {
          jobId: job.jobId,
          contentTitle: job.contentTitle,
          sourceScreen: job.sourceScreen as UploadProgressSourceScreen,
        },
      });
    }
  }, [isCompleted, hasContentId, jobStatus?.content_id, job, navigation, userId]);

  const errorMessage = useMemo(() => {
    if (isFailed) {
      return jobStatus?.user_message || 'Processing failed';
    }
    return null;
  }, [isFailed, jobStatus]);

  const getStatusText = useMemo(() => {
    if (isCompleted) return 'Complete';
    if (isFailed) return errorMessage || 'Failed';
    if (hasNextJob || jobStatus?.job_type === 'summary_generation') return 'Generating Notes...';
    if (jobStatus?.status === 'processing' || jobStatus?.status === 'pending') return 'Processing...';
    return 'Pending...';
  }, [jobStatus?.status, jobStatus?.job_type, hasNextJob, isCompleted, isFailed, errorMessage]);

  const getStatusColor = useMemo(() => {
    if (isCompleted) return theme.colors.primary;
    if (isFailed) return theme.colors.error;
    return theme.colors.primary;
  }, [isCompleted, isFailed, theme]);

  const handleDismissPress = useCallback(
    (e: any) => {
      e.stopPropagation();
      onRemove(job.jobId);
    },
    [job.jobId, onRemove]
  );

  const handleDismissBanner = useCallback(() => {
    onRemove(job.jobId);
  }, [job.jobId, onRemove]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={styles.jobItem}
    >
      <Surface style={[styles.jobCard, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.jobContent}>
          <View style={[styles.statusIndicator, { backgroundColor: getStatusColor }]} />
          <View style={styles.jobInfo}>
            <Text
              variant="bodyMedium"
              style={[styles.jobTitle, { color: theme.colors.onSurface }]}
              numberOfLines={1}
            >
              {job.contentTitle}
            </Text>
            {isFailed && errorMessage ? (
              <ErrorBanner
                variant="compact"
                message={errorMessage}
                onDismiss={handleDismissBanner}
              />
            ) : (
              <Text
                variant="bodySmall"
                style={[styles.jobStatus, { color: theme.colors.onSurfaceVariant }]}
                numberOfLines={1}
              >
                {getStatusText}
              </Text>
            )}
          </View>
          {isFailed ? (
            <TouchableOpacity
              onPress={handleDismissPress}
              style={styles.dismissButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons
                name="close"
                size={18}
                color={theme.colors.onSurfaceVariant}
              />
            </TouchableOpacity>
          ) : (
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
          )}
        </View>
      </Surface>
    </TouchableOpacity>
  );
};

const ProcessingJobsSection: React.FC = () => {
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const activeJobs = useActiveJobsStore((state) => state.activeJobs);
  const removeJob = useActiveJobsStore((state) => state.removeJob);

  const handleRemoveJob = useCallback(
    (jobId: string) => {
      removeJob(jobId);
    },
    [removeJob]
  );

  const sectionTitle = useMemo(() => {
    if (activeJobs.length === 0) return '';
    const processingCount = activeJobs.length;
    return processingCount === 1 ? 'Processing' : `Processing (${processingCount})`;
  }, [activeJobs.length]);

  if (activeJobs.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="clock-outline"
          size={18}
          color={theme.colors.onSurfaceVariant}
        />
        <Text
          variant="labelMedium"
          style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}
        >
          {sectionTitle}
        </Text>
      </View>
      {activeJobs.map((job) => (
        <ProcessingJobItem
          key={job.jobId}
          job={job}
          theme={theme}
          onRemove={handleRemoveJob}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: Fonts.ui.semiBold,
    letterSpacing: 0.2,
  },
  jobItem: {
    marginBottom: 8,
  },
  jobCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  jobContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  statusIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  jobInfo: {
    flex: 1,
    gap: 2,
  },
  jobTitle: {
    fontFamily: Fonts.ui.medium,
  },
  jobStatus: {
    fontSize: 12,
  },
  dismissButton: {
    padding: 4,
    borderRadius: 12,
  },
});

export default ProcessingJobsSection;
