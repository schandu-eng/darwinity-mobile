import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Dimensions, Pressable, Animated } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayerStatus } from 'expo-audio';
import Slider from '@react-native-community/slider';
import { boxShadow, USE_NATIVE_DRIVER } from '@/theme/webCompat';
import { useAuthStore } from '@/store';
import { Pause, Play, Podcast, Quote, SkipBack, SkipForward } from '@/icons';
import { usePodcastPlayback } from '@/features/podcast/PodcastPlaybackContext';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { useGeneratePodcast, usePodcastJobStatus } from '@/api/queries/studyHub';
import { useContent, usePodcastUrl } from '@/api/queries/content';
import { contentService } from '@/services/contentService';
import StudyGenerationProcessingScreen from './StudyGenerationProcessingScreen';
import { hasValidSectionSelection } from '@shared/summaryNotes.js';
import { SkeletonBase } from '@/components/ui/skeleton';
import { getActiveTurnIndex, getHostLabel, normalizePodcastScript } from '@/utils/podcastTranscript';
import { QuizEmptyScene } from './QuizEmptyScene';
import { StudyPillButton } from './StudyPillButton';
import {
  STUDY_BORDER,
  STUDY_INK,
  STUDY_ZINC_500,
} from './studyPanelTokens';

interface AudioLessonTabProps {
  contentId: number;
  visible?: boolean;
  onPodcastDisplayedChange?: (displayed: boolean) => void;
  playerTopPadding?: number;
  holdProcessing?: boolean;
  onHoldProcessingChange?: (hold: boolean) => void;
}

