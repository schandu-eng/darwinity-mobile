import { playQuizAnswerResult, playQuizAnswerSelected } from '@/study-hub/quizAnswerFeedback';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

async function safeHaptic(run: () => Promise<unknown> | void): Promise<void> {
  try {
    await run();
  } catch {
    // Missing native module / reduced-motion / web.
  }
}

export function playGameLaneChange(): void {
  void (async () => {
    if (Platform.OS === 'android') {
      await safeHaptic(() =>
        Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Tick)
      );
      return;
    }
    await safeHaptic(() => Haptics.selectionAsync());
  })();
}

export function playGameClose(): void {
  void safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function playGameHit(ok: boolean): void {
  playQuizAnswerResult(ok);
}

export function playGameLifeLost(): void {
  playQuizAnswerResult(false);
}

export function playGameOver(): void {
  void (async () => {
    await new Promise((resolve) => setTimeout(resolve, 140));
    await safeHaptic(() =>
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    );
    await safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  })();
}

export function playGameTypingError(): void {
  playQuizAnswerSelected();
  void safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
}
