#!/usr/bin/env node
/**
 * Validates local iOS App Store release readiness.
 * Run: npm run appstore:preflight
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const requiredAssets = ['assets/icon.png', 'assets/splash-icon.png'];
const requiredEnvKeys = [
  'API_BASE_URL',
  'SITE_ORIGIN',
];

const requiredRevenueCatIosKey = 'REVENUECAT_IOS_API_KEY';

const FIRST_UPLOAD_HINTS = [
  'First App Store upload checklist:',
  '  1) App Store Connect version must be 1.0.4 (same as app.config.js). Change it from 1.0 and Save.',
  '  2) npm run eas:build:ios  — first run creates Distribution cert + App Store profile (Apple 2FA).',
  '  3) npm run eas:submit:ios — wait until the build is FINISHED, then upload the .ipa.',
  '  4) Connect → Build → pick 1.0.4 after Apple finishes processing.',
  '  5) Encryption: No (ITSAppUsesNonExemptEncryption is already false).',
];

function readEnvFile(name) {
  const path = join(root, name);
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    out[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return out;
}

function readAppConfig() {
  const source = readFileSync(join(root, 'app.config.js'), 'utf8');
  return {
    version: source.match(/version:\s*'([^']+)'/)?.[1] ?? null,
    bundleId: source.match(/bundleIdentifier:\s*[^'"]*['"]([^'"]+)['"]/)?.[1] ?? null,
    buildNumber: source.match(/buildNumber:\s*'([^']+)'/)?.[1] ?? null,
    usesNonExemptEncryption: /ITSAppUsesNonExemptEncryption:\s*false/.test(source),
  };
}

function readEasSubmitIos() {
  const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
  return eas?.submit?.production?.ios ?? {};
}

function easLoggedIn() {
  try {
    execSync('npx eas-cli whoami', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

const env = readEnvFile('.env.production');
const app = readAppConfig();
const submitIos = readEasSubmitIos();
const issues = [];
const warnings = [];

if (app.bundleId !== 'com.darwinity.mobile') {
  issues.push(`iOS bundleIdentifier should be com.darwinity.mobile (found ${app.bundleId ?? 'none'})`);
}

if (app.version !== '1.0.4') {
  warnings.push(`App version is ${app.version ?? 'unknown'} — App Store Connect must use the same string`);
}

if (!app.usesNonExemptEncryption) {
  warnings.push('ITSAppUsesNonExemptEncryption is not false — App Store Connect will ask for export compliance docs');
}

for (const asset of requiredAssets) {
  if (!existsSync(join(root, asset))) {
    issues.push(`Missing asset: ${asset}`);
  }
}

for (const key of requiredEnvKeys) {
  const value = (env[key] ?? process.env[key] ?? '').trim();
  if (!value) warnings.push(`Missing .env.production / EAS secret: ${key}`);
}

const rcIosKey = (env[requiredRevenueCatIosKey] ?? process.env[requiredRevenueCatIosKey] ?? '').trim();
if (!rcIosKey) {
  issues.push(
    `Missing ${requiredRevenueCatIosKey} (set in .env.production or EAS secrets). Public SDK key starts with appl_`,
  );
} else if (!rcIosKey.startsWith('appl_')) {
  issues.push(
    `${requiredRevenueCatIosKey} should be the iOS public SDK key (appl_…), not the secret REST key`,
  );
}

const webClientId = (env.GOOGLE_WEB_CLIENT_ID ?? process.env.GOOGLE_WEB_CLIENT_ID ?? '').trim();
const iosClientId = (env.GOOGLE_IOS_CLIENT_ID ?? process.env.GOOGLE_IOS_CLIENT_ID ?? '').trim();
const googleSignInEnabled = /^(true|1|yes)$/i.test(
  (env.GOOGLE_SIGN_IN_ENABLED ?? process.env.GOOGLE_SIGN_IN_ENABLED ?? '').trim(),
);
if (webClientId && iosClientId && webClientId === iosClientId) {
  issues.push(
    'GOOGLE_WEB_CLIENT_ID must be the Web OAuth client, not the iOS client (same value will break idToken / Sign-In)',
  );
}
if (!googleSignInEnabled || !iosClientId) {
  warnings.push(
    'iOS Google Sign-In is hidden in this build (set GOOGLE_SIGN_IN_ENABLED=true and a real GOOGLE_IOS_CLIENT_ID to show it)',
  );
}

const ascAppId = String(submitIos.ascAppId ?? '').trim();
if (!ascAppId || /YOUR_|example|changeme/i.test(ascAppId) || !/^\d+$/.test(ascAppId)) {
  issues.push(
    `eas.json submit.production.ios.ascAppId must be your numeric App Store Connect app id (found ${submitIos.ascAppId ?? 'none'})`,
  );
}

const appleId = String(submitIos.appleId ?? '').trim();
if (!appleId || /YOUR_|example\.com|changeme/i.test(appleId)) {
  warnings.push('eas.json is missing a real submit.production.ios.appleId');
}

if (!easLoggedIn()) {
  warnings.push('Not logged into EAS — run: npm run eas:login');
}

console.log('Darwinity iOS App Store preflight\n');
console.log(`Bundle ID: ${app.bundleId ?? 'unknown'}`);
console.log(`App version: ${app.version ?? 'unknown'}`);
console.log(`iOS buildNumber: ${app.buildNumber ?? 'unknown'}`);
console.log(`ASC app ID: ${submitIos.ascAppId ?? 'unknown'}\n`);

if (issues.length) {
  console.log('BLOCKERS:');
  for (const item of issues) console.log(`  ✗ ${item}`);
  console.log('');
}

if (warnings.length) {
  console.log('WARNINGS:');
  for (const item of warnings) console.log(`  ! ${item}`);
  console.log('');
}

console.log(FIRST_UPLOAD_HINTS.join('\n'));
console.log('');

if (!issues.length && !warnings.length) {
  console.log('All local checks passed. Next: npm run eas:build:ios');
}

process.exit(issues.length ? 1 : 0);
