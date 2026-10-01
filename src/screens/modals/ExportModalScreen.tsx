import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useContent, usePodcastUrl } from '@/api/queries/content';
import { generatePDFFromSummary, hasExportableSummaryNotes, savePDFFile, sharePDFFile, cleanupPDFFile } from '@/utils/pdfExport';
import { downloadPodcastFile, sharePodcastFile, savePodcastFile, cleanupPodcastFile } from '@/utils/podcastShare';
import { getDownloadSaveMessage } from '@/utils/downloadSaveMessages';
import CenteredModalContainer from '@/components/ui/CenteredModalContainer';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { useNotificationStore } from '@/store/notificationStore';
import type { AppStackParamList } from '@/types/navigation';
import { buildContentNotesSummary } from '@shared/summaryNotes.js';

import { Fonts } from '@/config/fonts';

type ExportModalRouteProp = RouteProp<AppStackParamList, 'ExportModal'>;
type ExportModalNavigationProp = NativeStackNavigationProp<AppStackParamList, 'ExportModal'>;

const LABELS = {
  pdf: {
    title: 'Export PDF',
    subtitle: 'Choose how you want to export your notes.',
    shareLabel: 'Share PDF',
    shareDesc: 'Send it to apps, contacts, or cloud drives.',
    saveLabel: 'Save to device',
    saveDesc: 'Store a copy locally for offline access.',
    sharingMsg: 'Preparing PDF for sharing…',
    savingMsg: 'Saving PDF to your device…',
    successKind: 'Notes' as const,
    successPlural: true,
  },
  audio: {
    title: 'Export Audio',
    subtitle: 'Choose how you want to export this podcast.',
    shareLabel: 'Share Audio',
    shareDesc: 'Send it to apps, contacts, or cloud drives.',
    saveLabel: 'Save to device',
    saveDesc: 'Store a copy locally for offline listening.',
    sharingMsg: 'Preparing audio for sharing…',
    savingMsg: 'Saving audio to your device…',
    successKind: 'Audio' as const,
    successPlural: false,
  },
} as const;

const ExportModalScreen: React.FC = () => {
  const navigation = useNavigation<ExportModalNavigationProp>();
  const route = useRoute<ExportModalRouteProp>();
  const { contentId, type } = route.params;
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const showSuccess = useNotificationStore((s) => s.showSuccess);

  const { data: contentData } = useContent(contentId);
  const content = contentData?.data;
  const notesSummary = useMemo(() => buildContentNotesSummary(content), [content]);
  const { data: podcastUrlData } = usePodcastUrl(type === 'audio' ? contentId : null);
  const podcastUrl = podcastUrlData?.data?.podcast_url ?? null;

  const [loadingAction, setLoadingAction] = useState<'share' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isLoading = Boolean(loadingAction);

  const isPdf = type === 'pdf';
  const labels = LABELS[type];

  const handleClose = useCallback(() => {
    if (!isLoading) {
      navigation.goBack();
    }
  }, [isLoading, navigation]);

  const fireShareAndCleanup = useCallback(
    (fileUri: string, title: string) => {
      const sharePromise = isPdf
        ? sharePDFFile(fileUri, title)
        : sharePodcastFile(fileUri, title);

      sharePromise.finally(() => {
        if (isPdf) {
          cleanupPDFFile(fileUri).catch(() => {});
        } else {
          cleanupPodcastFile(fileUri).catch(() => {});
        }
      });
    },
    [isPdf]
  );

  const handleAction = useCallback(
    async (action: 'share' | 'save') => {
      if (loadingAction) return;
      if (!content) {
        setError('No content available to export');
        return;
      }
      if (!isPdf && !podcastUrl) {
        setError('Podcast audio not available yet');
        return;
      }
      if (isPdf && !hasExportableSummaryNotes(notesSummary)) {
        setError('No notes available to export');
        return;
      }

      setLoadingAction(action);
      setError(null);

      try {
        const fileUri = isPdf
          ? await generatePDFFromSummary({
              title: content.title || 'Notes',
              summary: notesSummary,
            })
          : await downloadPodcastFile({
              podcastUrl: podcastUrl!,
              title: content.title || 'Podcast',
            });

        if (action === 'share') {
          navigation.goBack();
          fireShareAndCleanup(fileUri, content.title || (isPdf ? 'Notes' : 'Podcast'));
        } else {
          const saveResult = isPdf
            ? await savePDFFile(fileUri, content.title || 'Notes')
            : await savePodcastFile(fileUri, content.title || 'Podcast');
          const successMessage = getDownloadSaveMessage(
            labels.successKind,
            saveResult.location,
            { plural: labels.successPlural }
          );
          if (isPdf) {
            cleanupPDFFile(fileUri).catch(() => {});
          } else {
            cleanupPodcastFile(fileUri).catch(() => {});
          }
          showSuccess(successMessage);
          navigation.goBack();
        }
      } catch (err: any) {
        const message = err?.message || 'Failed to export. Please try again.';
        if (message !== 'Save cancelled' && message !== 'User did not share') {
          setError(message);
        }
      } finally {
        setLoadingAction(null);
      }
    },
    [loadingAction, content, notesSummary, podcastUrl, isPdf, labels, navigation, showSuccess, fireShareAndCleanup]
  );

  return (
    <CenteredModalContainer onBackdropPress={handleClose}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="titleLarge" style={[styles.title, { color: theme.colors.onSurface }]}>
            {labels.title}
          </Text>
          <Text variant="bodySmall" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            {labels.subtitle}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleClose}
          disabled={isLoading}
          style={styles.closeButton}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="close" size={22} color={theme.colors.onSurface} />
        </TouchableOpacity>
      </View>

      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} variant="compact" /> : null}

      <View style={styles.options}>
        <TouchableOpacity
          style={[
            styles.optionCard,
            { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant },
          ]}
          onPress={() => handleAction('share')}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <View style={[styles.iconBadge, { backgroundColor: theme.colors.primaryContainer }]}>
            <MaterialCommunityIcons name="share-variant" size={20} color={theme.colors.primary} />
          </View>
          <View style={styles.optionText}>
            <Text variant="titleMedium" style={[styles.optionTitle, { color: theme.colors.onSurface }]}>
              {labels.shareLabel}
            </Text>
            <Text variant="bodySmall" style={[styles.optionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {labels.shareDesc}
            </Text>
          </View>
          {loadingAction === 'share' ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.optionCard,
            { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.outlineVariant },
          ]}
          onPress={() => handleAction('save')}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          <View style={[styles.iconBadge, { backgroundColor: theme.colors.secondaryContainer }]}>
            <MaterialCommunityIcons name="download" size={20} color={theme.colors.secondary} />
          </View>
          <View style={styles.optionText}>
            <Text variant="titleMedium" style={[styles.optionTitle, { color: theme.colors.onSurface }]}>
              {labels.saveLabel}
            </Text>
            <Text variant="bodySmall" style={[styles.optionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
              {labels.saveDesc}
            </Text>
          </View>
          {loadingAction === 'save' ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <MaterialCommunityIcons name="chevron-right" size={22} color={theme.colors.onSurfaceVariant} />
          )}
        </TouchableOpacity>
      </View>

      {isLoading && (
        <Text variant="bodySmall" style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
          {loadingAction === 'share' ? labels.sharingMsg : labels.savingMsg}
        </Text>
      )}
    </CenteredModalContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: Fonts.ui.semiBold,
  },
  subtitle: {
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
  },
  options: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontFamily: Fonts.ui.semiBold,
  },
  optionSubtitle: {
    lineHeight: 18,
  },
  helperText: {
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default ExportModalScreen;
