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
- A Darwinity API (or compatible backend)

## Setup

```bash
git clone https://github.com/schandu-eng/darwinity-mobile.git
cd darwinity-mobile
npm install
```

Configuration is **local-only**. This repository does not ship env files or env templates.

Create private env files on your machine (they are gitignored):

- `.env.development` — local Expo runs
- `.env.production` — production-shaped local / store builds

Or inject the same keys via [EAS Environment variables](https://docs.expo.dev/eas/environment-variables/) for cloud builds. Never commit env files, `credentials.json`, or `secrets/`.

`app.config.js` reads those values at build time when present.

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

1. Keep secrets out of commits (any `.env*`, keystores, service accounts).
2. Run `npm run lint` before opening a PR.
3. Prefer small, focused changes with a clear description of behavior.

## License

MIT — see [LICENSE](./LICENSE).
