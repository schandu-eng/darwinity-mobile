import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Pause, Play, Podcast, SkipBack, SkipForward, X } from '@/icons';
import { ICON_STROKE } from '@/config/icons';
import { Fonts } from '@/config/fonts';
import { BRAND_COLORS } from '@/config/brand';
import { useAppTheme } from '@/store/appThemeStore';
import { navigationRef } from '@/navigation/navigationRef';
import { PHONE_TAB_BAR_CONTENT_HEIGHT } from '@/components/navigation/PhoneTabBar';
import { usePodcastPlaybackOptional } from './PodcastPlaybackContext';

const SKIP_BACK = 15;
const SKIP_FORWARD = 30;

function formatTime(seconds: number) {
  if (!seconds || !Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function openPodcast(contentId: number) {
  if (!navigationRef.isReady()) return;
  navigationRef.navigate('App', {
    screen: 'Content',
    params: {
      screen: 'ContentDetail',
      params: { contentId, initialTab: 'podcast' },
    },
  });
}

export default function PodcastMiniPlayer() {
  const playback = usePodcastPlaybackOptional();
  const insets = useSafeAreaInsets();
  const isDark = useAppTheme() === 'dark';

  if (!playback) return null;

  const { session, togglePlayPause, skip, seek, dismiss, studyFocused, onPodcastTab } = playback;
  if (!session.active || (studyFocused && onPodcastTab)) return null;

  const bottom = PHONE_TAB_BAR_CONTENT_HEIGHT + Math.max(insets.bottom, 8);
  const fg = isDark ? '#E4E4E7' : '#18181B';
  const muted = isDark ? '#A1A1AA' : '#71717A';

  return (
    <View
      style={[
        styles.wrap,
        {
          bottom,
          backgroundColor: isDark ? '#111113' : '#FFFFFF',
          borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : '#E4E4E7',
        },
      ]}
      accessibilityRole="toolbar"
      accessibilityLabel="Now playing podcast"
    >
      <Pressable
        onPress={() => {
          if (session.contentId) openPodcast(session.contentId);
        }}
        style={styles.main}
        accessibilityRole="button"
        accessibilityLabel={`Open podcast: ${session.title || 'Podcast'}`}
      >
        <View style={[styles.art, { backgroundColor: isDark ? '#3F6B4F' : BRAND_COLORS.ink }]}>
          <Podcast size={16} strokeWidth={1.6} color="#FFFFFF" />
        </View>
        <View style={styles.meta}>
          <Text style={[styles.eyebrow, { color: muted }]}>Now playing</Text>
          <Text numberOfLines={1} style={[styles.title, { color: fg }]}>
            {session.title || 'Study podcast'}
          </Text>
        </View>
      </Pressable>

      <View style={styles.transport}>
        <Pressable
          onPress={() => skip(-SKIP_BACK)}
          hitSlop={8}
          accessibilityLabel={`Rewind ${SKIP_BACK} seconds`}
          style={styles.iconBtn}
        >
          <SkipBack size={18} strokeWidth={ICON_STROKE} color={muted} />
        </Pressable>
        <Pressable
          onPress={togglePlayPause}
          hitSlop={8}
          accessibilityLabel={session.isPlaying ? 'Pause podcast' : 'Play podcast'}
          style={styles.iconBtn}
        >
          {session.isPlaying ? (
            <Pause size={20} strokeWidth={2} color={fg} fill={fg} />
          ) : (
            <Play size={20} strokeWidth={2} color={fg} fill={fg} />
          )}
        </Pressable>
        <Pressable
          onPress={() => skip(SKIP_FORWARD)}
          hitSlop={8}
          accessibilityLabel={`Forward ${SKIP_FORWARD} seconds`}
          style={styles.iconBtn}
        >
          <SkipForward size={18} strokeWidth={ICON_STROKE} color={muted} />
        </Pressable>
        <Pressable
          onPress={dismiss}
          hitSlop={8}
          accessibilityLabel="Close podcast player"
          style={styles.iconBtn}
        >
          <X size={18} strokeWidth={2.2} color={muted} />
        </Pressable>
      </View>

      <View style={styles.seekRow}>
        <Text style={[styles.time, { color: muted }]}>{formatTime(session.currentTime)}</Text>
        <Slider
          style={styles.seek}
          minimumValue={0}
          maximumValue={session.duration || 1}
          value={session.currentTime}
          onSlidingComplete={seek}
          minimumTrackTintColor={isDark ? '#7A9E86' : BRAND_COLORS.ink}
          maximumTrackTintColor={isDark ? '#3F3F46' : '#E4E4E7'}
          thumbTintColor={isDark ? '#7A9E86' : BRAND_COLORS.ink}
          disabled={!session.duration}
        />
        <Text style={[styles.time, { color: muted }]}>{formatTime(session.duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 40,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    paddingRight: 148,
  },
  art: {
    width: 38,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: Fonts.ui.bold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.ui.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  transport: {
    position: 'absolute',
    right: 8,
    top: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  seek: {
    flex: 1,
    height: 24,
  },
  time: {
    fontFamily: Fonts.ui.medium,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    minWidth: 32,
  },
});
