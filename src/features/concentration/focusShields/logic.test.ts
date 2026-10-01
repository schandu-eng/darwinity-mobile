import {
  buildShieldCommand,
  isSessionActive,
  isWorkPhaseActive,
  parseFocusShieldPrefs,
  permissionsReady,
  shieldCommandsEqual,
  uniquePackageNames,
  type FocusShieldPermissions,
} from './logic';
import {
  getFocusShieldSignal,
  publishFocusShieldSignal,
  subscribeFocusShieldSignal,
} from './signal';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function perms(over: Partial<FocusShieldPermissions> = {}): FocusShieldPermissions {
  return {
    supported: true,
    usageGranted: true,
    overlayGranted: true,
    notificationsGranted: true,
    ...over,
  };
}

function applyReady(
  over: Parameters<typeof buildShieldCommand>[0] extends infer T ? Partial<T> : never
) {
  return buildShieldCommand({
    status: 'running',
    phase: 'work',
    enabled: true,
    packageNames: ['com.instagram.android'],
    permissions: perms(),
    now: 1_000,
    ...over,
  });
}

const cases: [string, () => void][] = [
  [
    'idle never starts a service',
    () => {
      const cmd = applyReady({ status: 'idle' });
      assert(cmd.type === 'clear', 'idle should clear');
    },
  ],
  [
    'finalizing clears shields',
    () => {
      const cmd = applyReady({ status: 'finalizing' });
      assert(cmd.type === 'clear', 'finalizing should clear');
    },
  ],
  [
    'running work applies overlay',
    () => {
      const cmd = applyReady({ status: 'running', phase: 'work' });
      assert(cmd.type === 'apply' && cmd.overlay, 'work should overlay');
      assert(cmd.type === 'apply' && cmd.overlayUntilMs === 1_000 + 90 * 60 * 1000, '90m cap');
    },
  ],
  [
    'paused work still overlays',
    () => {
      const cmd = applyReady({ status: 'paused', phase: 'work' });
      assert(cmd.type === 'apply' && cmd.overlay, 'paused work should overlay');
    },
  ],
  [
    'running break keeps service without overlay',
    () => {
      const cmd = applyReady({ status: 'running', phase: 'break' });
      assert(cmd.type === 'apply' && cmd.overlay === false, 'break unblocks apps');
    },
  ],
  [
    'paused break does not overlay',
    () => {
      const cmd = applyReady({ status: 'paused', phase: 'break' });
      assert(cmd.type === 'apply' && !cmd.overlay, 'paused break should not overlay');
    },
  ],
  [
    'toggle off clears',
    () => {
      const cmd = applyReady({ enabled: false });
      assert(cmd.type === 'clear', 'disabled should clear');
    },
  ],
  [
    'empty list clears',
    () => {
      const cmd = applyReady({ packageNames: [] });
      assert(cmd.type === 'clear', 'no apps should clear');
    },
  ],
  [
    'missing usage permission clears',
    () => {
      const cmd = applyReady({ permissions: perms({ usageGranted: false }) });
      assert(cmd.type === 'clear', 'usage required');
    },
  ],
  [
    'missing overlay permission clears',
    () => {
      const cmd = applyReady({ permissions: perms({ overlayGranted: false }) });
      assert(cmd.type === 'clear', 'overlay required');
    },
  ],
  [
    'unsupported platform clears',
    () => {
      const cmd = applyReady({ permissions: perms({ supported: false }) });
      assert(cmd.type === 'clear', 'unsupported should clear');
    },
  ],
  [
    'dedupes and drops excluded packages',
    () => {
      const names = uniquePackageNames(
        [' com.instagram.android ', 'com.instagram.android', '', 'com.darwinity.mobile'],
        ['com.darwinity.mobile']
      );
      assert(names.length === 1 && names[0] === 'com.instagram.android', 'sanitize packages');
    },
  ],
  [
    'identical apply commands are equal ignoring overlayUntil',
    () => {
      const a = applyReady({ now: 1 });
      const b = applyReady({ now: 99_000 });
      assert(
        shieldCommandsEqual(a, b),
        'until timestamp is not part of equality for packages/overlay'
      );
    },
  ],
  [
    'package list change is not equal',
    () => {
      const a = applyReady({ packageNames: ['a'] });
      const b = applyReady({ packageNames: ['a', 'b'] });
      assert(!shieldCommandsEqual(a, b), 'package change must reapply');
    },
  ],
  [
    'overlay flag change is not equal',
    () => {
      const a = applyReady({ phase: 'work' });
      const b = applyReady({ phase: 'break' });
      assert(!shieldCommandsEqual(a, b), 'work/break must reapply');
    },
  ],
  [
    'clear equals clear',
    () => {
      assert(shieldCommandsEqual({ type: 'clear' }, { type: 'clear' }), 'clear==clear');
      assert(!shieldCommandsEqual(null, { type: 'clear' }), 'null is not skippable');
    },
  ],
  [
    'running work and paused work share the same overlay command',
    () => {
      const a = applyReady({ status: 'running', phase: 'work' });
      const b = applyReady({ status: 'paused', phase: 'work' });
      assert(shieldCommandsEqual(a, b), 'pause should not bounce the native service');
    },
  ],
  [
    'prefs parse recovers from junk',
    () => {
      const junk = parseFocusShieldPrefs('{not json');
      assert(junk.enabled === false && junk.packageNames.length === 0, 'junk prefs');
      const ok = parseFocusShieldPrefs(
        JSON.stringify({ enabled: true, packageNames: ['x', 'x', ''] })
      );
      assert(ok.enabled && ok.packageNames.join(',') === 'x', 'parsed prefs');
    },
  ],
  [
    'session helpers',
    () => {
      assert(isSessionActive('running') && isSessionActive('paused'), 'session');
      assert(!isSessionActive('idle') && !isSessionActive('finalizing'), 'not session');
      assert(isWorkPhaseActive('running', 'work'), 'work');
      assert(!isWorkPhaseActive('running', 'break'), 'break');
      assert(permissionsReady(perms()), 'ready');
      assert(!permissionsReady(perms({ overlayGranted: false })), 'not ready');
    },
  ],
  [
    'signal ignores duplicate status/phase',
    () => {
      publishFocusShieldSignal('idle', 'work');
      const seen: string[] = [];
      const unsub = subscribeFocusShieldSignal((s) => seen.push(`${s.status}:${s.phase}`));
      publishFocusShieldSignal('idle', 'work');
      publishFocusShieldSignal('running', 'work');
      publishFocusShieldSignal('running', 'work');
      publishFocusShieldSignal('running', 'break');
      publishFocusShieldSignal('idle', 'work');
      unsub();
      assert(seen.join('|') === 'idle:work|running:work|running:break|idle:work', seen.join('|'));
      assert(getFocusShieldSignal().status === 'idle', 'latest status');
    },
  ],
  [
    'full pomodoro command sequence',
    () => {
      const labels: string[] = [];
      const steps: Parameters<typeof applyReady>[0][] = [
        { status: 'idle', phase: 'work' },
        { status: 'running', phase: 'work' },
        { status: 'paused', phase: 'work' },
        { status: 'running', phase: 'break' },
        { status: 'running', phase: 'work' },
        { status: 'finalizing', phase: 'work' },
        { status: 'idle', phase: 'work' },
      ];
      let prev = null as ReturnType<typeof applyReady> | null;
      for (const step of steps) {
        const cmd = applyReady(step);
        const skipped = shieldCommandsEqual(prev, cmd);
        labels.push(
          `${step.status}/${step.phase}:${cmd.type}${cmd.type === 'apply' ? (cmd.overlay ? '+overlay' : '+break') : ''}${skipped ? ':skip' : ''}`
        );
        if (!skipped) prev = cmd;
      }
      assert(
        labels.join(' > ') ===
          'idle/work:clear > running/work:apply+overlay > paused/work:apply+overlay:skip > running/break:apply+break > running/work:apply+overlay > finalizing/work:clear > idle/work:clear:skip',
        labels.join(' > ')
      );
    },
  ],
];

let failed = 0;
for (const [name, run] of cases) {
  try {
    run();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}

console.log(`${cases.length} passed`);
