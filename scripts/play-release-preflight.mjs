#!/usr/bin/env node
/**
 * Validates local Android Play release readiness.
 * Run: npm run play:preflight
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const requiredAssets = ['assets/icon.png', 'assets/adaptive-icon.png', 'assets/splash-icon.png'];
const requiredEnvKeys = [
  'API_BASE_URL',
  'SITE_ORIGIN',
  'GOOGLE_WEB_CLIENT_ID',
  'GOOGLE_ANDROID_CLIENT_ID',
];

/** Must be present for Play billing — empty keys bake into the AAB and break IAP. */
const requiredRevenueCatAndroidKey = 'REVENUECAT_ANDROID_API_KEY';

const GOOGLE_SIGNIN_HINTS = [
  'Google Sign-In Android checklist:',
  '  1) Install a binary that includes @react-native-google-signin (EAS build ≥ 1.0.3 / versionCode 44).',
  '     Error 400 invalid_request in a browser/Custom Tab = old expo-auth-session binary, not native Sign-In.',
  '  2) Google Cloud → Android OAuth client for package com.darwinity.mobile with BOTH SHA-1s:',
  '     - Upload key SHA-1 (from production AAB): A9:86:B0:D3:E9:CA:EF:DA:E3:77:28:B0:36:AB:B5:DB:7A:08:61:C7',
  '     - Play Console → App integrity → App signing key certificate SHA-1',
  '     Re-print: npm run google:android-check -- --aab-url <eas-artifact>',
  '  3) GoogleSignin.configure webClientId must be the Web OAuth client (not the Android client).',
  '  4) OTA/update alone cannot add the native module — rebuild + reinstall/submit required.',
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

function readPackageName() {
  const configPath = join(root, 'app.config.js');
  const source = readFileSync(configPath, 'utf8');
  const match = source.match(/package:\s*[^'"]*['"]([^'"]+)['"]/);
  return match?.[1] ?? null;
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
const packageName = readPackageName();
const issues = [];
const warnings = [];

if (packageName !== 'com.darwinity.mobile') {
  issues.push(`Android package should be com.darwinity.mobile (found ${packageName ?? 'none'})`);
}

for (const asset of requiredAssets) {
  if (!existsSync(join(root, asset))) {
    issues.push(`Missing asset: ${asset}`);
  }
}

for (const key of requiredEnvKeys) {
  const value = (env[key] ?? process.env[key] ?? '').trim();
  if (!value) warnings.push(`Missing .env.production value: ${key}`);
}

const rcAndroidKey = (env[requiredRevenueCatAndroidKey] ?? process.env[requiredRevenueCatAndroidKey] ?? '').trim();
if (!rcAndroidKey) {
  issues.push(
    `Missing ${requiredRevenueCatAndroidKey} (set in .env.production or EAS secrets). Public SDK key starts with goog_`,
  );
} else if (!rcAndroidKey.startsWith('goog_')) {
  issues.push(
    `${requiredRevenueCatAndroidKey} should be the Android public SDK key (goog_…), not the secret REST key`,
  );
}

const rcIosKey = (env.REVENUECAT_IOS_API_KEY ?? process.env.REVENUECAT_IOS_API_KEY ?? '').trim();
if (!rcIosKey) {
  warnings.push('Missing REVENUECAT_IOS_API_KEY (needed for App Store builds; starts with appl_)');
} else if (!rcIosKey.startsWith('appl_')) {
  warnings.push('REVENUECAT_IOS_API_KEY should be the iOS public SDK key (appl_…)');
}

const webClientId = (env.GOOGLE_WEB_CLIENT_ID ?? '').trim();
const androidClientId = (env.GOOGLE_ANDROID_CLIENT_ID ?? '').trim();
if (webClientId && androidClientId && webClientId === androidClientId) {
  issues.push(
    'GOOGLE_WEB_CLIENT_ID must be the Web OAuth client, not the Android client (same value will break idToken / Sign-In)',
  );
}

if ((readFileSync(join(root, 'app.config.js'), 'utf8').match(/projectId:\s*'([^']+)'/)?.[1] ?? '') === 'CHANGE_ME') {
  warnings.push('EAS projectId is still CHANGE_ME — run: npm run eas:init');
}

if (!easLoggedIn()) {
  warnings.push('Not logged into EAS — run: npm run eas:login');
}

console.log('Darwinity Android Play preflight\n');
console.log(`Package: ${packageName ?? 'unknown'}`);
console.log(`App version: ${readFileSync(join(root, 'app.config.js'), 'utf8').match(/version:\s*'([^']+)'/)?.[1] ?? 'unknown'}`);
console.log(`Android versionCode: ${readFileSync(join(root, 'app.config.js'), 'utf8').match(/versionCode:\s*(\d+)/)?.[1] ?? 'unknown'}\n`);

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

console.log(GOOGLE_SIGNIN_HINTS.join('\n'));
console.log('');

if (!issues.length && !warnings.length) {
  console.log('All local checks passed. Next: npm run eas:build:android');
}

process.exit(issues.length ? 1 : 0);
