# Darwinity Mobile

Open-source Expo / React Native client for [Darwinity](https://www.darwinity.com) — study materials, quizzes, flashcards, podcasts, and focus tools on iOS and Android.

## Stack

- Expo SDK 54 / React Native 0.81
- TypeScript, React Navigation, TanStack Query, Zustand
- RevenueCat (IAP), Google / Apple sign-in, Mixpanel / Statsig (optional)
- Local Expo modules under `modules/` (focus shields, study alarm)

Shared study logic (quiz grading, PDF export helpers, feature tours, games) lives in `./shared` and is resolved via the `@shared/*` alias.

## Prerequisites

- Node 20+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) / EAS CLI for store builds
- A Darwinity API (or compatible backend) reachable at `API_BASE_URL`

## Setup

```bash
git clone https://github.com/schandu-eng/darwinity-mobile.git
cd darwinity-mobile
npm install

cp .env.development.example .env.development
cp .env.production.example .env.production
# Edit the env files with your API URL, OAuth client IDs, and keys
```

## Run

```bash
npm start          # Expo dev server (development env)
npm run ios        # iOS simulator
npm run android    # Android emulator / device
```

Production-shaped local runs:

```bash
npm run start:prod
```

## Configuration

| Variable | Purpose |
| --- | --- |
| `API_BASE_URL` | Backend base URL |
| `GOOGLE_*_CLIENT_ID` | Google OAuth clients |
| `GOOGLE_SIGN_IN_ENABLED` | Show native Google Sign-In when clients are valid |
| `REVENUECAT_*_API_KEY` | Public RevenueCat SDK keys (`appl_` / `goog_`) |
| `EXPO_PUBLIC_MIXPANEL_TOKEN` | Analytics (optional) |
| `EXPO_PUBLIC_STATSIG_CLIENT_KEY` | Feature gates (optional) |
| `EXPO_PROJECT_ID` | Expo / EAS project UUID |

Store builds should inject secrets via [EAS Environment variables](https://docs.expo.dev/eas/environment-variables/), not committed `.env` files.

`eas.json` submit fields (`appleId`, `ascAppId`, Play service account path) are placeholders — replace them locally or via EAS secrets. Never commit `credentials.json` or `secrets/`.

## Project layout

```
App.tsx
app.config.js
src/           # screens, components, API, stores
shared/        # cross-platform study helpers (vendored)
modules/       # local Expo native modules
scripts/       # release preflight / store handoff templates
```

## Contributing

Issues and PRs are welcome. Please:

1. Keep secrets out of commits (`.env*`, keystores, service accounts).
2. Run `npm run lint` before opening a PR.
3. Prefer small, focused changes with a clear description of behavior.

## License

MIT — see [LICENSE](./LICENSE).
