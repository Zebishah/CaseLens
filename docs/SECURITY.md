# Security

## Controls implemented

- Intercom webhooks are verified on the raw request body with HMAC-SHA1 and Canvas requests with HMAC-SHA256 using timing-safe comparison.
- The configured Intercom workspace is checked before ingestion. Durable `inbound_events` uniqueness prevents duplicate notification processing, and interrupted `received` or `failed` events can be resumed.
- Intercom ingestion stores a SHA-256 payload hash.
- Generic demo/email ingestion writes its inbound event, conversation, messages, and outbox event in one PostgreSQL transaction.
- BullMQ jobs use revision-aware deterministic IDs. Retry attempts and bounded exponential backoff are configurable; processing failures propagate so BullMQ can retry them.
- Older intelligence revisions cannot overwrite newer snapshots or write stale results back to Intercom.
- Private API routes require verified JWTs and explicit viewer/admin authorization. JWTs are restricted to HS256 with configured issuer and audience.
- Production startup requires distinct access/refresh secrets of at least 32 characters.
- Refresh tokens use an HttpOnly cookie. Login has a separate failure-oriented rate limit.
- Helmet, strict CORS, bounded bodies, schema validation, production-safe errors, and validated request/correlation IDs are enabled.
- Public demo tokens are stored as hashes, expire, and use atomic database quota increments.
- Open registration is disabled in production. Attachments are disabled for the public demo.
- Targeted indexes cover Intercom IDs, message hydration, reverse employee history, pending outbox, inbound event lookups, normalized email, and trigram name/alias matching.

## Recruiter access security

Shared Intercom credentials are not published. Public visitors submit a validated, rate-limited invitation request using their own email. Requests are deduplicated without disclosing existing state, stored with explicit consent, and reviewable only by administrators. Intercom remains the invitation and identity-verification authority.

The direct Intercom workspace link is rendered only for dashboard administrators. Reviewer accounts cannot access invitation administration, Operations, AI Quality, or mutation/recovery controls.

Backend credentials—including `INTERCOM_ACCESS_TOKEN`, `INTERCOM_CLIENT_SECRET`, JWT secrets, Gemini keys, database URLs, and Redis URLs—remain server-only and must never use a `NEXT_PUBLIC_*` name.

## Residual risks and honest limitations

- The portfolio deployment is single-tenant. Workspace validation is environment-based, not per-row multi-tenant authorization.
- Refresh-token rotation/revocation is not implemented. The access token is in session storage, so successful same-origin XSS could read it.
- The CSRF helper is not wired to every mutation. Bearer JWT is the dashboard's primary authorization; do not claim comprehensive CSRF-token enforcement.
- Generic ingestion has a transactional outbox. Intercom uses durable event state plus deterministic revision jobs; do not claim every adapter uses the identical outbox path.
- Inline demo mode intentionally has weaker crash recovery than PostgreSQL + BullMQ worker mode.
- `xlsx` has known advisories. CSV is preferred for sanitized imports; imports remain admin-only and size-limited. Do not claim vulnerability-free dependencies.
- A queued Intercom event proves delivery/enqueue state, not successful live Gemini completion.
- Synthetic/local evaluation is not production AI accuracy or customer impact.
