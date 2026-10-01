# Security

## Secrets and env files

- This repo must never contain env files or env templates (`.env`, `.env.*`).
- Create private `.env.development` / `.env.production` only on your machine, or use EAS Environment variables for cloud builds.
- Never commit keystores, `.p8` / `.p12` files, `credentials.json`, or Google Play service-account JSON (`secrets/`).
- `EXPO_PUBLIC_*` values are embedded in the client bundle. Only put public-safe keys there.

## If a secret was committed

1. Rotate it immediately in the provider console.
2. Treat the old value as compromised even after deleting it from the working tree — git history still has it.
3. Optionally purge history with `git filter-repo` or BFG only after rotation.

## Auth

Tokens are stored on-device (AsyncStorage). Keep XSS/native WebView surfaces careful when rendering untrusted HTML.
