import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { BRAND_NAME } from '@/config/brand';

export type PodcastSession = {
  active: boolean;
  contentId: number | null;
  title: string;
  url: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
};

type AttachArgs = {
  url: string;
  contentId: number;
  title: string;
};

type PodcastPlaybackContextValue = {
  session: PodcastSession;
  player: ReturnType<typeof useAudioPlayer>;
  attach: (args: AttachArgs) => void;
  togglePlayPause: () => void;
  skip: (delta: number) => void;
  seek: (time: number) => void;
  dismiss: () => void;
  setStudyFocused: (focused: boolean) => void;
  setOnPodcastTab: (onTab: boolean) => void;
  studyFocused: boolean;
  onPodcastTab: boolean;
};

const PodcastPlaybackContext = createContext<PodcastPlaybackContextValue | null>(null);

async function configureBackgroundAudio() {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: Platform.OS === 'ios' ? 'mixWithOthers' : 'doNotMix',
    });
  } catch {
    // Audio mode is best-effort; playback still works in-foreground.
  }
}

export function PodcastPlaybackProvider({ children }: { children: React.ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const urlRef = useRef<string | null>(null);
  const titleRef = useRef('');
  const contentIdRef = useRef<number | null>(null);
  const dismissedRef = useRef(false);

  const [meta, setMeta] = useState<{ contentId: number | null; title: string; url: string | null }>({
    contentId: null,
    title: '',
    url: null,
  });
  const [studyFocused, setStudyFocusedState] = useState(false);
  const [onPodcastTab, setOnPodcastTabState] = useState(false);

  useEffect(() => {
    void configureBackgroundAudio();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void configureBackgroundAudio();
      }
    });
    return () => sub.remove();
  }, []);

  const currentTime = status.currentTime || 0;
  const duration = status.duration || 0;
  const isPlaying = Boolean(status.playing);

  const syncLockScreen = useCallback(
    (playing: boolean, title: string) => {
      try {
        if (!urlRef.current || dismissedRef.current) {
          player.clearLockScreenControls?.();
          return;
        }
        player.setActiveForLockScreen?.(playing || currentTime > 0, {
          title: title || 'Study podcast',
          artist: BRAND_NAME,
          albumTitle: BRAND_NAME,
        });
      } catch {
        // Lock-screen controls are unavailable on some devices.
      }
    },
    [currentTime, player],
  );

  const attach = useCallback(
    (args: AttachArgs) => {
      if (!args.url) return;
      dismissedRef.current = false;
      contentIdRef.current = args.contentId;
      titleRef.current = args.title;
      setMeta({ contentId: args.contentId, title: args.title, url: args.url });
      if (urlRef.current !== args.url) {
        urlRef.current = args.url;
        try {
          player.replace(args.url);
        } catch {
          // replace can throw if the previous source is still loading
        }
      }
      void configureBackgroundAudio();
    },
    [player],
  );

  const togglePlayPause = useCallback(() => {
    try {
      if (player.playing) {
        player.pause();
      } else {
        dismissedRef.current = false;
        void configureBackgroundAudio();
        player.play();
        syncLockScreen(true, titleRef.current);
      }
    } catch {
      // ignore control errors
    }
  }, [player, syncLockScreen]);

  const skip = useCallback(
    (delta: number) => {
      try {
        const dur = player.duration || 0;
        const next = Math.max(0, currentTime + delta);
        void player.seekTo(dur > 0 ? Math.min(dur, next) : next);
      } catch {
        // ignore
      }
    },
    [currentTime, player],
  );

  const seek = useCallback(
    (time: number) => {
      try {
        const max = player.duration || 0;
        void player.seekTo(Math.max(0, Math.min(max || time, time)));
      } catch {
        // ignore
      }
    },
    [player],
  );

  const dismiss = useCallback(() => {
    dismissedRef.current = true;
    try {
      player.pause();
      player.clearLockScreenControls?.();
    } catch {
      // ignore
    }
    urlRef.current = null;
    contentIdRef.current = null;
    titleRef.current = '';
    setMeta({ contentId: null, title: '', url: null });
  }, [player]);

  useEffect(() => {
    if (!meta.url || dismissedRef.current) return;
    syncLockScreen(isPlaying, meta.title);
  }, [isPlaying, meta.title, meta.url, syncLockScreen]);

  const session: PodcastSession = useMemo(() => {
    const started = isPlaying || currentTime > 0.25;
    return {
      active: Boolean(meta.url) && !dismissedRef.current && started,
      contentId: meta.contentId,
      title: meta.title,
      url: meta.url,
      isPlaying,
      currentTime,
      duration,
    };
  }, [currentTime, duration, isPlaying, meta.contentId, meta.title, meta.url]);

  const setStudyFocused = useCallback((focused: boolean) => {
    setStudyFocusedState(focused);
  }, []);

  const setOnPodcastTab = useCallback((onTab: boolean) => {
    setOnPodcastTabState(onTab);
  }, []);

  const value = useMemo(
    () => ({
      session,
      player,
      attach,
      togglePlayPause,
      skip,
      seek,
      dismiss,
      setStudyFocused,
      setOnPodcastTab,
      studyFocused,
      onPodcastTab,
    }),
    [
      attach,
      dismiss,
      onPodcastTab,
      player,
      seek,
      session,
      setOnPodcastTab,
      setStudyFocused,
      skip,
      studyFocused,
      togglePlayPause,
    ],
  );

  return (
    <PodcastPlaybackContext.Provider value={value}>
      {children}
    </PodcastPlaybackContext.Provider>
  );
}

export function usePodcastPlayback() {
  const ctx = useContext(PodcastPlaybackContext);
  if (!ctx) {
    throw new Error('usePodcastPlayback must be used within PodcastPlaybackProvider');
  }
  return ctx;
}

export function usePodcastPlaybackOptional() {
  return useContext(PodcastPlaybackContext);
}
