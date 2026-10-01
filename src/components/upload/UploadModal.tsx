import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { X } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import * as DocumentPicker from 'expo-document-picker';
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore, useBillingPlanStore } from '@/store';
import { enforceFreeUploadFileSize } from '@/utils/contentLimits';
import type { ContentLimits } from '@/utils/contentLimits';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useUploadPDF, useUploadAudio, useProcessYouTube } from '@/api/queries/upload';
import { IN_APP_RECORDING_SOURCE } from '@/api/endpoints/upload';
import {
  isBillingPlanLimitError,
  showUpgradePaywall,
  tryShowLimitPaywall,
} from '@/utils/subscriptionErrorHandler';
import {
  useYoutubePasteAccess,
  YOUTUBE_LIMIT_TYPE,
  YOUTUBE_UPGRADE_MESSAGE,
} from '@/hooks/useProFeatureAccess';
import { validateYouTubeUrl } from '@/utils/youtubeUrl';
import BottomSheet from '@/components/ui/BottomSheet';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { notifyIntakeFailureSupportHint } from '@/store/intakeFailureSupportHintStore';
import {
  AUDIO_PICKER_MIME_TYPES,
  ALLOWED_AUDIO_FORMATS_LABEL,
  isAllowedAudioExtension,
  getAudioMimeFromFilename,
  pickSupportedRecorderMimeType,
  recordingFilenameForMime,
} from '@/utils/audioFormats';
import {
  DOCUMENT_PICKER_MIME_TYPES,
  DOCUMENT_UPLOAD_ERROR,
  isAllowedDocumentUpload,
} from '@/utils/documentFormats';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '@/types/navigation';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import { Fonts } from '@/config/fonts';
import {
  CREATE_SHEET_OPTIONS,
  CreateOptionListItem,
  HubAudioCaptureModal,
  HubDocumentUploadModal,
  HubLinkPasteModal,
  pickedFileFromWeb,
  type HubIntakeKind,
  type PickedUploadFile,
} from '@/components/upload/HubIntakeModals';

type NavigationProp = NativeStackNavigationProp<AppStackParamList>;
type IntakeStep = 'sheet' | HubIntakeKind;

interface UploadModalProps {
  visible: boolean;
  onDismiss: () => void;
  sourceScreenForProgress: 'Home' | 'ContentList' | 'FolderDetail';
  folderId?: number;
  initialOption?: 'upload' | 'paste' | 'record' | null;
}

const OPTION_TO_STEP: Record<'upload' | 'paste' | 'record', HubIntakeKind> = {
  upload: 'document',
  paste: 'youtube',
  record: 'audio',
};

const ASCII_FILENAME = /^[\x20-\x7E]*$/;

type AudioIntakeSessionProps = {
  open: boolean;
  isProcessing: boolean;
  submitError: string;
  onClose: () => void;
  onGenerate: (file: PickedUploadFile, inAppRecording: boolean) => void;
  onFileSizeBlocked: (message: string) => void;
  isPro: boolean;
  contentLimits: ContentLimits;
};

