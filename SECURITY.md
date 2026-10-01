# Security

## Secrets

- Never commit real `.env.development` / `.env.production` files, keystores, `.p8` / `.p12` files, or Google Play service-account JSON.
- Use `.env.*.example` as the source of required variable names with empty or placeholder values only.
- `EXPO_PUBLIC_*` values are embedded in the client bundle. Only put public-safe keys there (Mixpanel project token, Statsig client key, RevenueCat public SDK keys, Google OAuth client IDs).
- Do **not** put Stripe/Razorpay secret keys, JWT secrets, webhook secrets, admin passwords, or AutoProctor client secrets in mobile env files.

## If a secret was committed

1. Rotate it immediately in the provider console.
2. Treat the old value as compromised even after deleting it from the working tree — git history still has it.
3. Optionally purge history with `git filter-repo` or BFG only after rotation.

## Auth

Tokens are stored on-device (AsyncStorage). Keep XSS/native WebView surfaces careful when rendering untrusted HTML.
