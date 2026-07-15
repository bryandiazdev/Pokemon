# Security

## Threat model
Users upload photos of valuable physical property and store purchase history and PII (email,
display name). We defend against: cross-tenant data access, injection, malicious uploads
(decompression bombs, disguised MIME), billing tampering, webhook forgery/replay, brute force,
scraping/abuse, and secret leakage.

## Defense in depth
1. **Server-side authorization** in the service layer for every mutation/read of user data.
2. **Row Level Security** in Postgres as the backstop — never the only check. Policies restrict
   every user-owned table to `auth.uid() = user_id`; catalog/market data is public-read only
   where appropriate; admin actions require a verified server-side role (`profiles.is_admin` /
   `admin_roles`), never a client claim.
3. Never trust: client-provided user IDs, client-provided entitlements, client role checks, or
   hidden navigation.

## Input validation
- Every route handler / server action validates body, query, and params with **Zod**.
- File uploads: verify **magic-byte signature** (not just extension/MIME header), enforce size
  limits, cap decoded pixel dimensions (decompression-bomb guard), strip EXIF/metadata, and store
  under per-user paths.

## Storage & images
- Private by default. Access via **short-lived signed URLs**; buckets are never public.
- Private full-resolution images are not persisted in browser storage beyond what a scan needs.
- Share links for grade reports are **revocable** and expose no private account data.

## Billing
- Stripe webhooks: **signature verified** + **idempotent** (dedupe on event id in
  `stripe_webhook_events`). Subscription state derived only from Stripe/webhooks, never the client.

## Transport & headers
- HTTPS only; secure, `HttpOnly`, `SameSite` cookies for sessions.
- **Content-Security-Policy**, `X-Content-Type-Options`, `Referrer-Policy`,
  `Strict-Transport-Security`, `X-Frame-Options`/frame-ancestors, Permissions-Policy.

## Rate limiting (Upstash Redis)
Applied to: auth, password reset, card search, quick scans, grade scans, exports, imports,
alerts, public shared reports, certification verification, and all provider-backed requests.
Sliding-window per user + per IP; scan/grade routes also gated by entitlement usage meters.

## Logging & secrets
- Structured logs with request/job/scan IDs. **Never log**: passwords, auth tokens, Stripe
  secrets, provider API keys, full payment data, private image URLs, or sensitive PII.
- Secrets only via environment (validated in `@psr/config`); none committed. `.env.example`
  ships placeholders only. Dependency scanning + secret scanning run in CI.

## Data lifecycle
- **Account deletion** and **data export** are first-class. Deletion cascades user data and
  purges private storage. Training data is separated and independently deletable.
- Retention controls documented; consent for model-training is explicit and revocable.

## Reporting
Security contact + coordinated disclosure policy published at `/security` (placeholder in this
build). Sentry captures exceptions with PII scrubbing enabled.
