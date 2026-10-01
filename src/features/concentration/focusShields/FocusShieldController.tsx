import { useEffect } from 'react';
import { subscribeFocusShieldSignal } from './signal';
import { subscribeFocusShieldPrefs } from './storage';
import { resetFocusShieldSync, syncFocusShields } from './sync';
import { clearNativeShields } from './native';

/**
 * Applies / clears OS shields from concentration status+phase only.
 * Must not subscribe to the ticking session context.
 */
export function FocusShieldController() {
  useEffect(() => {
    let cancelled = false;
    resetFocusShieldSync();
    void clearNativeShields().finally(() => {
      if (!cancelled) void syncFocusShields();
    });

    const unsubSignal = subscribeFocusShieldSignal((signal) => {
      if (!cancelled) void syncFocusShields(signal);
    });
    const unsubPrefs = subscribeFocusShieldPrefs(() => {
      if (!cancelled) {
        resetFocusShieldSync();
        void syncFocusShields();
      }
    });

    return () => {
      cancelled = true;
      unsubSignal();
      unsubPrefs();
    };
  }, []);

  return null;
}