const AudioIntakeSession: React.FC<AudioIntakeSessionProps> = ({
  open,
  isProcessing,
  submitError,
  onClose,
  onGenerate,
  onFileSizeBlocked,
  isPro,
  contentLimits,
}) => {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [audioMode, setAudioMode] = useState<'record' | 'upload'>('record');
  const [selectedAudio, setSelectedAudio] = useState<PickedUploadFile | null>(null);
  const [recordedFile, setRecordedFile] = useState<PickedUploadFile | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isStartingRecording, setIsStartingRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const isNativeRecordingRef = useRef(false);
  const needsPrepareRef = useRef(true);
  const webRecorderRef = useRef<{ state: string; stop: () => void } | null>(null);
  const webStreamRef = useRef<{ getTracks: () => { stop: () => void }[] } | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedUrlRef = useRef<string | null>(null);

  const clearDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const revokeRecordedUrl = useCallback(() => {
    if (recordedUrlRef.current) {
      URL.revokeObjectURL(recordedUrlRef.current);
      recordedUrlRef.current = null;
    }
  }, []);

  const stopWebTracks = useCallback(() => {
    webStreamRef.current?.getTracks().forEach((track) => track.stop());
    webStreamRef.current = null;
    webRecorderRef.current = null;
    webChunksRef.current = [];
  }, []);

  const resetMedia = useCallback(async () => {
    clearDurationTimer();
    if (isNativeRecordingRef.current) {
      await audioRecorder.stop().catch(() => {});
      isNativeRecordingRef.current = false;
    }
    if (webRecorderRef.current && webRecorderRef.current.state !== 'inactive') {
      try {
        webRecorderRef.current.stop();
      } catch {
        /* already stopped */
      }
    }
    stopWebTracks();
    revokeRecordedUrl();
    needsPrepareRef.current = true;
    setIsRecording(false);
    setIsStartingRecording(false);
    setRecordingError(null);
    setRecordingDuration(0);
    setRecordedFile(null);
    setSelectedAudio(null);
    setAudioMode('record');
  }, [audioRecorder, clearDurationTimer, revokeRecordedUrl, stopWebTracks]);

  useEffect(() => () => {
    clearDurationTimer();
    if (isNativeRecordingRef.current) {
      audioRecorder.stop().catch(() => {});
      isNativeRecordingRef.current = false;
    }
    stopWebTracks();
    revokeRecordedUrl();
  }, [audioRecorder, clearDurationTimer, revokeRecordedUrl, stopWebTracks]);

  const applyAudioFile = useCallback(async (file: PickedUploadFile) => {
    if (!isAllowedAudioExtension(file.name)) {
      setRecordingError(`Please select a ${ALLOWED_AUDIO_FORMATS_LABEL} audio file`);
      return;
    }
    if (!enforceFreeUploadFileSize(file.size, isPro, contentLimits, onFileSizeBlocked)) {
      return;
    }
    await resetMedia();
    setAudioMode('upload');
    setSelectedAudio({
      ...file,
      mimeType: file.mimeType || getAudioMimeFromFilename(file.name) || 'application/octet-stream',
    });
    setRecordingError(null);
  }, [contentLimits, isPro, onFileSizeBlocked, resetMedia]);

  const pickAudio = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: AUDIO_PICKER_MIME_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    await applyAudioFile({
      uri: file.uri,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
    });
  }, [applyAudioFile]);

  const startWebRecording = useCallback(async () => {
    const nav = globalThis.navigator as Navigator | undefined;
    const MediaRecorderCtor = (globalThis as { MediaRecorder?: new (stream: MediaStream, options?: { mimeType?: string }) => MediaRecorder }).MediaRecorder;
    if (!nav?.mediaDevices?.getUserMedia || !MediaRecorderCtor) {
      setIsStartingRecording(false);
      setRecordingError('This browser cannot record audio. Use Chrome or Safari, or upload a file instead.');
      return;
    }
    try {
      const stream = await nav.mediaDevices.getUserMedia({ audio: true });
      setRecordingError(null);
      setIsStartingRecording(false);
      setRecordedFile(null);
      setSelectedAudio(null);
      revokeRecordedUrl();
      webStreamRef.current = stream;
      webChunksRef.current = [];
      const mimeType = pickSupportedRecorderMimeType();
      const recorder = mimeType ? new MediaRecorderCtor(stream, { mimeType }) : new MediaRecorderCtor(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) webChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(webChunksRef.current, { type });
        const uri = URL.createObjectURL(blob);
        recordedUrlRef.current = uri;
        setRecordedFile({
          uri,
          name: recordingFilenameForMime(type),
          mimeType: type,
          size: blob.size,
        });
        stream.getTracks().forEach((track) => track.stop());
        webStreamRef.current = null;
        webRecorderRef.current = null;
      };
      recorder.start(250);
      webRecorderRef.current = recorder;
      setAudioMode('record');
      setIsRecording(true);
      setRecordingDuration(0);
      clearDurationTimer();
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setIsStartingRecording(false);
      const name = err?.name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setRecordingError('Microphone access is blocked. Allow the mic, then click Record again.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setRecordingError('No microphone found. Connect a mic or upload an audio file.');
      } else if (name === 'NotSupportedError') {
        setRecordingError('Recording is not supported in this browser. Upload an MP3 or M4A instead.');
      } else {
        setRecordingError('Could not start recording. Allow microphone access, or upload a file instead.');
      }
    }
  }, [clearDurationTimer, revokeRecordedUrl]);

  const startNativeRecording = useCallback(async () => {
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        setIsStartingRecording(false);
        setRecordingError('Permission to access microphone is required for recording.');
        return;
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        allowsBackgroundRecording: true,
      });
      setRecordingError(null);
      setSelectedAudio(null);
      setRecordedFile(null);
      setAudioMode('record');
      setRecordingDuration(0);
      if (needsPrepareRef.current) {
        await audioRecorder.prepareToRecordAsync();
        needsPrepareRef.current = false;
      }
      await audioRecorder.record();
      isNativeRecordingRef.current = true;
      setIsStartingRecording(false);
      setIsRecording(true);
      clearDurationTimer();
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setIsStartingRecording(false);
      setIsRecording(false);
      isNativeRecordingRef.current = false;
      needsPrepareRef.current = true;
      setRecordingError(err?.message || 'Could not start recording. Allow microphone access, or upload a file instead.');
    }
  }, [audioRecorder, clearDurationTimer]);

  const handleStartRecording = useCallback(() => {
    setIsStartingRecording(true);
    setRecordingError(null);
    if (Platform.OS === 'web') {
      void startWebRecording();
      return;
    }
    void startNativeRecording();
  }, [startNativeRecording, startWebRecording]);

  const handleStopRecording = useCallback(async () => {
    clearDurationTimer();
    if (Platform.OS === 'web') {
      if (webRecorderRef.current && webRecorderRef.current.state !== 'inactive') {
        webRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }
    try {
      if (isNativeRecordingRef.current) {
        await audioRecorder.stop();
      }
    } finally {
      isNativeRecordingRef.current = false;
      needsPrepareRef.current = true;
      setIsRecording(false);
    }
    const uri = audioRecorder.uri;
    if (!uri) {
      setRecordingError("Your recording wasn't saved. Please try recording again.");
      return;
    }
    const info = await FileSystem.getInfoAsync(uri);
    const size = ((info as { size?: number }).size ?? 0) as number;
    if (!info.exists || size === 0) {
      setRecordingError("Your recording wasn't saved. Please try recording again.");
      return;
    }
    setRecordedFile({
      uri,
      name: recordingFilenameForMime('audio/mp4'),
      mimeType: 'audio/mp4',
      size,
    });
  }, [audioRecorder, clearDurationTimer]);

  const handleSubmit = useCallback(() => {
    const isRecordingUpload = audioMode === 'record' && Boolean(recordedFile);
    const file = isRecordingUpload ? recordedFile : selectedAudio;
    if (!file) return;
    if (!enforceFreeUploadFileSize(file.size, isPro, contentLimits, onFileSizeBlocked)) {
      return;
    }
    onGenerate(file, isRecordingUpload);
  }, [audioMode, recordedFile, selectedAudio, isPro, contentLimits, onFileSizeBlocked, onGenerate]);

  return (
    <HubAudioCaptureModal
      open={open}
      isProcessing={isProcessing}
      isRecording={isRecording}
      isStartingRecording={isStartingRecording}
      recordingError={recordingError}
      recordingDuration={recordingDuration}
      recordedReady={Boolean(recordedFile)}
      recordedLabel={recordedFile ? `Ready · ${Math.floor(recordingDuration / 60)}:${String(recordingDuration % 60).padStart(2, '0')}` : null}
      selectedFile={selectedAudio}
      audioMode={audioMode}
      submitError={submitError || null}
      onClose={onClose}
      onStartRecording={handleStartRecording}
      onStopRecording={() => void handleStopRecording()}
      onCancelRecording={() => void resetMedia()}
      onPickFile={() => void pickAudio()}
      onWebFile={(file) => void applyAudioFile(pickedFileFromWeb(file))}
      onSubmit={handleSubmit}
    />
  );
};

