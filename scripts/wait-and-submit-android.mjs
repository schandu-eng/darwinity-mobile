#!/usr/bin/env node
/**
 * Wait for an EAS Android build to finish, then submit to Play internal track.
 *
 * Usage:
 *   node ./scripts/wait-and-submit-android.mjs
 *   node ./scripts/wait-and-submit-android.mjs --id <build-id>
 *   node ./scripts/wait-and-submit-android.mjs --latest
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const serviceAccountPath = join(root, 'secrets/google-play-service-account.json');
const pollMs = 30_000;
const maxWaitMs = 90 * 60_000;

function runJson(cmd) {
  const out = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(out);
}

function parseArgs(argv) {
  const args = { latest: false, id: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--latest') args.latest = true;
    if (argv[i] === '--id' && argv[i + 1]) {
      args.id = argv[++i];
      args.latest = false;
    }
  }
  return args;
}

function resolveBuildId({ latest, id }) {
  if (id) return id;
  if (!latest) {
    throw new Error('Pass --id <build-id> or --latest');
  }
  const builds = runJson('npx eas-cli build:list --platform android --status finished --limit 1 --json --non-interactive');
  const build = builds?.[0];
  if (!build?.id) {
    throw new Error('No finished Android build found. Wait for the build to complete first.');
  }
  return build.id;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBuild(buildId) {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    const build = runJson(`npx eas-cli build:view ${buildId} --json`);
    const status = build.status;
    process.stdout.write(`Build ${buildId}: ${status}\n`);
    if (status === 'FINISHED') return build;
    if (status === 'ERRORED' || status === 'CANCELED') {
      throw new Error(`Build ${buildId} ended with status ${status}`);
    }
    await sleep(pollMs);
  }
  throw new Error(`Timed out waiting for build ${buildId}`);
}

function submitBuild(buildId) {
  if (!existsSync(serviceAccountPath)) {
    throw new Error(
      `Missing ${serviceAccountPath}. Create the Google Play service account, download the JSON key, and save it there (or upload via expo.dev → project → Credentials).`
    );
  }

  const result = spawnSync(
    'npx',
    [
      'eas-cli',
      'submit',
      '--platform',
      'android',
      '--profile',
      'production',
      '--id',
      buildId,
      '--non-interactive',
      '--wait',
    ],
    { cwd: root, stdio: 'inherit' }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const args = parseArgs(process.argv.slice(2));
const buildId = resolveBuildId(args);

console.log(`Waiting for Android build ${buildId}...`);
await waitForBuild(buildId);
console.log(`Submitting build ${buildId} to Play internal track...`);
submitBuild(buildId);
console.log('Submit complete.');