const AudioLessonTab: React.FC<AudioLessonTabProps> = ({
  contentId,
  visible = true,
  onPodcastDisplayedChange,
  playerTopPadding = 24,
  holdProcessing: holdProcessingProp,
  onHoldProcessingChange,
}) => {
  const user = useAuthStore((state) => state.user);
  const playback = usePodcastPlayback();

  const { data: contentData, isLoading: isLoadingContent, refetch: refetchContent } = useContent(contentId);
  const content = contentData?.data;

  const {
    data: podcastUrlData,
    refetch: refetchPodcastUrl,
    isPending: isPodcastUrlPending,
  } = usePodcastUrl(contentId);

  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [generationJobId, setGenerationJobId] = useState<string | null>(null);
  const [localHoldProcessing, setLocalHoldProcessing] = useState(false);
  const [, setError] = useState('');

  const holdProcessing = holdProcessingProp ?? localHoldProcessing;
  const setHoldProcessing = onHoldProcessingChange ?? setLocalHoldProcessing;

  const podcastUrl = podcastUrlData?.data?.podcast_url ?? content?.podcast_url ?? null;
  const player = playback.player;
  const status = useAudioPlayerStatus(player);
  const currentTime = status.currentTime || 0;
  const duration = status.duration || 0;
  const isPlaying = status.playing;
  const audioReady = Boolean(podcastUrl && status.isLoaded);

  const [showTranscript, setShowTranscript] = useState(false);
  const transcript = useMemo(() => {
    return normalizePodcastScript(
      podcastUrlData?.data?.podcast_script ?? content?.podcast_script ?? null,
      content?.podcast_raw_script ?? null,
      duration,
    );
  }, [podcastUrlData?.data?.podcast_script, content?.podcast_script, content?.podcast_raw_script, duration]);

  const activeTurnIndex = useMemo(
    () => getActiveTurnIndex(transcript?.turns ?? [], currentTime),
    [transcript?.turns, currentTime],
  );

  const transcriptScrollRef = useRef<ScrollView | null>(null);
  const transcriptYByIndexRef = useRef<Record<number, number>>({});

  useEffect(() => {
    if (!showTranscript) return;
    if (activeTurnIndex < 0) return;
    const y = transcriptYByIndexRef.current[activeTurnIndex];
    if (y == null) return;
    transcriptScrollRef.current?.scrollTo({ y, animated: true });
  }, [activeTurnIndex, showTranscript]);

  const generatePodcastMutation = useGeneratePodcast();
  const { data: jobStatusData } = usePodcastJobStatus(generationJobId);

  const jobStatus = jobStatusData?.data;
  const isResolvingPodcast = !podcastUrl && isPodcastUrlPending;

  useEffect(() => {
    playback.setOnPodcastTab(visible);
    return () => playback.setOnPodcastTab(false);
  }, [playback, visible]);

  useEffect(() => {
    if (!podcastUrl) return;
    playback.attach({
      url: podcastUrl,
      contentId,
      title: content?.title || 'Your Study Podcast',
    });
  }, [content?.title, contentId, playback, podcastUrl]);

  useEffect(() => {
    if (!status.isLoaded) return;
    if (player.playbackRate !== playbackSpeed) {
      player.setPlaybackRate(playbackSpeed);
    }
  }, [player, playbackSpeed, status.isLoaded]);

  const checkForPendingJob = useCallback(async () => {
    if (!user?.id || !contentId || generationJobId) return;

    try {
      const result = await contentService.getUserJobs(user.id, 'podcast_generation', contentId);
      if (result.success && result.data) {
        const pendingJob = result.data.find((job) => {
          if (job.status !== 'pending' && job.status !== 'processing') return false;
          if (!job.created_at) return true;
          const ageMs = Date.now() - new Date(job.created_at).getTime();
          return Number.isFinite(ageMs) && ageMs < 10 * 60 * 1000;
        });

        if (pendingJob && pendingJob.job_id) {
          setGenerationJobId(pendingJob.job_id);
        }
      }
    } catch (error) {
      console.error('Failed to check for pending podcast jobs:', error);
    }
  }, [user?.id, contentId, generationJobId]);

  React.useEffect(() => {
    checkForPendingJob();
  }, [checkForPendingJob]);

  const chapters = useMemo(() => content?.chapters || [], [content?.chapters]);

  const isGenerating = generatePodcastMutation.isPending || generationJobId !== null || jobStatus?.status === 'processing' || jobStatus?.status === 'pending';

  const canGenerate = hasValidSectionSelection({
    chapterCount: chapters.length,
    selectedChapterIds: null,
  });
  const isGenerateDisabled = isGenerating || !canGenerate;

  useEffect(() => {
    if (jobStatus?.status === 'completed' && jobStatus.result?.podcast_url) {
      setGenerationJobId(null);
      refetchPodcastUrl();
      refetchContent();
    } else if (jobStatus?.status === 'failed' || jobStatus?.status === 'blocked') {
      setGenerationJobId(null);
      setError(jobStatus.user_message || 'Podcast generation failed');
    } else if (
      generationJobId &&
      jobStatusData &&
      jobStatusData.success === false &&
      jobStatusData.message === 'Job not found'
    ) {
      setGenerationJobId(null);
    }
  }, [jobStatus, jobStatusData, generationJobId, refetchPodcastUrl, refetchContent]);

  const handleGenerate = useCallback(async () => {
    if (!user?.id) {
      setError('User not found. Please login again.');
      return;
    }

    setError('');

    try {
      const result = await generatePodcastMutation.mutateAsync({
        contentId,
        userId: user.id,
        chapterIds: null,
      });

      if (result.success && result.data?.job_id) {
        setGenerationJobId(result.data.job_id);
      } else {
        setError(result.message || 'Failed to generate podcast');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate podcast');
    }
  }, [contentId, user, generatePodcastMutation]);

  const togglePlayPause = playback.togglePlayPause;

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    try {
      player.setPlaybackRate(speed);
    } catch {
      Alert.alert('Error', 'Failed to change playback speed');
    }
  }, [player]);

  const handleRewind = useCallback(async () => {
    if (!audioReady) return;
    try {
      await player.seekTo(Math.max(0, currentTime - 15));
    } catch {
      Alert.alert('Error', 'Failed to rewind');
    }
  }, [audioReady, currentTime, player]);

  const handleForward = useCallback(async () => {
    if (!audioReady) return;
    try {
      await player.seekTo(Math.min(duration || currentTime + 30, currentTime + 30));
    } catch {
      Alert.alert('Error', 'Failed to forward');
    }
  }, [audioReady, currentTime, duration, player]);

  const AnimatedPressable: React.FC<{
    onPress?: () => void;
    disabled?: boolean;
    style?: any;
    children: React.ReactNode;
    hitSlop?: { top: number; bottom: number; left: number; right: number };
  }> = ({ onPress, disabled, style, children, hitSlop }) => {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.spring(scale, {
        toValue: 0.96,
        useNativeDriver: USE_NATIVE_DRIVER,
        speed: 20,
        bounciness: 6,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
        speed: 18,
        bounciness: 6,
      }).start();
    };

    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        hitSlop={hitSlop}
      >
        <Animated.View style={[style, { transform: [{ scale }] }]}>
          {children}
        </Animated.View>
      </Pressable>
    );
  };

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleSeek = useCallback(
    async (value: number) => {
      if (!audioReady || duration === 0) return;
      try {
        await player.seekTo(value);
      } catch {
        Alert.alert('Error', 'Failed to seek');
      }
    },
    [audioReady, duration, player]
  );

  const handleSeekToTurn = useCallback(
    async (startSeconds: number) => {
      if (!audioReady) return;
      try {
        await player.seekTo(Math.max(0, startSeconds));
      } catch {
        Alert.alert('Error', 'Failed to seek');
      }
    },
    [audioReady, player],
  );

  const isLoading = useMemo(
    () => isLoadingContent || isResolvingPodcast || Boolean(podcastUrl && !status.isLoaded),
    [isLoadingContent, isResolvingPodcast, podcastUrl, status.isLoaded]
  );

  useEffect(() => {
    if (holdProcessing && !isGenerating && !isLoading) {
      setHoldProcessing(false);
    }
  }, [holdProcessing, isGenerating, isLoading, setHoldProcessing]);

  useEffect(() => {
    if (onPodcastDisplayedChange) {
      const arePodcastsDisplayed =
        !isGenerating &&
        (!!podcastUrl || isResolvingPodcast) &&
        (!holdProcessing || !isLoading);
      onPodcastDisplayedChange(arePodcastsDisplayed);
    }
  }, [isGenerating, podcastUrl, isResolvingPodcast, isLoading, holdProcessing, onPodcastDisplayedChange]);

  const coverSize = useMemo(() => {
    const screenWidth = Dimensions.get('window').width;
    return Math.min(screenWidth - 40, 288);
  }, []);

  if (isGenerating || (holdProcessing && isLoading)) {
    return (
      <StudyGenerationProcessingScreen
        serviceType="podcast"
        progress={jobStatus?.progress}
      />
    );
  }

  if (!podcastUrl && !isResolvingPodcast) {
    return (
      <ScrollView
        style={[styles.container, styles.stage]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.setupInner, styles.setupCard]}>
          <QuizEmptyScene />
          <Text style={styles.setupKicker}>Audio review</Text>
          <Text style={[styles.setupTitle, { color: STUDY_INK }]}>Ready to generate</Text>
          <Text style={[styles.setupSubtitle, { color: STUDY_ZINC_500 }]}>
            We'll craft a podcast from your notes — tap generate and listen while you revise.
          </Text>
          <View style={{ marginTop: 16, width: '100%' }}>
            <StudyPillButton
              label="Generate podcast"
              disabled={isGenerateDisabled}
              onPress={handleGenerate}
            />
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, styles.stage]}>
      <View style={[styles.stageInner, { paddingTop: Math.max(12, playerTopPadding - 8) }]}>
        <View style={styles.playerBody}>
          <View style={[styles.cover, { width: coverSize, height: coverSize }]}>
            {isLoading ? (
              <SkeletonBase style={styles.coverFill} />
            ) : (
              <LinearGradient
                colors={['#1A2F23', '#3F6B4F', '#7A9E86']}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.coverFill}
              >
                <View style={styles.coverGlow} />
                <View style={[styles.coverIcon, isPlaying && styles.coverIconPlaying]}>
                  <Podcast size={40} strokeWidth={1.4} color="rgba(255,255,255,0.92)" />
                </View>
              </LinearGradient>
            )}
          </View>

          {isLoading ? (
            <View style={styles.titleSkeleton}>
              <SkeletonBase />
            </View>
          ) : (
            <Text style={styles.playerTitle}>
              {content?.title || 'Your Study Podcast'}
            </Text>
          )}

          <View style={styles.seekBlock}>
            {isLoading ? (
              <SkeletonBase style={styles.slider} />
            ) : (
              <>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={duration || 1}
                  value={currentTime}
                  onSlidingComplete={handleSeek}
                  minimumTrackTintColor="#1A2F23"
                  maximumTrackTintColor="#E4E4E7"
                  thumbTintColor="#1A2F23"
                  disabled={!audioReady || duration === 0}
                />
                <View style={styles.seekTimes}>
                  <Text style={styles.seekTime}>{formatTime(currentTime)}</Text>
                  <Text style={styles.seekTime}>
                    -{formatTime(Math.max(0, duration - currentTime))}
                  </Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.controlsStage}>
            <View style={[styles.controlsSide, styles.controlsSideLeft]}>
              {isLoading ? (
                <View style={styles.skipButton}><SkeletonBase /></View>
              ) : (
                <AnimatedPressable
                  onPress={handleRewind}
                  style={styles.skipButton}
                  disabled={!audioReady}
                  accessibilityLabel="Rewind 15 seconds"
                >
                  <SkipBack size={22} strokeWidth={ICON_STROKE} color="#52525b" />
                  <Text style={styles.skipLabel}>15</Text>
                </AnimatedPressable>
              )}
            </View>

            {isLoading ? (
              <View style={styles.playButton}><SkeletonBase /></View>
            ) : (
              <AnimatedPressable
                onPress={togglePlayPause}
                style={styles.playButton}
                disabled={!audioReady}
                accessibilityLabel={isPlaying ? 'Pause podcast' : 'Play podcast'}
              >
                {isPlaying ? (
                  <Pause size={28} strokeWidth={2} color="#fff" fill="#fff" />
                ) : (
                  <Play size={28} strokeWidth={2} color="#fff" fill="#fff" />
                )}
              </AnimatedPressable>
            )}

            <View style={[styles.controlsSide, styles.controlsSideRight]}>
              {isLoading ? (
                <View style={styles.skipButton}><SkeletonBase /></View>
              ) : (
                <AnimatedPressable
                  onPress={handleForward}
                  style={styles.skipButton}
                  disabled={!audioReady}
                  accessibilityLabel="Forward 30 seconds"
                >
                  <SkipForward size={22} strokeWidth={ICON_STROKE} color="#52525b" />
                  <Text style={styles.skipLabel}>30</Text>
                </AnimatedPressable>
              )}
            </View>

            {!isLoading ? (
              <AnimatedPressable
                onPress={() => {
                  const speeds = [0.5, 1, 1.5, 1.75, 2];
                  const currentIndex = speeds.indexOf(playbackSpeed);
                  handleSpeedChange(speeds[(currentIndex + 1) % speeds.length]);
                }}
                style={styles.speedButton}
                disabled={!audioReady}
                accessibilityLabel={`Playback speed ${playbackSpeed}x`}
              >
                <Text style={styles.speedText}>{playbackSpeed}x</Text>
              </AnimatedPressable>
            ) : null}
          </View>

          <View style={styles.transcriptToggleRow}>
            <TouchableOpacity
              onPress={() => setShowTranscript((v) => !v)}
              activeOpacity={0.85}
              style={styles.transcriptToggleBtn}
            >
              <Quote size={18} strokeWidth={1.75} color="#3f4a44" />
              <Text style={styles.transcriptToggleText}>
                {showTranscript ? 'Hide Transcript' : 'Show Transcript'}
              </Text>
            </TouchableOpacity>
          </View>

          {showTranscript ? (
            <ScrollView
              ref={(el) => {
                transcriptScrollRef.current = el;
              }}
              style={styles.transcriptBox}
              contentContainerStyle={styles.transcriptBoxContent}
              showsVerticalScrollIndicator={false}
            >
              {transcript?.turns?.length ? (
                transcript.turns.map((turn, idx) => {
                  const isActive = idx === activeTurnIndex;
                  return (
                    <Pressable
                      key={`${turn.start}-${idx}`}
                      onPress={() => handleSeekToTurn(turn.start)}
                      onLayout={(e) => {
                        transcriptYByIndexRef.current[idx] = e.nativeEvent.layout.y;
                      }}
                      style={[styles.transcriptLine, isActive && styles.transcriptLineActive]}
                    >
                      <Text style={styles.transcriptSpeaker}>
                        {getHostLabel(transcript.hosts, turn.speaker)}
                      </Text>
                      <Text style={styles.transcriptText} numberOfLines={6}>
                        {turn.text}
                      </Text>
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.transcriptEmpty}>
                  <Text style={styles.transcriptEmptyText}>
                    Conversation transcript unavailable for this podcast.
                  </Text>
                </View>
              )}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  carouselWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
  },
  carouselContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  setupInner: {
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 48,
  },
  setupCard: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: STUDY_BORDER,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
  },
  setupKicker: {
    marginTop: 4,
    fontFamily: Fonts.ui.bold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#5f7f6a',
    textAlign: 'center',
  },
  setupHeader: {
    marginBottom: 28,
    alignItems: 'center',
  },
  setupTitle: {
    marginTop: 6,
    fontFamily: Fonts.ui.bold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.4,
    color: '#18181b',
    textAlign: 'center',
  },
  setupSubtitle: {
    marginTop: 8,
    fontFamily: Fonts.ui.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#71717A',
    textAlign: 'center',
  },
  setupButton: {
    width: '100%',
    minHeight: 46,
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupButtonDisabled: {
    opacity: 0.5,
  },
  setupButtonText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 15,
    color: '#1A2F23',
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  stage: {
    backgroundColor: '#FFFFFF',
  },
  stageInner: {
    flex: 1,
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  toolbar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    backgroundColor: '#FAFAFA',
  },
  toolbarBtnText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 12,
    color: '#52525b',
  },
  playerBody: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cover: {
    borderRadius: 20,
    overflow: 'hidden',
    ...boxShadow('0 12px 20px rgba(26,47,35,0.18)', {
      shadowColor: '#1A2F23',
      shadowOpacity: 0.18,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    }),
  },
  coverFill: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverGlow: {
    position: 'absolute',
    left: '-20%',
    right: '-20%',
    bottom: '-18%',
    height: '55%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  coverIcon: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  coverIconPlaying: {
    transform: [{ scale: 1.04 }],
  },
  titleSkeleton: {
    marginTop: 16,
    height: 28,
    width: '80%',
  },
  playerTitle: {
    marginTop: 16,
    maxWidth: 448,
    width: '100%',
    fontFamily: Fonts.ui.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
    color: '#18181b',
    textAlign: 'center',
  },
  seekBlock: {
    width: '100%',
    maxWidth: 448,
    marginTop: 24,
  },
  slider: {
    width: '100%',
    height: 28,
  },
  seekTimes: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  seekTime: {
    fontFamily: Fonts.ui.medium,
    fontSize: 12,
    color: '#71717A',
  },
  controlsStage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 448,
    marginTop: 24,
    minHeight: 80,
    position: 'relative',
  },
  controlsSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlsSideLeft: {
    justifyContent: 'flex-end',
    paddingRight: 16,
  },
  controlsSideRight: {
    justifyContent: 'flex-start',
    paddingLeft: 16,
  },
  skipButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  skipLabel: {
    fontFamily: Fonts.ui.bold,
    fontSize: 10,
    color: '#52525b',
    marginTop: -2,
  },
  playButton: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A2F23',
    ...boxShadow('0 10px 20px rgba(26,47,35,0.3)', {
      shadowColor: '#1A2F23',
      shadowOpacity: 0.3,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    }),
  },
  speedButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    minWidth: 48,
    paddingHorizontal: 8,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedText: {
    fontFamily: Fonts.ui.bold,
    fontSize: 13,
    color: '#52525b',
  },
  transcriptToggleRow: {
    width: '100%',
    maxWidth: 448,
    marginTop: 14,
    paddingHorizontal: 8,
  },
  transcriptToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(26,47,35,0.10)',
  },
  transcriptToggleText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 13,
    color: '#3f4a44',
  },
  transcriptBox: {
    marginTop: 10,
    width: '100%',
    maxWidth: 448,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(228,228,231,1)',
    backgroundColor: '#E8E7E2',
    maxHeight: 310,
  },
  transcriptBoxContent: {
    paddingVertical: 6,
  },
  transcriptLine: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginHorizontal: 10,
    marginVertical: 4,
    backgroundColor: 'transparent',
  },
  transcriptLineActive: {
    backgroundColor: 'rgba(63,107,79,0.18)',
  },
  transcriptSpeaker: {
    fontFamily: Fonts.ui.bold,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#71717a',
    marginBottom: 4,
  },
  transcriptText: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
    lineHeight: 20,
    color: '#3f3f46',
  },
  transcriptEmpty: {
    padding: 18,
    alignItems: 'center',
  },
  transcriptEmptyText: {
    fontFamily: Fonts.ui.medium,
    fontSize: 13,
    color: '#71717a',
    textAlign: 'center',
  },
});

export default AudioLessonTab;
