import { useCallback, useEffect, useRef, useState } from 'react';

const HINT_DISPLAY_MS = 2500;
const HINT_FADE_MS = 400;

export function useFloatingHint() {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  const dismiss = useCallback(() => {
    clearTimers();
    setFadingOut(true);
    const t = setTimeout(() => {
      setVisible(false);
      setFadingOut(false);
    }, HINT_FADE_MS);
    timersRef.current.push(t);
  }, [clearTimers]);

  const showHint = useCallback(() => {
    clearTimers();
    setFadingOut(false);
    setVisible(true);
    const t = setTimeout(dismiss, HINT_DISPLAY_MS);
    timersRef.current.push(t);
  }, [clearTimers, dismiss]);

  const hideImmediately = useCallback(() => {
    clearTimers();
    setVisible(false);
    setFadingOut(false);
  }, [clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return { visible, fadingOut, showHint, hideImmediately, dismiss };
}
