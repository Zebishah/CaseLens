# Engineering readiness audit

Inspection date: 2026-09-20
Branch: `portfolio-hardening`

This audit distinguishes repository evidence, synthetic demonstration evidence, and unmeasured production outcomes.

## Overall assessment

The repository is a credible senior full-stack portfolio project with a modular TypeScript backend, PostgreSQL persistence, Intercom adapters, asynchronous processing, a Next.js operations UI, and meaningful automated coverage. The primary reliability paths are engineered rather than mocked.

It is appropriate to claim the concrete patterns listed below. It is not appropriate to claim production scale, business impact, or customer SLAs without real measurements.

## Architecture

| Area | Implementation | Status |
|---|---|---|
| Operator workflow | Intercom Inbox + Canvas UI + internal note/tag write-back | Manually demonstrable with synthetic workspace |
| Dashboard | Overview, cases, directory, operations, evaluation, architecture | Recruiter viewer is read-only |
| Ingestion | Intercom adapter and generic demo/email ingestion | Source-separated, shared intelligence pipeline |
| Persistence | PostgreSQL/Drizzle with schema migrations and targeted indexes | Implemented |
| Async execution | Private on-demand Apify Actors in production; BullMQ/Redis alternative; inline local/demo fallback | Implemented; PostgreSQL records durable intake and Actor runs |
| AI | Gemini structured extraction/classification with fixture evaluation kept separate | Implemented; live quality not benchmarked |
| Observability | Structured logs, request/correlation IDs, health/readiness, operational counters | Implemented |
| Delivery | Docker and GitHub Actions lint/typecheck/test/build | Implemented |

## Reliability guarantees verified in code

- Raw-body signed Intercom webhook and Canvas validation plus workspace checks.
- Unique `(source, external_event_id)` durable idempotency.
- Duplicate delivery increments evidence without creating a second logical event.
- A crash-interrupted Intercom event in `received` or `failed` state can resume; queued/completed duplicates are skipped.
- Revision-aware job keys distinguish later revisions from older active work in BullMQ mode; Apify uses durable revision-aware run records.
- Processor exceptions propagate to BullMQ in worker mode; Apify failures use persisted safe classifications and bounded recovery.
- Stale revisions cannot persist over newer snapshots or write back outdated intelligence.
- Generic ingestion commits event, conversation, messages, and outbox record atomically.
- Operator-confirmed fields take precedence until explicit re-analysis.
- Intercom note and tag write-back failures are isolated.
- Deferred peer refresh is a non-fatal secondary effect after successful primary processing.
- Public demo limits use atomic SQL increments rather than race-prone read/then-write checks.

## Security controls verified in code

- Viewer/admin role validation and route authorization.
- HS256 JWT verification with issuer/audience and distinct production secrets.
- HttpOnly refresh cookie backed by hashed, expiring, rotating refresh sessions with replay rejection and logout revocation.
- Production-disabled registration, login throttling, and general endpoint rate limits.
- Helmet, CORS allowlist, request-size limits, mutation schemas, generic production errors, and bounded request IDs.
- Server-only provider/database/secrets; dashboard demos are short-lived server-issued sessions and Intercom access is restricted to personal synthetic-workspace invitations.
- Payload hashing, secret-safe logging rules, and disabled public attachments.

See `docs/SECURITY.md` for limitations.

## Database work

Indexes now cover:

- conversation message hydration by conversation/time;
- reverse employee identity to conversation lookup;
- pending outbox dispatch;
- inbound source/time queries;
- case-insensitive employee email;
- trigram employee canonical-name and alias search.

The ordered migration scripts must be run in each deployed database. An index or refresh-session table in source is not proof that production has applied it. Use `npm run db:migrate` after reviewing the selected migration database URL.

## Recruiter experience

The landing page and dedicated dashboard **Demo & access** tab include an environment-driven recruiter walkthrough:

1. Enter the short-lived read-only dashboard demo from `/login`.
2. Open the configured Intercom workspace/inbox URL only when separately invited.
3. Sign in with the reviewer’s own approved Intercom account.
4. Select existing synthetic tickets and inspect the HR Intelligence panel.
5. Return to the dashboard for operational and architectural evidence.

Both surfaces include an optional YouTube/Vimeo/Loom embed URL for a subtitled guided video. Overview is reserved for operating stats; the Demo & access tab contains the video, review paths, and workspace guide. The dashboard demo is server-issued and short-lived; Intercom access is always personal and invitation-based.

## Remaining limitations

- Single-tenant, environment-scoped workspace design.
- Access token remains in session storage; CSP/XSS defense remains important. Moving it to an HttpOnly access cookie would require a broader frontend/auth and CSRF review.
- CSRF helper is not universal; Bearer access tokens are the primary mutation authorization.
- The Intercom ingestion path uses durable event state and deterministic jobs, while generic ingestion uses the explicit transactional outbox.
- Inline mode is convenient for demonstrations but is not equivalent to Apify/BullMQ crash recovery.
- Known `xlsx` advisories remain; prefer CSV and trusted admin-only imports.
- Related-case and live Gemini quality require a larger labelled evaluation before publishing accuracy.
- No measured production throughput, end-to-end latency, time savings, or failure-rate reduction.

## Final claim decision

Safe: signed webhooks, PostgreSQL idempotency, transactional outbox ingestion, revision-aware Apify runs and BullMQ jobs, retries/recovery, stale-write protection, rotating hashed refresh sessions, role-based security, atomic quotas, indexed matching/history lookups, automated CI, and a synthetic Intercom demonstration.

Unsafe until measured: production accuracy, p95 end-to-end latency, throughput, customer impact, percentage failure reduction, or vulnerability-free status.