const UploadModal: React.FC<UploadModalProps> = ({
  visible,
  onDismiss,
  sourceScreenForProgress,
  folderId,
  initialOption = null,
}) => {
  const navigation = useNavigation<NavigationProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const user = useAuthStore((state) => state.user);
  const isPro = useBillingPlanStore((state) => state.isPro);
  const contentLimits = useBillingPlanStore((state) => state.contentLimits);
  const { locked: youtubeLocked } = useYoutubePasteAccess();

  const [stepOverride, setStepOverride] = useState<HubIntakeKind | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<PickedUploadFile | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uploadPDFMutation = useUploadPDF();
  const uploadAudioMutation = useUploadAudio();
  const processYouTubeMutation = useProcessYouTube();

  const step: IntakeStep = !visible
    ? 'sheet'
    : stepOverride ?? (initialOption ? OPTION_TO_STEP[initialOption] : 'sheet');

  useEffect(() => {
    if (visible) return;
    setStepOverride(null);
    setSelectedDoc(null);
    setDocError(null);
    setYoutubeUrl('');
    setError('');
    setIsSubmitting(false);
  }, [visible]);

  useEffect(() => {
    if (!visible || initialOption !== 'paste' || !youtubeLocked) return;
    onDismiss();
    showUpgradePaywall(YOUTUBE_UPGRADE_MESSAGE, YOUTUBE_LIMIT_TYPE);
  }, [visible, initialOption, youtubeLocked, onDismiss]);

  const goToProgress = useCallback(
    (jobId: string, contentTitle: string) => {
      navigation.navigate('Content', {
        screen: 'UploadProgress',
        params: {
          jobId,
          contentTitle,
          sourceScreen: sourceScreenForProgress,
          folderId,
        },
      });
      onDismiss();
    },
    [navigation, sourceScreenForProgress, folderId, onDismiss],
  );

  const handleLimit = useCallback(
    (errorMessage?: string) => {
      onDismiss();
      if (tryShowLimitPaywall(errorMessage)) return;
      showUpgradePaywall('Free uploads are exhausted. Go Pro to generate unlimited study notes.', 'monthly_uploads');
    },
    [onDismiss],
  );

  const handleFail = useCallback((contentType: string, message: string) => {
    analytics.track(EVENTS.CONTENT_UPLOAD_FAILED, { content_type: contentType, reason: 'request_error' });
    if (isBillingPlanLimitError(message)) {
      handleLimit(message);
      return;
    }
    setError(message);
    setIsSubmitting(false);
    notifyIntakeFailureSupportHint();
  }, [handleLimit]);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    onDismiss();
  }, [isSubmitting, onDismiss]);

  const handleSheetSelect = useCallback((kind: HubIntakeKind) => {
    if (kind === 'youtube' && youtubeLocked) {
      onDismiss();
      showUpgradePaywall(YOUTUBE_UPGRADE_MESSAGE, YOUTUBE_LIMIT_TYPE);
      return;
    }
    analytics.track(EVENTS.CREATE_OPTION_SELECTED, {
      option: kind === 'document' ? 'upload' : kind === 'youtube' ? 'paste' : 'record',
    });
    setError('');
    setStepOverride(kind);
  }, [youtubeLocked, onDismiss]);

  const applyDocumentFile = useCallback((file: PickedUploadFile) => {
    if (!ASCII_FILENAME.test(file.name || '')) {
      setSelectedDoc(null);
      setDocError('Invalid filename: Please use only English letters, numbers, and standard symbols.');
      return;
    }
    setDocError(null);
    if (!isAllowedDocumentUpload(file.name)) {
      setSelectedDoc(null);
      setError(DOCUMENT_UPLOAD_ERROR);
      return;
    }
    if (!enforceFreeUploadFileSize(file.size, isPro, contentLimits, (message) => {
      onDismiss();
      showUpgradePaywall(message, 'file_size');
    })) {
      return;
    }
    setSelectedDoc(file);
    setError('');
  }, [contentLimits, isPro, onDismiss]);

  const pickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: DOCUMENT_PICKER_MIME_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets[0];
    applyDocumentFile({
      uri: file.uri,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
    });
  }, [applyDocumentFile]);

  const submitDocument = useCallback(async () => {
    if (!selectedDoc || !user?.id) return;
    setIsSubmitting(true);
    setError('');
    analytics.track(EVENTS.CONTENT_UPLOAD_STARTED, { content_type: 'pdf' });
    try {
      const result = await uploadPDFMutation.mutateAsync({ file: selectedDoc, userId: user.id, folderId });
      if (result.success && result.data) {
        analytics.track(EVENTS.CONTENT_UPLOAD_SUCCEEDED, { content_type: 'pdf' });
        goToProgress(result.data.job_id, selectedDoc.name.replace(/\.[^/.]+$/, '') || 'Content');
      } else if (result.limitReached) {
        analytics.track(EVENTS.CONTENT_UPLOAD_FAILED, { content_type: 'pdf', reason: 'limit_reached' });
        handleLimit(result.message);
      } else {
        handleFail('pdf', result.message || 'Failed to upload document');
      }
    } catch (err: any) {
      handleFail('pdf', err.message || 'Failed to upload document');
    }
  }, [selectedDoc, user, uploadPDFMutation, folderId, goToProgress, handleFail, handleLimit]);

  const submitYoutube = useCallback(async () => {
    const url = youtubeUrl.trim();
    if (!url || !user?.id) return;
    const youtubeValidation = validateYouTubeUrl(url);
    if (!youtubeValidation.valid) {
      setError(youtubeValidation.message);
      return;
    }
    if (youtubeLocked) {
      onDismiss();
      showUpgradePaywall(YOUTUBE_UPGRADE_MESSAGE, YOUTUBE_LIMIT_TYPE);
      return;
    }
    setIsSubmitting(true);
    setError('');
    analytics.track(EVENTS.CONTENT_UPLOAD_STARTED, { content_type: 'youtube' });
    try {
      const result = await processYouTubeMutation.mutateAsync({ url, userId: user.id, folderId });
      if (result.success && result.data) {
        analytics.track(EVENTS.CONTENT_UPLOAD_SUCCEEDED, { content_type: 'youtube' });
        goToProgress(result.data.job_id, 'YouTube Video');
      } else if (result.limitReached) {
        analytics.track(EVENTS.CONTENT_UPLOAD_FAILED, { content_type: 'youtube', reason: 'limit_reached' });
        handleLimit(result.message);
      } else {
        handleFail('youtube', result.message || 'Failed to process YouTube video');
      }
    } catch (err: any) {
      handleFail('youtube', err.message || 'Failed to process YouTube video');
    }
  }, [youtubeUrl, user, processYouTubeMutation, folderId, goToProgress, handleFail, handleLimit, youtubeLocked, onDismiss]);

  const submitAudio = useCallback(async (file: PickedUploadFile, inAppRecording: boolean) => {
    if (!user?.id) return;
    setIsSubmitting(true);
    setError('');
    const contentType = inAppRecording ? 'audio_recording' : 'audio';
    analytics.track(EVENTS.CONTENT_UPLOAD_STARTED, { content_type: contentType });
    try {
      const payload = inAppRecording && Platform.OS !== 'web'
        ? { segments: [{ uri: file.uri, name: file.name, size: file.size || 0 }], mimeType: file.mimeType || 'audio/mp4' }
        : file;
      const result = await uploadAudioMutation.mutateAsync({
        file: payload,
        userId: user.id,
        source: inAppRecording ? IN_APP_RECORDING_SOURCE : undefined,
        folderId,
      });
      if (result.success && result.data) {
        analytics.track(EVENTS.CONTENT_UPLOAD_SUCCEEDED, { content_type: contentType });
        goToProgress(
          result.data.job_id,
          inAppRecording ? 'Audio Recording' : file.name.replace(/\.[^/.]+$/, '') || 'Audio',
        );
      } else if (result.limitReached) {
        analytics.track(EVENTS.CONTENT_UPLOAD_FAILED, { content_type: contentType, reason: 'limit_reached' });
        handleLimit(result.message);
      } else {
        handleFail(contentType, result.message || 'Failed to upload audio');
      }
    } catch (err: any) {
      handleFail(contentType, err.message || 'Failed to upload audio');
    }
  }, [user, uploadAudioMutation, folderId, goToProgress, handleFail, handleLimit]);

  const sheetOpen = visible && step === 'sheet';

  return (
    <>
      <BottomSheet visible={sheetOpen} onDismiss={handleClose} showDragHandle>
        <View style={styles.sheetHead}>
          <Text style={[styles.sheetTitle, { color: theme.colors.onSurface }]}>Create new notes</Text>
          <Pressable onPress={handleClose} hitSlop={8} accessibilityLabel="Close">
            <X size={20} strokeWidth={ICON_STROKE} color={theme.colors.onSurfaceVariant} />
          </Pressable>
        </View>
        {error ? (
          <View style={styles.sheetError}>
            <ErrorBanner message={error} onDismiss={() => setError('')} />
          </View>
        ) : null}
        <View style={styles.sheetList}>
          {CREATE_SHEET_OPTIONS.map((option) => (
            <CreateOptionListItem
              key={option.id}
              option={
                option.id === 'youtube' && youtubeLocked
                  ? { ...option, proLocked: true }
                  : option
              }
              onSelect={handleSheetSelect}
            />
          ))}
        </View>
      </BottomSheet>

      <HubDocumentUploadModal
        open={visible && step === 'document'}
        selectedFile={selectedDoc}
        fileError={docError}
        submitError={error || null}
        isProcessing={isSubmitting}
        onClose={handleClose}
        onPickFile={() => void pickDocument()}
        onWebFile={(file) => applyDocumentFile(pickedFileFromWeb(file))}
        onSubmit={() => void submitDocument()}
      />
      <HubLinkPasteModal
        open={visible && step === 'youtube'}
        value={youtubeUrl}
        isProcessing={isSubmitting}
        submitError={error || null}
        onClose={handleClose}
        onChange={setYoutubeUrl}
        onSubmit={() => void submitYoutube()}
      />
      {visible && step === 'audio' ? (
        <AudioIntakeSession
          open
          isProcessing={isSubmitting}
          submitError={error}
          onClose={handleClose}
          onGenerate={(file, inAppRecording) => void submitAudio(file, inAppRecording)}
          onFileSizeBlocked={(message) => {
            onDismiss();
            showUpgradePaywall(message, 'file_size');
          }}
          isPro={isPro}
          contentLimits={contentLimits}
        />
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sheetTitle: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 16,
  },
  sheetList: {
    marginHorizontal: -12,
    paddingBottom: 8,
  },
  sheetError: {
    marginBottom: 8,
  },
});

export default UploadModal;
