import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store';
import {
  focusEndpoints,
  type CheckpointGrant,
  type FocusEventPayload,
  type FocusSegment,
} from '@/api/endpoints/concentration';
import {
  IDLE_TIMEOUT_MS,
  PAUSE_FINALIZE_MS,
  STORAGE_KEY,
  POMODORO_COUNT_KEY,
  PRESET_KEY,
  createConcentrationSessionId,
  getPresetById,
  isAllowlistedScreen,
  type PomodoroPreset,
  type PomodoroPresetId,
} from './allowlist';
import { publishFocusShieldSignal } from './focusShields/signal';

type FocusStatus = 'idle' | 'running' | 'paused' | 'finalizing';
type FocusPhase = 'work' | 'break';
type AwayReason = 'leave' | 'blur' | null;

type FocusDraft = {
  sessionId: string;
  status: FocusStatus;
  startedAt: string;
  segmentStartedAt: string | null;
  activeSeconds: number;
  segments: FocusSegment[];
  events: FocusEventPayload[];
  currentScreen: string | null;
  phase: FocusPhase;
  phaseEndsAt: number | null;
  pausedRemaining: number | null;
  presetId: string;
  completedThisRun: number;
  lastAllowlisted: string | null;
  awayEndsAt: number | null;
  awayReason: AwayReason;
  frozenPhaseRemaining: number | null;
};

type PhaseBanner = { title: string; body: string } | null;

