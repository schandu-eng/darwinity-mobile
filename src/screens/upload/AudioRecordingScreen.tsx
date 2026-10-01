import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Alert, Platform, AppState, AppStateStatus, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useAudioRecorder,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useAppTheme } from '@/store/appThemeStore';
import { lightTheme, darkTheme } from '@/theme';
import { useAuthStore, useBillingPlanStore } from '@/store';
import { useUploadAudio } from '@/api/queries/upload';
import { IN_APP_RECORDING_SOURCE } from '@/api/endpoints/upload';
import ErrorBanner from '@/components/ui/ErrorBanner';
import { enforceFreeUploadFileSize } from '@/utils/contentLimits';
import { tryShowLimitPaywall, showUpgradePaywall } from '@/utils/subscriptionErrorHandler';
import ConfirmModal from '@/components/ui/ConfirmModal';
import AlertModal from '@/components/ui/AlertModal';
import {
  AUDIO_PICKER_MIME_TYPES,
  ALLOWED_AUDIO_FORMATS_LABEL,
  isAllowedAudioExtension,
  getAudioMimeFromFilename,
} from '@/utils/audioFormats';
import type { ContentStackParamList } from '@/types/navigation';
import { analytics } from '@/analytics/analytics';
import { EVENTS } from '@/analytics/events';
import { notifyIntakeFailureSupportHint } from '@/store/intakeFailureSupportHintStore';

import { Fonts } from '@/config/fonts';
import { USE_NATIVE_DRIVER } from '@/theme/webCompat';

type AudioRecordingNavigationProp = NativeStackNavigationProp<ContentStackParamList, 'AudioRecording'>;
type AudioRecordingRouteProp = RouteProp<ContentStackParamList, 'AudioRecording'>;

const WAVEFORM_BAR_COUNT = 16;
const WAVEFORM_BAR_HEIGHT = 120;
const DURATION_TICK_MS = 1000;

