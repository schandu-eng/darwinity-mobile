import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Surface,
  SegmentedButtons,
  Button,
  TextInput,
  ProgressBar,
  ActivityIndicator,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useAuthStore, useBillingPlanStore } from '@/store';
import { enforceFreeUploadFileSize } from '@/utils/contentLimits';
import { showUpgradePaywall } from '@/utils/subscriptionErrorHandler';
import {
  useYoutubePasteAccess,
  YOUTUBE_LIMIT_TYPE,
  YOUTUBE_UPGRADE_MESSAGE,
} from '@/hooks/useProFeatureAccess';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useUploadPDF, useProcessYouTube, useUploadAudio } from '@/api/queries/upload';
import { DOCUMENT_PICKER_MIME_TYPES, DOCUMENT_UPLOAD_ERROR, isAllowedDocumentUpload } from '@/utils/documentFormats';
import { validateYouTubeUrl } from '@/utils/youtubeUrl';
import { useJobStatus } from '@/api/queries/content';
import ErrorBanner from '@/components/ui/ErrorBanner';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ContentStackParamList } from '@/types/navigation';

import { Fonts } from '@/config/fonts';

type NavigationProp = NativeStackNavigationProp<ContentStackParamList>;
type UploadRouteProp = RouteProp<ContentStackParamList, 'Upload'>;