type FocusContextValue = {
  status: FocusStatus;
  activeSeconds: number;
  displaySeconds: number;
  phaseRemaining: number;
  phase: FocusPhase;
  presetId: PomodoroPresetId;
  completedThisRun: number;
  lifetimePomodoros: number;
  currentScreen: string | null;
  pendingCheckpoints: CheckpointGrant[];
  setupOpen: boolean;
  setSetupOpen: (open: boolean) => void;
  awayWarningOpen: boolean;
  awayRemaining: number;
  awayReason: AwayReason;
  isAway: boolean;
  exitGuardOpen: boolean;
  phaseBanner: PhaseBanner;
  setPhaseBanner: (b: PhaseBanner) => void;
  focusLocked: boolean;
  setCurrentScreen: (name: string | null) => void;
  registerReturnToStudy: (fn: ((screen: string) => void) | null) => void;
  
  registerNavigationBounce: (fn: ((screen: string) => void) | null) => void;
  requestStart: () => boolean;
  startWithPreset: (id: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  end: () => Promise<void>;
  dismissAwayWarning: () => void;
  dismissExitGuard: () => void;
  confirmLeaveAndEnd: () => Promise<void>;
  returnToStudy: () => void;
  attachCardDeckReview: (cardId: number | string, rating: number) => void;
  attachQuizCorrect: (questionId?: number | string) => void;
  clearCheckpoint: (inboxId: number) => void;
};

const FocusContext = createContext<FocusContextValue | null>(null);

function nowIso() {
  return new Date().toISOString();
}

function remainingFromEndsAt(endsAt: number | null) {
  if (!endsAt) return 0;
  return Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
}

function isWorkActive(status: FocusStatus, phase: FocusPhase) {
  return (status === 'running' || status === 'paused') && phase === 'work';
}

export const ConcentrationSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const userId = useAuthStore((s) => s.user?.id);
  const [status, setStatus] = useState<FocusStatus>('idle');
  const [activeSeconds, setActiveSeconds] = useState(0);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [phaseRemaining, setPhaseRemaining] = useState(0);
  const [phase, setPhase] = useState<FocusPhase>('work');
  const [presetId, setPresetId] = useState<PomodoroPresetId>('classic');
  const [completedThisRun, setCompletedThisRun] = useState(0);
  const [lifetimePomodoros, setLifetimePomodoros] = useState(0);
  const [currentScreen, setCurrentScreenState] = useState<string | null>(null);
  const [pendingCheckpoints, setPendingCheckpoints] = useState<CheckpointGrant[]>([]);
  const [setupOpen, setSetupOpen] = useState(false);
  const [awayWarningOpen, setAwayWarningOpen] = useState(false);
  const [awayRemaining, setAwayRemaining] = useState(0);
  const [awayReason, setAwayReason] = useState<AwayReason>(null);
  const [phaseBanner, setPhaseBanner] = useState<PhaseBanner>(null);

  const segmentStartedAtRef = useRef<string | null>(null);
  const segmentsRef = useRef<FocusSegment[]>([]);
  const eventsRef = useRef<FocusEventPayload[]>([]);
  const statusRef = useRef<FocusStatus>('idle');
  const sessionIdRef = useRef<string | null>(null);
  const activeSecondsRef = useRef(0);
  const startedAtRef = useRef<string | null>(null);
  const currentScreenRef = useRef<string | null>(null);
  const lastAllowlistedRef = useRef<string | null>(null);
  const phaseRef = useRef<FocusPhase>('work');
  const phaseEndsAtRef = useRef<number | null>(null);
  const pausedRemainingRef = useRef<number | null>(null);
  const presetRef = useRef<PomodoroPreset>(getPresetById('classic'));
  const completedThisRunRef = useRef(0);
  const pauseFinalizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const returnNavRef = useRef<((screen: string) => void) | null>(null);
  const awayEndsAtRef = useRef<number | null>(null);
  const awayReasonRef = useRef<AwayReason>(null);
  const frozenPhaseRemainingRef = useRef<number | null>(null);
  const finalizeInternalRef = useRef<(() => Promise<void>) | null>(null);
  const restoringRef = useRef(false);

  const isAway = Boolean(awayReason);

  const persistDraft = useCallback(async () => {
    if (!sessionIdRef.current || statusRef.current === 'idle') {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return;
    }
    const draft: FocusDraft = {
      sessionId: sessionIdRef.current,
      status: statusRef.current,
      startedAt: startedAtRef.current || nowIso(),
      segmentStartedAt: segmentStartedAtRef.current,
      activeSeconds: activeSecondsRef.current,
      segments: segmentsRef.current,
      events: eventsRef.current,
      currentScreen: currentScreenRef.current,
      phase: phaseRef.current,
      phaseEndsAt: phaseEndsAtRef.current,
      pausedRemaining: pausedRemainingRef.current,
      presetId: presetRef.current.id,
      completedThisRun: completedThisRunRef.current,
      lastAllowlisted: lastAllowlistedRef.current,
      awayEndsAt: awayEndsAtRef.current,
      awayReason: awayReasonRef.current,
      frozenPhaseRemaining: frozenPhaseRemainingRef.current,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, []);

  const clearTimers = useCallback(() => {
    if (pauseFinalizeTimerRef.current) clearTimeout(pauseFinalizeTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    pauseFinalizeTimerRef.current = null;
    tickRef.current = null;
  }, []);

  const closeOpenSegment = useCallback(() => {
    if (!segmentStartedAtRef.current) return;
    segmentsRef.current = [
      ...segmentsRef.current,
      {
        from: segmentStartedAtRef.current,
        to: nowIso(),
        screen: currentScreenRef.current || 'unknown',
      },
    ];
    const started = Date.parse(segmentStartedAtRef.current);
    if (!Number.isNaN(started)) {
      const add = Math.max(0, Math.floor((Date.now() - started) / 1000));
      activeSecondsRef.current += add;
      setActiveSeconds(activeSecondsRef.current);
    }
    segmentStartedAtRef.current = null;
  }, []);

  const computeLiveActive = useCallback(() => {
    let total = activeSecondsRef.current;
    if (statusRef.current === 'running' && phaseRef.current === 'work' && segmentStartedAtRef.current) {
      const started = Date.parse(segmentStartedAtRef.current);
      if (!Number.isNaN(started)) {
        total += Math.max(0, Math.floor((Date.now() - started) / 1000));
      }
    }
    return total;
  }, []);

  const clearAway = useCallback(
    ({ resumeSegment = true }: { resumeSegment?: boolean } = {}) => {
      const hadLeave =
        Boolean(awayEndsAtRef.current) || Boolean(awayReasonRef.current);
      const hadFreeze = frozenPhaseRemainingRef.current != null;
      if (!hadLeave && !hadFreeze) return;

      awayEndsAtRef.current = null;
      awayReasonRef.current = null;
      setAwayRemaining(0);
      setAwayReason(null);
      setAwayWarningOpen(false);

      if (
        statusRef.current === 'running' &&
        frozenPhaseRemainingRef.current != null &&
        !phaseEndsAtRef.current
      ) {
        const rem = Math.max(1, frozenPhaseRemainingRef.current);
        frozenPhaseRemainingRef.current = null;
        phaseEndsAtRef.current = Date.now() + rem * 1000;
        setPhaseRemaining(rem);
      }

      if (
        resumeSegment &&
        statusRef.current === 'running' &&
        phaseRef.current === 'work' &&
        !segmentStartedAtRef.current &&
        isAllowlistedScreen(currentScreenRef.current)
      ) {
        segmentStartedAtRef.current = nowIso();
      }
      void persistDraft();
    },
    [persistDraft]
  );

  const freezePhaseClock = useCallback(() => {
    if (statusRef.current === 'running' && phaseEndsAtRef.current) {
      frozenPhaseRemainingRef.current = remainingFromEndsAt(phaseEndsAtRef.current);
      phaseEndsAtRef.current = null;
      setPhaseRemaining(frozenPhaseRemainingRef.current);
    }
    if (statusRef.current === 'running' && phaseRef.current === 'work') {
      closeOpenSegment();
    }
  }, [closeOpenSegment]);

  const startAway = useCallback(
    (reason: Exclude<AwayReason, null>) => {
      const sessionLive =
        statusRef.current === 'running' || statusRef.current === 'paused';
      if (!sessionLive) return;

      if (reason === 'blur') {
        freezePhaseClock();
        void persistDraft();
        return;
      }

      if (phaseRef.current !== 'work') return;

      if (awayEndsAtRef.current) {
        setAwayWarningOpen(true);
        void persistDraft();
        return;
      }

      freezePhaseClock();
      awayEndsAtRef.current = Date.now() + IDLE_TIMEOUT_MS;
      awayReasonRef.current = 'leave';
      setAwayReason('leave');
      setAwayRemaining(remainingFromEndsAt(awayEndsAtRef.current));
      setAwayWarningOpen(true);
      void persistDraft();
    },
    [freezePhaseClock, persistDraft]
  );

  const finalizeInternal = useCallback(async () => {
    if (!userId || !sessionIdRef.current) {
      setStatus('idle');
      statusRef.current = 'idle';
      return;
    }
    if (statusRef.current === 'finalizing' || statusRef.current === 'idle') return;

    clearTimers();
    awayEndsAtRef.current = null;
    awayReasonRef.current = null;
    frozenPhaseRemainingRef.current = null;
    setAwayRemaining(0);
    setAwayReason(null);
    setAwayWarningOpen(false);

    if (statusRef.current === 'running' && phaseRef.current === 'work') {
      closeOpenSegment();
    } else {
      segmentStartedAtRef.current = null;
    }
    setStatus('finalizing');
    statusRef.current = 'finalizing';

    try {
      const result = await focusEndpoints.finalizeSession(sessionIdRef.current, {
        user_id: userId,
        active_seconds: activeSecondsRef.current,
        segments: segmentsRef.current,
        events: eventsRef.current,
        started_at: startedAtRef.current || undefined,
        ended_at: nowIso(),
      });
      if (result.checkpoints_reached?.length) {
        setPendingCheckpoints((prev) => [...prev, ...result.checkpoints_reached]);
      }
      if (typeof result.loyalty?.pomodoros_lifetime === 'number') {
        setLifetimePomodoros(result.loyalty.pomodoros_lifetime);
        await AsyncStorage.setItem(POMODORO_COUNT_KEY, String(result.loyalty.pomodoros_lifetime));
      }
    } catch (e) {
      console.warn('Focus finalize failed', e);
    } finally {
      sessionIdRef.current = null;
      startedAtRef.current = null;
      activeSecondsRef.current = 0;
      setActiveSeconds(0);
      setDisplaySeconds(0);
      setPhaseRemaining(0);
      segmentsRef.current = [];
      eventsRef.current = [];
      segmentStartedAtRef.current = null;
      phaseEndsAtRef.current = null;
      pausedRemainingRef.current = null;
      completedThisRunRef.current = 0;
      setCompletedThisRun(0);
      setPhase('work');
      phaseRef.current = 'work';
      setPhaseBanner(null);
      setAwayWarningOpen(false);
      setStatus('idle');
      statusRef.current = 'idle';
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, [userId, clearTimers, closeOpenSegment]);

  finalizeInternalRef.current = finalizeInternal;

  const schedulePauseFinalize = useCallback(() => {
    if (pauseFinalizeTimerRef.current) clearTimeout(pauseFinalizeTimerRef.current);
    pauseFinalizeTimerRef.current = setTimeout(() => {
      if (statusRef.current === 'paused') {
        void finalizeInternal();
      }
    }, PAUSE_FINALIZE_MS);
  }, [finalizeInternal]);

  const beginPhase = useCallback(
    (nextPhase: FocusPhase, preset: PomodoroPreset) => {
      const minutes = nextPhase === 'work' ? preset.workMinutes : preset.breakMinutes;
      phaseRef.current = nextPhase;
      setPhase(nextPhase);
      phaseEndsAtRef.current = Date.now() + minutes * 60_000;
      pausedRemainingRef.current = null;
      setPhaseRemaining(minutes * 60);

      if (nextPhase === 'break') {
        awayEndsAtRef.current = null;
        awayReasonRef.current = null;
        frozenPhaseRemainingRef.current = null;
        setAwayRemaining(0);
        setAwayReason(null);
        setAwayWarningOpen(false);
        if (segmentStartedAtRef.current) {
          closeOpenSegment();
        }
      } else if (isAllowlistedScreen(currentScreenRef.current) && !awayEndsAtRef.current) {
        segmentStartedAtRef.current = nowIso();
      } else {
        segmentStartedAtRef.current = null;
      }
    },
    [closeOpenSegment]
  );

  const onWorkComplete = useCallback(() => {
    closeOpenSegment();
    completedThisRunRef.current += 1;
    setCompletedThisRun(completedThisRunRef.current);
    void (async () => {
      const raw = await AsyncStorage.getItem(POMODORO_COUNT_KEY);
      const prev = Number(raw || 0);
      const next = (Number.isFinite(prev) ? prev : 0) + 1;
      await AsyncStorage.setItem(POMODORO_COUNT_KEY, String(next));
      setLifetimePomodoros(next);
    })();

    eventsRef.current = [
      ...eventsRef.current,
      {
        client_event_id: `pomodoro-${sessionIdRef.current}-${completedThisRunRef.current}-${Date.now()}`,
        event_type: 'pomodoro_complete',
        occurred_at: nowIso(),
        payload: {
          preset_id: presetRef.current.id,
          work_minutes: presetRef.current.workMinutes,
          break_minutes: presetRef.current.breakMinutes,
          index: completedThisRunRef.current,
        },
      },
    ];

    setPhaseBanner({
      title: 'Pomodoro complete',
      body: `${completedThisRunRef.current} session(s) done. Take your ${presetRef.current.breakMinutes}-minute break.`,
    });
    beginPhase('break', presetRef.current);
    void persistDraft();
  }, [beginPhase, closeOpenSegment, persistDraft]);

  const onBreakComplete = useCallback(() => {
    setPhaseBanner({
      title: 'Break over',
      body: `Back to focus. ${presetRef.current.workMinutes} minutes. Home and study screens keep the session going; leave Darwinity for 2 minutes and it ends.`,
    });
    beginPhase('work', presetRef.current);
    if (
      isWorkActive(statusRef.current, phaseRef.current) &&
      !isAllowlistedScreen(currentScreenRef.current)
    ) {
      startAway('leave');
    }
    void persistDraft();
  }, [beginPhase, persistDraft, startAway]);

  const startTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setDisplaySeconds(computeLiveActive());
      setActiveSeconds(activeSecondsRef.current);

      if (awayEndsAtRef.current) {
        const awayRem = remainingFromEndsAt(awayEndsAtRef.current);
        setAwayRemaining(awayRem);
        if (frozenPhaseRemainingRef.current != null) {
          setPhaseRemaining(frozenPhaseRemainingRef.current);
        }
        if (awayRem <= 0) {
          awayEndsAtRef.current = null;
          awayReasonRef.current = null;
          frozenPhaseRemainingRef.current = null;
          setAwayRemaining(0);
          setAwayReason(null);
          setAwayWarningOpen(false);
          void finalizeInternalRef.current?.();
          return;
        }
        return;
      }

      if (frozenPhaseRemainingRef.current != null && !phaseEndsAtRef.current) {
        setPhaseRemaining(frozenPhaseRemainingRef.current);
        return;
      }

      if (statusRef.current === 'paused') {
        setPhaseRemaining(pausedRemainingRef.current || 0);
        return;
      }
      if (statusRef.current !== 'running' || !phaseEndsAtRef.current) {
        setPhaseRemaining(0);
        return;
      }
      const rem = remainingFromEndsAt(phaseEndsAtRef.current);
      setPhaseRemaining(rem);
      if (rem <= 0) {
        phaseEndsAtRef.current = null;
        if (phaseRef.current === 'work') onWorkComplete();
        else onBreakComplete();
      }
    }, 1000);
  }, [computeLiveActive, onBreakComplete, onWorkComplete]);

  const startWithPreset = useCallback(
    async (id: string) => {
      if (!userId) return;
      if (statusRef.current === 'running' || statusRef.current === 'finalizing') return;

      const preset = getPresetById(id);
      presetRef.current = preset;
      setPresetId(preset.id);
      await AsyncStorage.setItem(PRESET_KEY, preset.id);

      const sid = createConcentrationSessionId();
      sessionIdRef.current = sid;
      const started = nowIso();
      startedAtRef.current = started;
      activeSecondsRef.current = 0;
      setActiveSeconds(0);
      setDisplaySeconds(0);
      segmentsRef.current = [];
      eventsRef.current = [];
      completedThisRunRef.current = 0;
      setCompletedThisRun(0);
      setPhaseBanner(null);
      awayEndsAtRef.current = null;
      awayReasonRef.current = null;
      frozenPhaseRemainingRef.current = null;
      setAwayRemaining(0);
      setAwayReason(null);
      setAwayWarningOpen(false);
      setSetupOpen(false);

      beginPhase('work', preset);
      setStatus('running');
      statusRef.current = 'running';
      startTick();

      try {
        await focusEndpoints.startSession(userId, sid);
      } catch (e) {
        console.warn('Focus start sync failed', e);
      }
      void persistDraft();
    },
    [userId, beginPhase, persistDraft, startTick]
  );

  const requestStart = useCallback(() => {
    setSetupOpen(true);
    return true;
  }, []);

  const pause = useCallback(() => {
    if (statusRef.current !== 'running') return;
    if (phaseRef.current === 'work') closeOpenSegment();
    pausedRemainingRef.current = remainingFromEndsAt(phaseEndsAtRef.current);
    phaseEndsAtRef.current = null;
    setPhaseRemaining(pausedRemainingRef.current);
    setStatus('paused');
    statusRef.current = 'paused';
    schedulePauseFinalize();
    void persistDraft();
  }, [closeOpenSegment, persistDraft, schedulePauseFinalize]);

  const resume = useCallback(() => {
    if (statusRef.current !== 'paused') return;
    if (phaseRef.current === 'work' && !isAllowlistedScreen(currentScreenRef.current)) return;
    if (pauseFinalizeTimerRef.current) clearTimeout(pauseFinalizeTimerRef.current);
    const rem = Math.max(1, pausedRemainingRef.current || 0);
    phaseEndsAtRef.current = Date.now() + rem * 1000;
    pausedRemainingRef.current = null;
    setPhaseRemaining(rem);
    if (phaseRef.current === 'work' && !awayEndsAtRef.current) {
      segmentStartedAtRef.current = nowIso();
    }
    setStatus('running');
    statusRef.current = 'running';
    startTick();
    void persistDraft();
  }, [persistDraft, startTick]);

  const end = useCallback(async () => {
    await finalizeInternal();
  }, [finalizeInternal]);

  const dismissAwayWarning = useCallback(() => setAwayWarningOpen(false), []);
  const confirmLeaveAndEnd = useCallback(async () => {
    setAwayWarningOpen(false);
    await finalizeInternal();
  }, [finalizeInternal]);

  const registerReturnToStudy = useCallback((fn: ((screen: string) => void) | null) => {
    returnNavRef.current = fn;
  }, []);

  const returnToStudy = useCallback(() => {
    const backTo = lastAllowlistedRef.current;
    if (backTo) {
      returnNavRef.current?.(backTo);
    }
  }, []);

  const setCurrentScreen = useCallback(
    (name: string | null) => {
      if (restoringRef.current) {
        currentScreenRef.current = name;
        setCurrentScreenState(name);
        return;
      }

      if (isAllowlistedScreen(name)) {
        lastAllowlistedRef.current = name;
        currentScreenRef.current = name;
        setCurrentScreenState(name);
        if (awayEndsAtRef.current) {
          clearAway({ resumeSegment: true });
        } else if (
          statusRef.current === 'running' &&
          phaseRef.current === 'work' &&
          !segmentStartedAtRef.current
        ) {
          segmentStartedAtRef.current = nowIso();
          void persistDraft();
        }
        return;
      }

      currentScreenRef.current = name;
      setCurrentScreenState(name);

      if (isWorkActive(statusRef.current, phaseRef.current)) {
        startAway('leave');
      }
    },
    [clearAway, persistDraft, startAway]
  );

  const attachCardDeckReview = useCallback(
    (_cardId: number | string, _rating: number) => {
      // Card reviews are recorded server-side on grade; do not gate on a pomodoro.
    },
    []
  );

  const attachQuizCorrect = useCallback((_questionId?: number | string) => {
    // Quiz answers are recorded server-side on submit; do not gate on a pomodoro.
  }, []);

  const clearCheckpoint = useCallback(
    (inboxId: number) => {
      setPendingCheckpoints((prev) => prev.filter((c) => c.inbox_id !== inboxId));
      if (userId) {
        void focusEndpoints.ackInbox(userId, inboxId).catch(() => undefined);
      }
    },
    [userId]
  );

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    publishFocusShieldSignal(status, phase);
  }, [status, phase]);

  useEffect(() => {
    const onAppState = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        if (statusRef.current === 'running' || statusRef.current === 'paused') {
          startAway('blur');
        }
        return;
      }
      if (next === 'active') {
        if (isAllowlistedScreen(currentScreenRef.current)) {
          clearAway({ resumeSegment: true });
        } else if (awayEndsAtRef.current) {
          setAwayRemaining(remainingFromEndsAt(awayEndsAtRef.current));
          if (frozenPhaseRemainingRef.current != null) {
            setPhaseRemaining(frozenPhaseRemainingRef.current);
          }
        } else if (statusRef.current === 'running') {
          setDisplaySeconds(computeLiveActive());
          setPhaseRemaining(remainingFromEndsAt(phaseEndsAtRef.current));
        }
      }
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [clearAway, computeLiveActive, startAway]);

  useEffect(() => {
    let cancelled = false;
    restoringRef.current = true;
    (async () => {
      try {
        const [countRaw, presetRaw, draftRaw] = await Promise.all([
          AsyncStorage.getItem(POMODORO_COUNT_KEY),
          AsyncStorage.getItem(PRESET_KEY),
          AsyncStorage.getItem(STORAGE_KEY),
        ]);
        if (cancelled) return;
        const count = Number(countRaw || 0);
        setLifetimePomodoros(Number.isFinite(count) ? count : 0);
        const preset = getPresetById(presetRaw || 'classic');
        presetRef.current = preset;
        setPresetId(preset.id);

        if (!draftRaw) return;
        const draft = JSON.parse(draftRaw) as FocusDraft;
        if (!draft.sessionId) return;

        sessionIdRef.current = draft.sessionId;
        startedAtRef.current = draft.startedAt;
        activeSecondsRef.current = draft.activeSeconds || 0;
        segmentsRef.current = draft.segments || [];
        eventsRef.current = draft.events || [];
        currentScreenRef.current = draft.currentScreen;
        setCurrentScreenState(draft.currentScreen);
        lastAllowlistedRef.current = draft.lastAllowlisted || draft.currentScreen;
        completedThisRunRef.current = draft.completedThisRun || 0;
        setCompletedThisRun(completedThisRunRef.current);

        const restoredPreset = getPresetById(draft.presetId || preset.id);
        presetRef.current = restoredPreset;
        setPresetId(restoredPreset.id);
        phaseRef.current = draft.phase || 'work';
        setPhase(phaseRef.current);

        const restoreAway = () => {
          if (draft.awayEndsAt && draft.awayEndsAt > Date.now() && draft.status === 'running') {
            awayEndsAtRef.current = draft.awayEndsAt;
            awayReasonRef.current = draft.awayReason || 'leave';
            setAwayReason(awayReasonRef.current);
            setAwayRemaining(remainingFromEndsAt(awayEndsAtRef.current));
            const frozen =
              typeof draft.frozenPhaseRemaining === 'number'
                ? draft.frozenPhaseRemaining
                : remainingFromEndsAt(draft.phaseEndsAt);
            if (frozen > 0) {
              frozenPhaseRemainingRef.current = frozen;
              phaseEndsAtRef.current = null;
              setPhaseRemaining(frozen);
            }
            setAwayWarningOpen(true);
            return true;
          }
          if (draft.awayEndsAt && draft.awayEndsAt <= Date.now()) {
            setTimeout(() => void finalizeInternalRef.current?.(), 0);
            return true;
          }
          if (
            draft.status === 'running' &&
            typeof draft.frozenPhaseRemaining === 'number' &&
            draft.frozenPhaseRemaining > 0 &&
            !draft.phaseEndsAt
          ) {
            frozenPhaseRemainingRef.current = draft.frozenPhaseRemaining;
            phaseEndsAtRef.current = null;
            setPhaseRemaining(draft.frozenPhaseRemaining);
            return true;
          }
          return false;
        };

        if (draft.status === 'running' && (draft.awayEndsAt || draft.frozenPhaseRemaining != null)) {
          segmentStartedAtRef.current = null;
          setStatus('running');
          statusRef.current = 'running';
          setDisplaySeconds(activeSecondsRef.current);
          startTick();
          restoreAway();
        } else if (draft.status === 'running' && draft.phaseEndsAt && draft.phaseEndsAt > Date.now()) {
          phaseEndsAtRef.current = draft.phaseEndsAt;
          segmentStartedAtRef.current =
            phaseRef.current === 'work' ? draft.segmentStartedAt || nowIso() : null;
          setStatus('running');
          statusRef.current = 'running';
          setPhaseRemaining(remainingFromEndsAt(phaseEndsAtRef.current));
          setDisplaySeconds(computeLiveActive());
          startTick();
        } else if (draft.status === 'running' && draft.phaseEndsAt && draft.phaseEndsAt <= Date.now()) {
          phaseEndsAtRef.current = Date.now();
          if (phaseRef.current === 'work' && draft.segmentStartedAt) {
            segmentStartedAtRef.current = draft.segmentStartedAt;
            closeOpenSegment();
          }
          setStatus('running');
          statusRef.current = 'running';
          startTick();
        } else {

          if (phaseRef.current === 'work' && draft.segmentStartedAt) {
            const started = Date.parse(draft.segmentStartedAt);
            if (!Number.isNaN(started)) {
              activeSecondsRef.current += Math.max(0, Math.floor((Date.now() - started) / 1000));
            }
          }
          const rem =
            draft.pausedRemaining ??
            (draft.phaseEndsAt
              ? remainingFromEndsAt(draft.phaseEndsAt)
              : restoredPreset.workMinutes * 60);
          const continueRem = Math.max(1, rem || 0);
          phaseEndsAtRef.current = Date.now() + continueRem * 1000;
          pausedRemainingRef.current = null;
          segmentStartedAtRef.current =
            phaseRef.current === 'work' && !draft.awayEndsAt ? nowIso() : null;
          setPhaseRemaining(continueRem);
          setActiveSeconds(activeSecondsRef.current);
          setDisplaySeconds(activeSecondsRef.current);
          setStatus('running');
          statusRef.current = 'running';
          startTick();
        }
      } catch {

      } finally {
        setTimeout(() => {
          restoringRef.current = false;
          if (
            isWorkActive(statusRef.current, phaseRef.current) &&
            !isAllowlistedScreen(currentScreenRef.current)
          ) {
            startAway('leave');
          } else if (isAllowlistedScreen(currentScreenRef.current)) {
            clearAway({ resumeSegment: true });
          }
        }, 500);
      }
    })();
    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [clearAway, clearTimers, closeOpenSegment, computeLiveActive, schedulePauseFinalize, startAway, startTick]);

  const value = useMemo<FocusContextValue>(
    () => ({
      status,
      activeSeconds,
      displaySeconds,
      phaseRemaining,
      phase,
      presetId,
      completedThisRun,
      lifetimePomodoros,
      currentScreen,
      pendingCheckpoints,
      setupOpen,
      setSetupOpen,
      awayWarningOpen,
      awayRemaining,
      awayReason,
      isAway,
      exitGuardOpen: awayWarningOpen,
      phaseBanner,
      setPhaseBanner,
      focusLocked: false,
      setCurrentScreen,
      registerReturnToStudy,
      registerNavigationBounce: registerReturnToStudy,
      requestStart,
      startWithPreset,
      pause,
      resume,
      end,
      dismissAwayWarning,
      dismissExitGuard: dismissAwayWarning,
      confirmLeaveAndEnd,
      returnToStudy,
      attachCardDeckReview,
      attachQuizCorrect,
      clearCheckpoint,
    }),
    [
      status,
      activeSeconds,
      displaySeconds,
      phaseRemaining,
      phase,
      presetId,
      completedThisRun,
      lifetimePomodoros,
      currentScreen,
      pendingCheckpoints,
      setupOpen,
      awayWarningOpen,
      awayRemaining,
      awayReason,
      isAway,
      phaseBanner,
      setCurrentScreen,
      registerReturnToStudy,
      requestStart,
      startWithPreset,
      pause,
      resume,
      end,
      dismissAwayWarning,
      confirmLeaveAndEnd,
      returnToStudy,
      attachCardDeckReview,
      attachQuizCorrect,
      clearCheckpoint,
    ]
  );

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
};

export function useConcentrationSession(): FocusContextValue {
  const ctx = useContext(FocusContext);
  if (!ctx) {
    throw new Error('useConcentrationSession must be used within ConcentrationSessionProvider');
  }
  return ctx;
}

export function useConcentrationSessionOptional(): FocusContextValue | null {
  return useContext(FocusContext);
}
