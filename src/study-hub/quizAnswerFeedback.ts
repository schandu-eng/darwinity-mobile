import { Platform, Vibration } from 'react-native';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';

type QuizSfx = 'select' | 'correct' | 'incorrect';

const SOURCES: Record<QuizSfx, number> = {
  select: require('../../assets/sounds/quiz-select.wav'),
  correct: require('../../assets/sounds/quiz-correct.wav'),
  incorrect: require('../../assets/sounds/quiz-incorrect.wav'),
};

const players: Partial<Record<QuizSfx, AudioPlayer>> = {};
let loadPromise: Promise<void> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeHaptic(run: () => Promise<unknown> | void): Promise<void> {
  try {
    await run();
  } catch {
    // Missing native module / reduced-motion / web.
  }
}

async function ensureSounds(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          interruptionMode: 'mixWithOthers',
        });
      } catch {
        // Keep loading assets even if session config fails in production.
      }
      (Object.keys(SOURCES) as QuizSfx[]).forEach((key) => {
        if (players[key]) return;
        const player = createAudioPlayer(SOURCES[key], { downloadFirst: true });
        player.volume = 0.75;
        players[key] = player;
      });
    })().catch(() => {
      loadPromise = null;
    });
  }
  await loadPromise;
}

async function playSound(kind: QuizSfx): Promise<void> {
  try {
    await ensureSounds();
    const player = players[kind];
    if (!player) return;
    await player.seekTo(0);
    player.play();
  } catch {
    // Asset missing from OTA / codec — haptics still run separately.
  }
}

export function preloadQuizAnswerFeedback(): void {
  void ensureSounds();
}

export function playQuizAnswerSelected(): void {
  void (async () => {
    if (Platform.OS === 'android') {
      await safeHaptic(() =>
        Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key)
      );
    } else {
      await safeHaptic(() => Haptics.selectionAsync());
      await safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    }
  })();
  void playSound('select');
}

async function shakeWrongHaptic(): Promise<void> {
  if (Platform.OS === 'android') {
    await safeHaptic(() =>
      Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject)
    );
    Vibration.vibrate([0, 45, 55, 45, 55, 80]);
    return;
  }
  await safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  await sleep(55);
  await safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
  await sleep(55);
  await safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  await sleep(40);
  await safeHaptic(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  );
}

export function playQuizAnswerResult(isCorrect: boolean): void {
  if (isCorrect) {
    void (async () => {
      if (Platform.OS === 'android') {
        await safeHaptic(() =>
          Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
        );
      }
      await safeHaptic(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      );
    })();
    void playSound('correct');
    return;
  }
  void shakeWrongHaptic();
  void playSound('incorrect');
}

/** SRS grade buttons: Again = wrong feel; Hard/Good/Easy = success feel. */
export function playCardDeckGradeFeedback(rating: number): void {
  playQuizAnswerResult(rating !== 1);
}