const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const WaveformBar: React.FC<{ index: number; color: string; active: boolean }> = ({
  index,
  color,
  active,
}) => {
  const scale = useRef(new Animated.Value(0.28)).current;

  useEffect(() => {
    if (!active) {
      scale.stopAnimation();
      scale.setValue(0.28);
      return undefined;
    }
    const duration = 380 + (index % 6) * 55;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(scale, {
          toValue: 0.26,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );
    const start = setTimeout(() => loop.start(), index * 35);
    return () => {
      clearTimeout(start);
      loop.stop();
    };
  }, [active, index, scale]);

  return (
    <Animated.View
      style={[
        styles.waveformBar,
        {
          backgroundColor: color,
          height: WAVEFORM_BAR_HEIGHT,
          transform: [{ scaleY: scale }],
        },
      ]}
    />
  );
};

const AudioWaveform: React.FC<{ isRecording: boolean; isPaused?: boolean; theme: any }> = ({
  isRecording,
  isPaused,
  theme,
}) => (
  <View style={styles.waveformContainer}>
    <View style={[styles.waveformBars, { height: WAVEFORM_BAR_HEIGHT }]}>
      {Array.from({ length: WAVEFORM_BAR_COUNT }, (_, i) => (
        <WaveformBar
          key={i}
          index={i}
          color={theme.colors.primary}
          active={isRecording && !isPaused}
        />
      ))}
    </View>
  </View>
);

const AudioRecordingScreen: React.FC = () => {
  const navigation = useNavigation<AudioRecordingNavigationProp>();
  const route = useRoute<AudioRecordingRouteProp>();
  const themeMode = useAppTheme();
  const theme = themeMode === 'dark' ? darkTheme : lightTheme;
  const user = useAuthStore((state) => state.user);
  const folderId = route.params?.folderId;
  const isPro = useBillingPlanStore((state) => state.isPro);
  const contentLimits = useBillingPlanStore((state) => state.contentLimits);
  const uploadAudioMutation = useUploadAudio();

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [hasStartedRecording, setHasStartedRecording] = useState(false);
  const [error, setError] = useState('');
  const [alertModal, setAlertModal] = useState({ visible: false, title: '', message: '' });
  const [discardModalVisible, setDiscardModalVisible] = useState(false);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const totalPausedTimeRef = useRef<number>(0);
  const pauseStartTimeRef = useRef<number | null>(null);
  const isNativeRecordingRef = useRef(false);
  const needsPrepareBeforeRecordRef = useRef(true);
  const segmentUrisRef = useRef<string[]>([]);

  const FILE_READY_TIMEOUT_MS = 5000;
  const FILE_READY_POLL_MS = 100;

  useEffect(() => {
    const routeError = route.params?.error;
    if (!routeError) return;
    navigation.setParams({ error: undefined });
    if (tryShowLimitPaywall(routeError)) {
      return;
    }
    setError(routeError);
  }, [route.params?.error, navigation]);

  const isRecording = hasStartedRecording && !isPaused;

  const waitForFileReady = useCallback(async (uri: string): Promise<{ exists: boolean; size: number }> => {
    const deadline = Date.now() + FILE_READY_TIMEOUT_MS;
    let info = await FileSystem.getInfoAsync(uri);
    while ((!info.exists || ((info as any).size ?? 0) === 0) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, FILE_READY_POLL_MS));
      info = await FileSystem.getInfoAsync(uri);
    }
    return { exists: !!info.exists, size: ((info as any).size ?? 0) as number };
  }, []);

  const finalizeCurrentSegment = useCallback(async (): Promise<boolean> => {
    if (!isNativeRecordingRef.current) return false;
    try {
      await audioRecorder.stop();
    } finally {
      isNativeRecordingRef.current = false;
      needsPrepareBeforeRecordRef.current = true;
    }
    const uri = audioRecorder.uri;
    if (!uri) return false;
    const info = await waitForFileReady(uri);
    if (!info.exists || info.size === 0) return false;
    segmentUrisRef.current.push(uri);
    return true;
  }, [audioRecorder, waitForFileReady]);
  const showAlert = useCallback((title: string, message: string) => {
    setAlertModal({ visible: true, title, message });
  }, []);

  const calculateElapsedSeconds = useCallback((): number => {
    if (!recordingStartTimeRef.current) {
      return 0;
    }

    const now = Date.now();
    const totalElapsed = Math.floor((now - recordingStartTimeRef.current) / 1000);
    
    let currentPausedTime = 0;
    if (pauseStartTimeRef.current) {
      currentPausedTime = Math.floor((now - pauseStartTimeRef.current) / 1000);
    }
    
    return Math.max(0, totalElapsed - totalPausedTimeRef.current - currentPausedTime);
  }, []);

  const updateRecordingDuration = useCallback(() => {
    const elapsed = calculateElapsedSeconds();
    setRecordingDuration(elapsed);
  }, [calculateElapsedSeconds]);

  const clearTimerInterval = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (recordingStartTimeRef.current && hasStartedRecording && !isPaused) {
        updateRecordingDuration();
        clearTimerInterval();
        if (!durationIntervalRef.current) {
          durationIntervalRef.current = setInterval(updateRecordingDuration, DURATION_TICK_MS);
        }
      }
    }, [hasStartedRecording, isPaused, updateRecordingDuration, clearTimerInterval])
  );

  const resetTimestampTracking = useCallback(() => {
    recordingStartTimeRef.current = null;
    totalPausedTimeRef.current = 0;
    pauseStartTimeRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      if (audioRecorder && isNativeRecordingRef.current) {
        audioRecorder.stop().catch(() => {});
      }
      needsPrepareBeforeRecordRef.current = true;
      clearTimerInterval();
    };
  }, [audioRecorder, clearTimerInterval]);

  useEffect(() => {
    (async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) {
          Alert.alert('Permission Required', 'Permission to access microphone is required for recording.');
          return;
        }

        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
          allowsBackgroundRecording: true,
        });
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to initialize audio recording');
      }
    })();
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        if (recordingStartTimeRef.current && hasStartedRecording && !isPaused) {
          updateRecordingDuration();
          clearTimerInterval();
          if (!durationIntervalRef.current) {
            durationIntervalRef.current = setInterval(updateRecordingDuration, DURATION_TICK_MS);
          }
        } else if (isPaused && pauseStartTimeRef.current) {
          const now = Date.now();
          const pauseDuration = Math.floor((now - pauseStartTimeRef.current) / 1000);
          totalPausedTimeRef.current += pauseDuration;
          pauseStartTimeRef.current = now;
        }
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        clearTimerInterval();
        if (isPaused && pauseStartTimeRef.current) {
          const now = Date.now();
          const pauseDuration = Math.floor((now - pauseStartTimeRef.current) / 1000);
          totalPausedTimeRef.current += pauseDuration;
          pauseStartTimeRef.current = now;
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [hasStartedRecording, isPaused, updateRecordingDuration, clearTimerInterval]);

  const handleBack = useCallback(() => {
    if (hasStartedRecording) {
      showAlert(
        'Recording in Progress',
        'Please discard the recording or generate notes before going back.'
      );
      return;
    }
    navigation.goBack();
  }, [hasStartedRecording, navigation, showAlert]);

  const handleUploadAudioFile = useCallback(async () => {
    if (hasStartedRecording) {
      showAlert(
        'Recording in Progress',
        'Please discard the recording or generate notes before uploading a file.'
      );
      return;
    }

    setError('');

    try {
      if (!user?.id) {
        Alert.alert('Error', 'User not found. Please login again.');
        return;
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: AUDIO_PICKER_MIME_TYPES,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      if (!isAllowedAudioExtension(file.name)) {
        showAlert('', `Please select a ${ALLOWED_AUDIO_FORMATS_LABEL} audio file`);
        return;
      }
      if (!enforceFreeUploadFileSize(file.size, isPro, contentLimits, (message) => {
        showUpgradePaywall(message, 'file_size');
      })) {
        return;
      }

      const uploadFile = {
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType || getAudioMimeFromFilename(file.name) || 'application/octet-stream',
        size: file.size || 0,
      };

      try {
        analytics.track(EVENTS.CONTENT_UPLOAD_STARTED, { content_type: 'audio' });
        const uploadResult = await uploadAudioMutation.mutateAsync({ file: uploadFile, userId: user.id, folderId });

        if (uploadResult.success && uploadResult.data) {
          analytics.track(EVENTS.CONTENT_UPLOAD_SUCCEEDED, { content_type: 'audio' });
          navigation.navigate('UploadProgress', {
            jobId: uploadResult.data.job_id,
            contentTitle: 'Audio Recording',
            sourceScreen: 'AudioRecording',
            folderId,
          });
        } else if (uploadResult.limitReached) {
          analytics.track(EVENTS.CONTENT_UPLOAD_FAILED, { content_type: 'audio', reason: 'limit_reached' });
          return;
        } else {
          analytics.track(EVENTS.CONTENT_UPLOAD_FAILED, { content_type: 'audio', reason: 'request_error' });
          notifyIntakeFailureSupportHint();
          Alert.alert('Error', uploadResult.message || 'Failed to upload audio file');
        }
      } catch (err: any) {
        analytics.track(EVENTS.CONTENT_UPLOAD_FAILED, { content_type: 'audio', reason: 'request_error' });
        notifyIntakeFailureSupportHint();
        Alert.alert('Error', err.message || 'Failed to upload audio file');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to pick audio file');
    }
  }, [hasStartedRecording, user, uploadAudioMutation, navigation, showAlert, folderId]);

  useEffect(() => {
    const running = hasStartedRecording && recordingStartTimeRef.current && !isPaused;
    if (running) {
      if (!durationIntervalRef.current) {
        updateRecordingDuration();
        durationIntervalRef.current = setInterval(updateRecordingDuration, DURATION_TICK_MS);
      }
    } else {
      clearTimerInterval();
      if (recordingStartTimeRef.current) {
        updateRecordingDuration();
      }
    }
    return clearTimerInterval;
  }, [hasStartedRecording, isPaused, updateRecordingDuration, clearTimerInterval]);

  const startRecording = useCallback(async () => {
    try {
      setIsPaused(false);
      setRecordingDuration(0);
      setError('');
      setHasStartedRecording(true);
      segmentUrisRef.current = [];

      recordingStartTimeRef.current = Date.now();
      totalPausedTimeRef.current = 0;
      pauseStartTimeRef.current = null;

      if (needsPrepareBeforeRecordRef.current) {
        await audioRecorder.prepareToRecordAsync();
        needsPrepareBeforeRecordRef.current = false;
      }
      await audioRecorder.record();
      isNativeRecordingRef.current = true;
    } catch (err: any) {
      setHasStartedRecording(false);
      isNativeRecordingRef.current = false;
      needsPrepareBeforeRecordRef.current = true;
      resetTimestampTracking();
      Alert.alert('Error', err.message || 'Failed to start recording');
    }
  }, [audioRecorder, resetTimestampTracking]);

  const pauseRecording = useCallback(async () => {
    try {
      if (!isNativeRecordingRef.current) return;
      pauseStartTimeRef.current = Date.now();
      setIsPaused(true);
      await finalizeCurrentSegment();
    } catch (err: any) {
      pauseStartTimeRef.current = null;
      setIsPaused(false);
      Alert.alert('Error', err.message || 'Failed to pause recording');
    }
  }, [finalizeCurrentSegment]);

  const resumeRecording = useCallback(async () => {
    try {
      if (pauseStartTimeRef.current) {
        const now = Date.now();
        const pauseDuration = Math.floor((now - pauseStartTimeRef.current) / 1000);
        totalPausedTimeRef.current += pauseDuration;
        pauseStartTimeRef.current = null;
      }
      setIsPaused(false);
      if (needsPrepareBeforeRecordRef.current) {
        await audioRecorder.prepareToRecordAsync();
        needsPrepareBeforeRecordRef.current = false;
      }
      await audioRecorder.record();
      isNativeRecordingRef.current = true;
    } catch (err: any) {
      setIsPaused(true);
      Alert.alert('Error', err.message || 'Failed to resume recording');
    }
  }, [audioRecorder]);

  const stopRecording = useCallback(async () => {
    try {
      await finalizeCurrentSegment();
      updateRecordingDuration();
      resetTimestampTracking();
    } catch (err: any) {
      resetTimestampTracking();
      isNativeRecordingRef.current = false;
      needsPrepareBeforeRecordRef.current = true;
      Alert.alert('Error', err.message || 'Failed to stop recording');
    }
  }, [finalizeCurrentSegment, updateRecordingDuration, resetTimestampTracking]);

  const handlePauseResume = useCallback(async () => {
    if (isRecording) {
      await pauseRecording();
    } else if (isPaused) {
      await resumeRecording();
    }
  }, [isRecording, isPaused, pauseRecording, resumeRecording]);

  const handleDiscardAudio = useCallback(async () => {
    setDiscardModalVisible(true);
  }, []);

  const handleGenerateNotes = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not found. Please login again.');
      return;
    }
    setError('');
    if (isRecording) {
      await stopRecording();
    }

    const segmentUris = segmentUrisRef.current.slice();
    const validSegments: { uri: string; name: string; size: number }[] = [];
    let totalSize = 0;
    for (let i = 0; i < segmentUris.length; i += 1) {
      const uri = segmentUris[i];
      const info = await FileSystem.getInfoAsync(uri);
      const size = ((info as any).size ?? 0) as number;
      if (info.exists && size > 0) {
        validSegments.push({
          uri,
          name: `recording-${Date.now()}-${i}.m4a`,
          size,
        });
        totalSize += size;
      }
    }

    if (validSegments.length === 0) {
      Alert.alert('Error', "Your recording wasn't saved. Please try recording again.");
      return;
    }

    if (!enforceFreeUploadFileSize(totalSize, isPro, contentLimits, (message) => {
      showUpgradePaywall(message, 'file_size');
    })) {
      return;
    }

    try {
      analytics.track(EVENTS.CONTENT_UPLOAD_STARTED, { content_type: 'audio_recording' });
      const uploadResult = await uploadAudioMutation.mutateAsync({
        file: { segments: validSegments, mimeType: 'audio/mp4' },
        userId: user.id,
        source: IN_APP_RECORDING_SOURCE,
        folderId,
      });
      if (uploadResult.success && uploadResult.data) {
        analytics.track(EVENTS.CONTENT_UPLOAD_SUCCEEDED, { content_type: 'audio_recording' });
        navigation.navigate('UploadProgress', {
          jobId: uploadResult.data.job_id,
          contentTitle: 'Audio Recording',
          sourceScreen: 'AudioRecording',
          folderId,
        });
      } else if (uploadResult.limitReached) {
        analytics.track(EVENTS.CONTENT_UPLOAD_FAILED, { content_type: 'audio_recording', reason: 'limit_reached' });
        return;
      } else {
        analytics.track(EVENTS.CONTENT_UPLOAD_FAILED, { content_type: 'audio_recording', reason: 'request_error' });
        notifyIntakeFailureSupportHint();
        Alert.alert('Error', uploadResult.message || 'Failed to process audio recording');
      }
    } catch (err: any) {
      analytics.track(EVENTS.CONTENT_UPLOAD_FAILED, { content_type: 'audio_recording', reason: 'request_error' });
      notifyIntakeFailureSupportHint();
      Alert.alert('Error', err.message || 'Failed to process audio recording');
    }
  }, [isRecording, user, uploadAudioMutation, navigation, stopRecording, folderId]);

  const handleConfirmDiscard = useCallback(async () => {
    setDiscardModalVisible(false);
    if (hasStartedRecording || isNativeRecordingRef.current) {
      await audioRecorder.stop().catch(() => {});
      isNativeRecordingRef.current = false;
    }
    needsPrepareBeforeRecordRef.current = true;

    const urisToDelete = segmentUrisRef.current.slice();
    segmentUrisRef.current = [];
    for (const uri of urisToDelete) {
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }

    setRecordingDuration(0);
    setIsPaused(false);
    setHasStartedRecording(false);

    clearTimerInterval();
    resetTimestampTracking();
  }, [audioRecorder, clearTimerInterval, hasStartedRecording, resetTimestampTracking]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.colors.onSurface} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>Live Recording</Text>
          <TouchableOpacity onPress={handleUploadAudioFile} activeOpacity={0.7}>
            <View style={styles.uploadLinkContainer}>
              <MaterialCommunityIcons name="cloud-upload" size={16} color={theme.colors.primary} />
              <Text style={[styles.uploadLinkText, { color: theme.colors.primary }]}>Upload Audio File</Text>
            </View>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight} />
      </View>

      {error ? (
        <View style={styles.errorBannerContainer}>
          <ErrorBanner message={error} onDismiss={() => setError('')} />
        </View>
      ) : null}

      <AlertModal
        visible={alertModal.visible}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal({ visible: false, title: '', message: '' })}
      />
      <ConfirmModal
        visible={discardModalVisible}
        title="Discard Recording"
        message="Are you sure you want to discard this recording?"
        confirmText="Discard"
        cancelText="Cancel"
        destructive
        onConfirm={handleConfirmDiscard}
        onCancel={() => setDiscardModalVisible(false)}
      />

      <View style={styles.content}>
        <AudioWaveform isRecording={isRecording} isPaused={isPaused} theme={theme} />
      </View>

      <View style={[styles.controlsContainer, { backgroundColor: theme.colors.surface }]}>

        <View style={styles.timerRow}>
          {isRecording ? <View style={styles.recDot} /> : null}
          <Text style={[styles.timer, { color: theme.colors.onSurface }]}>
            {formatTime(recordingDuration)}
          </Text>
        </View>

        {!hasStartedRecording ? (
          <TouchableOpacity
            style={[styles.recordButton, { backgroundColor: theme.colors.surfaceVariant }]}
            onPress={startRecording}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="microphone" size={24} color={theme.colors.onSurfaceVariant} />
            <Text style={[styles.recordButtonText, { color: theme.colors.onSurfaceVariant }]}>
              Start Recording
            </Text>
          </TouchableOpacity>
        ) : (
          <>
            {(isRecording || isPaused) && (
              <TouchableOpacity
                style={[styles.recordButton, { backgroundColor: theme.colors.surfaceVariant }]}
                onPress={handlePauseResume}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={isPaused ? 'play' : 'pause'}
                  size={24}
                  color={theme.colors.onSurface}
                />
                <Text style={[styles.recordButtonText, { color: theme.colors.onSurface }]}>
                  {isPaused ? 'Resume Recording' : 'Pause Recording'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.discardButton}
              onPress={handleDiscardAudio}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="delete" size={18} color={theme.colors.error} />
              <Text style={[styles.discardText, { color: theme.colors.error }]}>Discard Audio</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.generateButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleGenerateNotes}
              disabled={uploadAudioMutation.isPending}
              activeOpacity={0.8}
            >
              <Text style={[styles.generateButtonText, { color: theme.colors.onPrimary }]}>
                Generate Notes
              </Text>
            </TouchableOpacity>
          </>
        )}
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginTop: -2,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.ui.bold,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  uploadLinkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  uploadLinkText: {
    fontSize: 15,
    fontFamily: Fonts.ui.medium,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  headerRight: {
    width: 44,
  },
  errorBannerContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  waveformContainer: {
    height: 200,
    width: '100%',
    marginBottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveformBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    width: '80%',
  },
  waveformBar: {
    flex: 1,
    borderRadius: 4,
    transformOrigin: 'bottom',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandText: {
    fontSize: 16,
    fontFamily: Fonts.ui.medium,
    letterSpacing: 0.5,
  },
  controlsContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 56,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  timer: {
    fontSize: 18,
    fontWeight: '400',
    textAlign: 'center',
    fontFamily: Fonts.ui.regular,
    marginBottom: 0,
    letterSpacing: 2,
  },
  recordButton: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  recordButtonText: {
    fontSize: 16,
    fontFamily: Fonts.ui.semiBold,
  },
  discardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    marginTop: 12,
  },
  discardText: {
    fontSize: 15,
    fontFamily: Fonts.ui.medium,
  },
  generateButton: {
    width: '100%',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  generateButtonText: {
    fontSize: 16,
    fontFamily: Fonts.ui.semiBold,
  },
});

export default AudioRecordingScreen;
