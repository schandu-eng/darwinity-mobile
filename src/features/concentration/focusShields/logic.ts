export type FocusStatus = 'idle' | 'running' | 'paused' | 'finalizing';
export type FocusPhase = 'work' | 'break';

export type FocusShieldSignal = {
  status: FocusStatus;
  phase: FocusPhase;
};

export type FocusShieldPermissions = {
  supported: boolean;
  usageGranted: boolean;
  overlayGranted: boolean;
  notificationsGranted: boolean;
};

export type ShieldApplyCommand = {
  type: 'apply';
  packageNames: string[];
  overlay: boolean;
  overlayUntilMs: number;
};

export type ShieldCommand = { type: 'clear' } | ShieldApplyCommand;

export const FOCUS_SHIELD_STORAGE_KEY = '@darwinity_focus_shields';
export const MAX_SHIELD_DURATION_MS = 90 * 60 * 1000;

export type FocusShieldPrefs = {
  enabled: boolean;
  packageNames: string[];
};

export const DEFAULT_FOCUS_SHIELD_PREFS: FocusShieldPrefs = {
  enabled: false,
  packageNames: [],
};

export function isSessionActive(status: FocusStatus): boolean {
  return status === 'running' || status === 'paused';
}

export function isWorkPhaseActive(status: FocusStatus, phase: FocusPhase): boolean {
  return isSessionActive(status) && phase === 'work';
}

export function uniquePackageNames(packageNames: string[], exclude: string[] = []): string[] {
  const skip = new Set(exclude.filter(Boolean));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of packageNames) {
    const name = raw.trim();
    if (!name || skip.has(name) || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}

export function computeOverlayUntilMs(now = Date.now()): number {
  return now + MAX_SHIELD_DURATION_MS;
}

export function buildShieldCommand(input: {
  status: FocusStatus;
  phase: FocusPhase;
  enabled: boolean;
  packageNames: string[];
  permissions: FocusShieldPermissions;
  now?: number;
  excludePackageNames?: string[];
}): ShieldCommand {
  const packages = uniquePackageNames(input.packageNames, input.excludePackageNames);
  const ready =
    input.enabled &&
    packages.length > 0 &&
    input.permissions.supported &&
    input.permissions.usageGranted &&
    input.permissions.overlayGranted &&
    isSessionActive(input.status);

  if (!ready) return { type: 'clear' };

  return {
    type: 'apply',
    packageNames: packages,
    overlay: isWorkPhaseActive(input.status, input.phase),
    overlayUntilMs: computeOverlayUntilMs(input.now),
  };
}

export function shieldCommandsEqual(a: ShieldCommand | null, b: ShieldCommand): boolean {
  if (!a) return false;
  if (a.type !== b.type) return false;
  if (a.type === 'clear' && b.type === 'clear') return true;
  if (a.type === 'apply' && b.type === 'apply') {
    if (a.overlay !== b.overlay) return false;
    if (a.packageNames.length !== b.packageNames.length) return false;
    const next = new Set(b.packageNames);
    return a.packageNames.every((name) => next.has(name));
  }
  return false;
}

export function parseFocusShieldPrefs(raw: string | null): FocusShieldPrefs {
  if (!raw) return { ...DEFAULT_FOCUS_SHIELD_PREFS };
  try {
    const parsed = JSON.parse(raw) as Partial<FocusShieldPrefs>;
    return {
      enabled: Boolean(parsed.enabled),
      packageNames: uniquePackageNames(
        Array.isArray(parsed.packageNames) ? parsed.packageNames.map(String) : []
      ),
    };
  } catch {
    return { ...DEFAULT_FOCUS_SHIELD_PREFS };
  }
}

export function unsupportedPermissions(): FocusShieldPermissions {
  return {
    supported: false,
    usageGranted: false,
    overlayGranted: false,
    notificationsGranted: false,
  };
}

export function permissionsReady(permissions: FocusShieldPermissions): boolean {
  return permissions.supported && permissions.usageGranted && permissions.overlayGranted;
}