type ContentType = 'pdf' | 'youtube' | 'audio';

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const UploadScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<UploadRouteProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const user = useAuthStore((state) => state.user);
  const isPro = useBillingPlanStore((state) => state.isPro);
  const contentLimits = useBillingPlanStore((state) => state.contentLimits);
  const isBillingPlanLoading = useBillingPlanStore(
    (state) => state.isLoading && state.lastRefreshedAt === null,
  );
  const { locked: youtubeLocked } = useYoutubePasteAccess();

  const [contentType, setContentType] = useState<ContentType>('pdf');
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [uploadJobId, setUploadJobId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const routeError = route.params?.error;
    if (routeError) {
      setError(routeError);
      navigation.setParams({ error: undefined });
    }
  }, [route.params?.error, navigation]);

  const uploadPDFMutation = useUploadPDF();
  const processYouTubeMutation = useProcessYouTube();
  const uploadAudioMutation = useUploadAudio();

  const { data: jobStatusData } = useJobStatus(uploadJobId);

  const jobStatus = jobStatusData?.data;

  const selectContentType = useCallback((next: ContentType) => {
    if (next === 'youtube' && youtubeLocked) {
      showUpgradePaywall(YOUTUBE_UPGRADE_MESSAGE, YOUTUBE_LIMIT_TYPE);
      return;
    }
    setContentType(next);
    setSelectedFile(null);
    setYoutubeUrl('');
    setError('');
  }, [youtubeLocked]);

  const handleFilePick = useCallback(async () => {
    try {
      setError('');
      const allowedMimeTypes =
        contentType === 'pdf'
          ? DOCUMENT_PICKER_MIME_TYPES
          : ['audio/mpeg', 'audio/mp4', 'audio/webm'];

      const result = await DocumentPicker.getDocumentAsync({
        type: allowedMimeTypes,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      if (contentType === 'pdf' && !isAllowedDocumentUpload(file.name)) {
        setError(DOCUMENT_UPLOAD_ERROR);
        return;
      }
      if (!enforceFreeUploadFileSize(file.size, isPro, contentLimits, (message) => {
        showUpgradePaywall(message, 'file_size');
        setError(message);
      })) {
        return;
      }

      setSelectedFile(result);
    } catch (err: any) {
      setError(err.message || 'Failed to pick file');
    }
  }, [contentType, isPro, contentLimits]);

  const handleUpload = useCallback(async () => {
    if (!user?.id) {
      setError('User not found. Please login again.');
      return;
    }

    setError('');

    if (contentType === 'youtube') {
      if (youtubeLocked) {
        showUpgradePaywall(YOUTUBE_UPGRADE_MESSAGE, YOUTUBE_LIMIT_TYPE);
        return;
      }
      if (!youtubeUrl.trim()) {
        setError('Please enter a YouTube URL');
        return;
      }

      const youtubeValidation = validateYouTubeUrl(youtubeUrl);
      if (!youtubeValidation.valid) {
        setError(youtubeValidation.message);
        return;
      }

      try {
        const result = await processYouTubeMutation.mutateAsync({
          url: youtubeUrl.trim(),
          userId: user.id,
        });

        if (result.success && result.data) {
          setUploadJobId(result.data.job_id);
        } else {
          setError(result.message || 'Failed to process YouTube video');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to process YouTube video');
      }
    } else {
      if (!selectedFile || selectedFile.canceled || !selectedFile.assets[0]) {
        setError(`Please select a ${contentType === 'pdf' ? 'PDF' : 'audio'} file`);
        return;
      }

      const file = selectedFile.assets[0];

      try {
        const result =
          contentType === 'pdf'
            ? await uploadPDFMutation.mutateAsync({ file, userId: user.id })
            : await uploadAudioMutation.mutateAsync({ file, userId: user.id });

        if (result.success && result.data) {
          setUploadJobId(result.data.job_id);
        } else {
          setError(result.message || `Failed to upload ${contentType === 'pdf' ? 'PDF' : 'audio'}`);
        }
      } catch (err: any) {
        setError(err.message || `Failed to upload ${contentType === 'pdf' ? 'PDF' : 'audio'}`);
      }
    }
  }, [contentType, youtubeUrl, selectedFile, user, uploadPDFMutation, processYouTubeMutation, uploadAudioMutation, youtubeLocked]);

  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setYoutubeUrl('');
    setUploadJobId(null);
    setError('');
  }, []);

  const isUploading = uploadPDFMutation.isPending || processYouTubeMutation.isPending || uploadAudioMutation.isPending;
  const isProcessing = jobStatus?.status === 'processing' || jobStatus?.status === 'pending';
  const isCompleted = jobStatus?.status === 'completed';
  const isFailed = jobStatus?.status === 'failed' || jobStatus?.status === 'blocked';

  useEffect(() => {
    if (isCompleted && jobStatus?.content_id) {
      Alert.alert('Upload Complete', 'Your content has been processed successfully!', [
        {
          text: 'View Content',
          onPress: () => {
            navigation.navigate('ContentDetail', { contentId: jobStatus.content_id! });
            handleReset();
          },
        },
        {
          text: 'Upload More',
          onPress: handleReset,
        },
      ]);
    }
  }, [isCompleted, jobStatus?.content_id, navigation, handleReset]);

  const renderFilePicker = () => {
    if (contentType === 'youtube') {
      return (
        <Surface style={[styles.inputContainer, { backgroundColor: theme.colors.surface }]}>
          <TextInput
            label="YouTube URL"
            value={youtubeUrl}
            onChangeText={setYoutubeUrl}
            mode="outlined"
            placeholder="https://www.youtube.com/watch?v=..."
            style={styles.input}
            disabled={isUploading || isProcessing}
            right={
              <TextInput.Icon icon="youtube" />
            }
          />
        </Surface>
      );
    }

    return (
      <Surface style={[styles.filePickerContainer, { backgroundColor: theme.colors.surface }]}>
        {selectedFile && !selectedFile.canceled && selectedFile.assets[0] ? (
          <View style={styles.selectedFileContainer}>
            <MaterialCommunityIcons
              name={contentType === 'pdf' ? 'file-pdf-box' : 'music'}
              size={32}
              color={theme.colors.primary}
            />
            <View style={styles.fileInfo}>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                {selectedFile.assets[0].name}
              </Text>
              {selectedFile.assets[0].size && (
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {formatFileSize(selectedFile.assets[0].size)}
                </Text>
              )}
            </View>
            <Button
              mode="text"
              icon="close"
              onPress={() => setSelectedFile(null)}
              disabled={isUploading || isProcessing}
            >
              Remove
            </Button>
          </View>
        ) : (
          <Button
            mode="outlined"
            icon={contentType === 'pdf' ? 'file-pdf-box' : 'music'}
            onPress={handleFilePick}
            disabled={isUploading || isProcessing || isBillingPlanLoading}
            style={styles.pickFileButton}
          >
            {contentType === 'pdf' ? 'Select PDF, Word, or PowerPoint' : 'Select Audio File'}
          </Button>
        )}
        <Text variant="bodySmall" style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
          {isBillingPlanLoading
            ? 'Checking your plan...'
            : isPro
            ? 'Pro plan: large files supported'
            : `Maximum file size: ${formatFileSize(contentLimits.maxUploadBytes)}`}
        </Text>
      </Surface>
    );
  };

  const renderProgress = () => {
    if (!isProcessing && !isUploading) return null;

    const statusMessage = jobStatus?.user_message || jobStatus?.result?.status_message;
    const hasProgress = jobStatus?.progress !== undefined && jobStatus?.progress !== null;
    const progressValue = jobStatus?.progress ?? 0;

    return (
      <Surface style={[styles.progressContainer, { backgroundColor: theme.colors.surface }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text variant="titleMedium" style={[styles.progressTitle, { color: theme.colors.onSurface }]}>
          {isUploading ? 'Uploading...' : 'Processing...'}
        </Text>
        {hasProgress && (
          <>
            <ProgressBar progress={progressValue / 100} color={theme.colors.primary} style={styles.progressBar} />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {statusMessage || `${progressValue}% complete`}
            </Text>
          </>
        )}
        {statusMessage && !hasProgress && (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
            {statusMessage}
          </Text>
        )}
      </Surface>
    );
  };

  const renderError = () => {
    if (!error && !isFailed) return null;

    const errorMessage = error || jobStatus?.user_message || 'Upload failed';

    return <ErrorBanner message={errorMessage} onDismiss={() => setError('')} />;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={[styles.title, { color: theme.colors.onSurface }]}>
            Upload Content
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
            Add PDF, YouTube video, or audio content to your library
          </Text>
        </View>

        {renderError()}

        <SegmentedButtons
          value={contentType}
          onValueChange={(value) => selectContentType(value as ContentType)}
          buttons={[
            { value: 'pdf', label: 'PDF', icon: 'file-pdf-box' },
            { value: 'youtube', label: 'YouTube', icon: 'youtube' },
            { value: 'audio', label: 'Audio', icon: 'music' },
          ]}
          style={styles.segmentedButtons}
        />

        {renderFilePicker()}
        {renderProgress()}

        <Button
          mode="contained"
          onPress={handleUpload}
          disabled={isUploading || isProcessing || isCompleted}
          loading={isUploading}
          style={styles.uploadButton}
        >
          {isUploading ? 'Uploading...' : isProcessing ? 'Processing...' : 'Upload'}
        </Button>

        {(isCompleted || isFailed) && (
          <Button mode="outlined" onPress={handleReset} style={styles.resetButton}>
            Upload Another
          </Button>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontFamily: Fonts.ui.bold,
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 8,
  },
  segmentedButtons: {
    marginBottom: 24,
  },
  inputContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  input: {
    backgroundColor: 'transparent',
  },
  filePickerContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  pickFileButton: {
    marginBottom: 8,
  },
  selectedFileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  fileInfo: {
    flex: 1,
  },
  helperText: {
    marginTop: 8,
    textAlign: 'center',
  },
  progressContainer: {
    padding: 24,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
    gap: 12,
  },
  progressTitle: {
    fontFamily: Fonts.ui.semiBold,
  },
  progressBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  uploadButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  resetButton: {
    marginTop: 8,
  },
});

export default UploadScreen;
