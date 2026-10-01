import type { FocusPhase, FocusShieldSignal, FocusStatus } from './logic';

type Listener = (signal: FocusShieldSignal) => void;

let latest: FocusShieldSignal = { status: 'idle', phase: 'work' };
const listeners = new Set<Listener>();

export function getFocusShieldSignal(): FocusShieldSignal {
  return latest;
}

export function publishFocusShieldSignal(status: FocusStatus, phase: FocusPhase): void {
  if (latest.status === status && latest.phase === phase) return;
  latest = { status, phase };
  listeners.forEach((listener) => listener(latest));
}

export function subscribeFocusShieldSignal(listener: Listener): () => void {
  listeners.add(listener);
  listener(latest);
  return () => {
    listeners.delete(listener);
  };
}
