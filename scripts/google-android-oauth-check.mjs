#!/usr/bin/env node
/**
 * Prints Android Google Sign-In setup facts for Darwinity.
 * Optionally extracts upload-key SHA-1 from a production AAB.
 *
 *   node ./scripts/google-android-oauth-check.mjs
 *   node ./scripts/google-android-oauth-check.mjs --aab /path/to/app.aab
 *   node ./scripts/google-android-oauth-check.mjs --aab-url <eas-artifact-url>
 */
import { createWriteStream, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status}): ${url}`);
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

function extractSha1FromAab(aabPath) {
  const dir = mkdtempSync(join(tmpdir(), 'darwinity-aab-'));
  try {
    execFileSync('unzip', ['-qo', aabPath, 'META-INF/*', '-d', dir], { stdio: 'ignore' });
    const meta = join(dir, 'META-INF');
    const listing = execFileSync('ls', [meta], { encoding: 'utf8' });
    const rsa = listing
      .split('\n')
      .map((s) => s.trim())
      .find((f) => /\.(RSA|DSA|EC)$/i.test(f));
    if (!rsa) throw new Error('No signing cert found in AAB META-INF');
    const certPath = join(meta, rsa);
    const pem = execFileSync(
      'openssl',
      ['pkcs7', '-in', certPath, '-inform', 'DER', '-print_certs'],
      { encoding: 'utf8' },
    );
    const fp = execFileSync('openssl', ['x509', '-noout', '-fingerprint', '-sha1'], {
      input: pem,
      encoding: 'utf8',
    });
    const match = fp.match(/Fingerprint=(.+)/i);
    return (match?.[1] || fp).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const env = readEnvFile('.env.production');
const packageName = 'com.darwinity.mobile';
const webClientId = (env.GOOGLE_WEB_CLIENT_ID || '').trim();
const androidClientId = (env.GOOGLE_ANDROID_CLIENT_ID || '').trim();

console.log('Darwinity Android Google Sign-In checklist\n');
console.log(`Package:              ${packageName}`);
console.log(`GOOGLE_WEB_CLIENT_ID: ${webClientId || '(missing — required for idToken aud)'}`);
console.log(
  `GOOGLE_ANDROID_CLIENT_ID: ${androidClientId || '(missing — must exist in Cloud Console for package+SHA-1)'}`,
);
console.log('');
console.log('Google Cloud Console → APIs & Services → Credentials');
console.log('  1) Web OAuth client  → must match GOOGLE_WEB_CLIENT_ID (backend audience)');
console.log('  2) Android OAuth client → package com.darwinity.mobile + SHA-1 fingerprints');
console.log('     - Upload key SHA-1 (EAS keystore / AAB signature)');
console.log('     - Play App Signing SHA-1 (Play Console → App integrity) once published');
console.log('');
console.log('Do NOT use expo-auth-session / custom URI schemes for Android Google login.');
console.log('Native module: @react-native-google-signin/google-signin');
console.log('');

const aabPath = argValue('--aab');
const aabUrl = argValue('--aab-url');

try {
  let path = aabPath;
  let cleanup = null;
  if (!path && aabUrl) {
    cleanup = mkdtempSync(join(tmpdir(), 'darwinity-dl-'));
    path = join(cleanup, 'app.aab');
    console.log(`Downloading AAB…`);
    await download(aabUrl, path);
  }
  if (path) {
    const sha1 = extractSha1FromAab(path);
    console.log(`Upload-key SHA-1 from AAB:\n  ${sha1}\n`);
    console.log('Add that exact fingerprint to the Android OAuth client, then wait a few minutes.');
    if (cleanup) rmSync(cleanup, { recursive: true, force: true });
  } else {
    console.log('Tip: pass --aab <file> or --aab-url <eas artifact> to print the upload-key SHA-1.');
  }
} catch (error) {
  console.error(`SHA-1 extract failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
