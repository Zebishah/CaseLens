# Portfolio Upgrade Plan — HR Case Operations Platform (historical)

> Historical planning snapshot. Its original assessments predate the current production path, durable ingestion, Apify Actors, refresh sessions, and ordered migrations. For the current design, see [Architecture](ARCHITECTURE.md) and [the production readiness audit](FINAL_PRODUCTION_READINESS_AUDIT.md).

> Working branch: `portfolio-hardening`  
> Audit date: 2026-09-01  
> Checkout: untracked `Intercom-app/` on top of `85f289c` (Initial commit)

This document records the **verified** current system, baseline command results, and the incremental upgrade path. It is not a claim that the upgrade is complete.

---

## Verified current architecture

### Applications and entry points

There is **one runnable application**: `Intercom-app/backend` (Express + TypeScript). There is **no standalone frontend**. The Intercom Canvas JSON builder (`canvas.builder.ts`) is the only UI. Root `README.md` is empty besides the title.

| Entry | Path | Role |
|-------|------|------|
| HTTP API | `Intercom-app/backend/src/app.ts` | Express app, middleware, routes |
| Process | `Intercom-app/backend/src/server.ts` | Listens on `PORT`; side-effect-imports BullMQ workers |
| Workers | `src/jobs/intercom-intelligence.job.ts`, `store-directory-sync.job.ts`, `example.job.ts` | Always started with the API process |
| Env | `src/config/env.config.ts` | Zod parse of `process.env` at import time |

### HTTP routes and middleware

Global order: Helmet → CORS → compression → request logger → **Intercom routes (raw body)** → `express.json()` → `/docs` → `/api` (rate limit) → `GET /health` → error handler.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/health` | none | `{ status: 'ok' }` — no DB/Redis check |
| GET | `/docs` | none | Swagger UI |
| HEAD/POST | `/webhooks/intercom` | Intercom HMAC-SHA1 | Raw body; conversation sync + enqueue |
| POST | `/canvas/initialize` | Intercom HMAC-SHA256 | Sidebar canvas |
| POST | `/canvas/submit` | Intercom HMAC-SHA256 | Refresh / reanalyze / store edit / dismiss |
| POST | `/canvas/configure` | Intercom HMAC-SHA256 | Static configure canvas; no Zod |
| POST | `/api/auth/register` | **none** | Open registration |
| POST | `/api/auth/login` | **none** | JWT issued |
| POST | `/api/auth/refresh-token` | **none** | Stub: returns the same token |
| GET/POST/PUT/DELETE | `/api/users` | **none** | Full CRUD; passwords may leak |
| GET/POST | `/api/example` | **none** | In-memory scaffold |

`authMiddleware` exists and is **not mounted on any route**. Roles `admin` / `user` exist with **no role guard**. `/api` rate limit is 100 req / 15 min. Intercom routes are **not** rate-limited.

CORS: production allowlist is the placeholder `https://your-domain.com`; development is `*`.

### Database

Drizzle ORM + PostgreSQL. Source of truth: `src/database/schema/*.ts`. No committed `drizzle/` migration history. Schema is applied via `db:push` plus one-off SQL scripts.

**Extensions:** `vector` (unused embedding column), `pg_trgm` (employee fuzzy match).

**Tables:** `users`, `examples` (unused by service), `employee_identities`, `employee_aliases`, `conversations` (`intercom_id` UNIQUE NOT NULL), `conversation_messages` (`embedding_vector` never written), `conversation_employees`, `app_logs`, `companies`, `company_fixed_contacts`, `store_directory`, `store_directory_sync_runs`.

**Not present:** inbound event store, outbox, demo sessions, case feedback/audit, source-agnostic case IDs.

### BullMQ

| Queue | Job | Attempts | Notes |
|-------|-----|----------|-------|
| `intercom-intelligence-queue` | `process-intelligence` | **1** | jobId `intelligence-{conversationId}` / `peer-refresh-{id}` |
| `store-directory-sync-queue` | `sync-store-directory` | 2 | Midnight cron if Box configured |
| `example-queue` | `log-example` | default | Scaffold |

Intelligence concurrency default 3. In-process dedup is an **in-memory `Map`** (`intelligence-processing.lock.ts`) — not multi-instance safe. Webhook notification IDs are logged, not stored.

### Intercom

Webhook: verify → sync conversation from Intercom API → upsert on `intercom_id` → enqueue intelligence if stale. Canvas: HMAC → snapshot from DB or wait up to ~2.7s → enqueue if needed. Intercom env vars are **required at process start**.

### Gemini / matching

1. Optional Intercom refresh  
2. Gemini JSON extraction (`names`, `caseType`) with subject-line fallback  
3. Global employee match (exact / alias / pg_trgm / token score)  
4. Related-case retrieval (identity IDs + name terms, 6-month window)  
5. CC recipients from store directory by store number  
6. Snapshot JSON on `conversations.intelligence_snapshot`

Related-case **category filter is currently disabled**. Fuzzy related-case retrieval is implemented but **not wired**. Vector search is **not implemented**.

### Box / directory

Optional Client Credentials download of an Excel workbook. Parser maps three hardcoded company sheets. Sync replaces directory data in a transaction. Cron skipped when Box env is missing. Seed/test fixtures contain **real company names, domains, and personal-looking emails**.

### Auth

JWT (`JWT_SECRET`, `JWT_EXPIRES_IN`). Bearer middleware unused. Refresh is a no-op. User create via `/api/users` can store **plaintext** passwords (register path hashes).

### Tests

53 files under `Intercom-app/backend/tests` (unit + integration). Integration tests use Supertest; env is faked in `tests/setup-env.cjs`. No E2E browser tests. No evaluation dataset. No GitHub Actions CI (only a Render keep-alive workflow).

---

## Baseline command results (2026-09-01, this checkout)

| Command | Result |
|---------|--------|
| `git status` | Branch `portfolio-hardening` created from `main`. `Intercom-app/` untracked. No other uncommitted tracked changes. |
| `npm install` (backend) | Succeeded (686 packages). npm audit: 15 vulnerabilities (xlsx critical among them). |
| `npm test` | **53 suites, 338 tests passed.** This matches the previously reported 338. |
| `npx tsc -p tsconfig.json --noEmit` | Pass |
| `npm run build` | Pass |
| `npm run lint` | **Fail — 23 errors** (unused vars / prefer-const / `no-control-regex` in postgres log transport) |
| Migration validation | **Not executed against Postgres.** `pg_isready` → no listener on localhost:5432. Redis `PING` → `PONG`. No `drizzle/` SQL history. Existing scripts: `scripts/migrate-*.sql`. |

Secrets scan (locations/categories only; **no values printed**):

| Category | Locations |
|----------|-----------|
| Env placeholders | `Intercom-app/backend/.env.example` |
| Test env stubs | `Intercom-app/backend/tests/setup-env.cjs` |
| Client company names / domains | `store-directory.constants.ts`, `store-directory.test-seed.ts`, parser/CC tests, reporter-context tests, canvas tests, `Intercom-app/docs/*client*` |
| Personal-looking emails in tests | `employee.reporter-context.util.test.ts`, `employee.token-match.util.test.ts` |
| No committed `.env` files | None found |
| Git history | Root commit only (`85f289c`); `Intercom-app/` is not in git history yet |

---

## Confirmed problems

1. **Intercom-coupled domain.** `conversations.intercom_id` is required unique. Intake, sync, and canvas assume Intercom payloads. The public demo cannot run without Intercom credentials today (`env.config.ts` requires four Intercom vars).
2. **No durable webhook/event idempotency.** Retries re-sync. BullMQ jobId helps only while a job is queued. In-memory Map does not survive restart or a second instance.
3. **No transactional outbox.** Enqueue happens after DB writes but is not recovered if Redis fails after commit.
4. **Intelligence retries are application-level only** (`attempts: 1` on the queue; max 3 failure snapshots). No dead-letter UI or authorized replay.
5. **Auth is scaffolding.** Private user CRUD is public. Registration is open. Refresh token is a stub. No CSRF, no cookie sessions, CORS placeholder.
6. **No standalone UI** for recruiters.
7. **Sensitive fixtures** (company names, work emails, personal-looking addresses) in source and docs.
8. **Health is not readiness.** `/health` does not check Postgres or Redis. Logger always writes to a local `logs/` directory (unsuitable as durable storage on Render).
9. **Workers cannot be disabled.** API and workers always start together; no `RUN_API` / `RUN_WORKERS`.
10. **Lint is red** on current checkout (23 errors). CI cannot require lint until these are fixed.
11. **Unused scaffolding:** example module (in-memory), `zod-to-json-schema`, npm `pgvector`, embedding column.
12. **Open registration + user API** are unsafe for a public portfolio deploy.

---

## Material architecture conflicts (documented before redesign)

These are real mismatches with the request. The upgrade **does not** rewrite the intelligence pipeline or replace `conversations` with a new case table.

| Conflict | Incremental decision |
|----------|----------------------|
| Cases are Intercom conversations | Keep `conversations` as the case store. Add `source` (`demo` / `email` / `intercom`). Keep `intercom_id` unique by writing a **source-prefixed external id** for non-Intercom cases (`demo:{id}`, `email:{id}`). Skip Intercom API sync when `source !== 'intercom'`. |
| Intelligence processor is Intercom-aware | Reuse `processIntelligenceForConversation` with `skipSync: true` for demo/email. Do not duplicate extraction/matching. |
| Canvas is the only UI | Keep Canvas + Intercom webhook as an **optional adapter**. Add a Next.js app that talks to new HTTP APIs. |
| Intercom required at startup | `INTERCOM_ENABLED=false` makes Intercom vars optional; Intercom routes return 503 without a secret. |
| Box Excel sheet names are client-specific | Parser stays; default seed/demo companies become fictional. Box remains behind `BOX_SYNC_ENABLED`. |
| Vector column exists | **Do not** enable vector retrieval unless a controlled comparison is later recorded. Current related-case method stays. |
| Example/user scaffold | Harden auth; keep example module out of the public surface (do not delete files). |

---

## Proposed changes

### 1. One ingestion service

Normalized event (`CaseIngestionEvent`): source, external event ID, sender, recipients, subject, sanitized text, received-at, attachment metadata (disabled in v1), provider metadata.

Adapters:

1. **Intercom** — existing webhook maps into the event, then the same service.  
2. **Resend** — `POST /api/webhooks/resend`, signature on raw body, `email.received` only.  
3. **Demo submit** — authenticated/bounded demo session or sample-case POST.

All adapters: validate → insert `inbound_events` + `outbox_events` in one transaction → commit → dispatch BullMQ → mark outbox dispatched. LLM work stays in the worker.

### 2. Durable idempotency

Unique `(source, external_event_id)`. Email also stores Resend webhook id and received-email id; one logical case per received email. BullMQ `jobId` = external event id when compatible. Recover undispatched outbox on startup and on an interval.

### 3. Recruiter demo

Expiring sessions: hashed token, limits (emails, live LLM ops), generated `case-<token>@<RESEND_RECEIVING_DOMAIN>`. Public users cannot see other sessions, directory admin, queues, prompts, or secrets.

Sample-case workflow runs the **real** pipeline. Two labelled modes: Live LLM vs Deterministic fixture (never labelled as live).

### 4. Security

Protect every private endpoint. Cookie sessions for admin (`httpOnly`, `Secure` in production, `SameSite=lax` or `strict`). CSRF on cookie mutations. Strict CORS. Helmet. Rate limits (IP, sender, demo). Safe errors. Redacted logs. Disable open registration in production.

### 5. Frontend (Next.js)

Original TypeScript UI: Overview, Cases, Try Demo, Directory, Operations, AI Evaluation, Architecture. Wake-demo / readiness polling for Render cold start. No Intercom branding.

### 6. Directory

Generated seed + CSV/XLSX import. Box remains optional. Overlapping syncs prevented.

### 7. Observability

JSON logs, request/correlation IDs, `/health` + `/ready` (Postgres + Redis), graceful shutdown. No secret/conversation logging.

### 8. Render

`RUN_API` / `RUN_WORKERS` (both true by default for free-tier single process). External Postgres + Redis. No persistent local files.

---

## Database migrations

New SQL: `Intercom-app/backend/scripts/migrate-portfolio-ingestion-schema.sql` (also applied by a `db:migrate-portfolio` tsx script).

| Change | Purpose |
|--------|---------|
| `conversations.source` | `intercom` / `email` / `demo` |
| `conversations.correlation_id` | Trace across event → queue → snapshot |
| `conversations.demo_session_id` | Scope public demo cases |
| `conversations.processing_mode` | `live` / `fixture` |
| `inbound_events` | Durable ingest + unique `(source, external_event_id)` |
| `outbox_events` | Transactional handoff to BullMQ |
| `demo_sessions` | Recruiter session tokens (hashed), limits, expiry |
| `case_corrections` | Original vs corrected values |
| `case_feedback` | Reviewer feedback |
| `ai_evaluation_runs` | Versioned eval results |

Existing tables and Intercom columns remain.

---

## Security changes

- Optional integration credentials only when the matching `*_ENABLED` flag is true.  
- Public vs admin route split.  
- Webhook signatures required; unverified bodies never processed.  
- Raw body capture only on webhook paths.  
- Attachments disabled in the first public release.  
- Sanitize HTML; LLM uses plain text.  
- Replace client fixtures with generated data.  
- `.env*` ignored except `.env.example` (names + descriptions only).  
- Do not commit `Intercom-app/docs` client-delivery files.

---

## Testing strategy

Preserve all **338** existing tests. Add:

- **Unit:** event normalization, email parse, validation, idempotency key, error classification, sanitization, confidence thresholds.  
- **Integration:** webhook signatures, duplicate deliveries, outbox recovery, replay, directory import, mocked Resend/Intercom/Gemini, authz.  
- **E2E (API):** start demo session → submit sample → queued/processing → snapshot → feedback persisted.  
- **GitHub Actions:** install, lint, typecheck, unit, integration, build, SQL migration file presence (no live paid services).

Do not weaken assertions to pass CI.

---

## Benchmark strategy

Scripts under `Intercom-app/backend/scripts/benchmarks/` write dated JSON under a **gitignored** raw directory; summarized numbers go in `docs/BENCHMARKS.md` labelled **Local benchmark** only. Metrics: webhook ack p50/p95, e2e processing p50/p95 (fixture mode), duplicate deliveries vs cases, retry/dead-letter, eval scores. Never present local numbers as production.

Vector vs keyword comparison is **out of scope** until a controlled run exists. Related-case quality uses the current structured/keyword method.

---

## Frontend architecture

`Intercom-app/web` — Next.js (App Router) + TypeScript + Tailwind. Talks to the backend via `NEXT_PUBLIC_API_URL` only. Server secrets never in `NEXT_PUBLIC_*`. Pages: overview, cases, case detail, try-demo, directory, operations, evaluation, architecture. Wake Demo polls `/ready` with bounded backoff and copy “Starting demo service” (not an application error).

---

## Deployment architecture

Single Render Web Service can run API + workers (`RUN_API=true`, `RUN_WORKERS=true`). Separate worker process later without rewriting processors. External PostgreSQL + Redis. Frontend: Render static / Node or any host that can call the API CORS origin. Cold start: `/health`, `/ready`, frontend Wake Demo.

---

## Expected files to change

**New (backend):** ingestion domain + service + outbox recovery; Resend adapter; demo session module; case/ops/eval HTTP APIs; schema tables; portfolio SQL migration; seed data; eval dataset + command; benchmark scripts; CI workflow.

**Modified (backend):** `env.config.ts`, `app.ts`, `server.ts`, webhook service (adapter), conversation schema/repository, intelligence snapshot fields, store-directory constants/seed/tests (sanitized names), logger (no required local files in production), `.env.example`, `.gitignore`.

**New (web):** Next.js app as listed in section 12 of the request.

**New (docs):** README, ARCHITECTURE, SECURITY, CASE_STUDY, BENCHMARKS, DEPLOYMENT, DEMO_GUIDE, RECRUITER_EVIDENCE, this plan.

**Not deleted:** Intercom client/signature/canvas, Box client, existing intelligence/matching, existing tests.

---

## Risks and rollback

| Risk | Mitigation |
|------|------------|
| Breaking 338 tests | Characterization preserved; additive schema; Intercom path still upserts on `intercom_id` |
| Env optional flags break tests | `setup-env.cjs` still sets Intercom stubs; tests import env after setup |
| Company-name sanitization | Update constants and tests together; parser behavior unchanged |
| Render single-process memory | Default worker concurrency stays modest (3); fixture mode for public demo |
| Resend not configured | Demo sample-case path does not require Resend |
| Postgres unavailable during this session | Migration SQL reviewed in-repo; apply when DATABASE_URL is available |
| xlsx advisory | Keep for Excel import; do not parse untrusted files without validation |

Rollback: remain on `portfolio-hardening` until merge. No force-push. Intercom production path stays reachable with `INTERCOM_ENABLED=true` and existing credentials.

---

## Implementation order

1. Safety: gitignore, `.env.example`, sanitization, lint baseline.  
2. Env flags + process bootstrap (`RUN_API` / `RUN_WORKERS`, `/ready`).  
3. Domain event + ingestion + outbox + schema (tests first).  
4. Intercom adapter wrap (existing tests still pass).  
5. Demo sessions + sample cases + fixture LLM.  
6. Resend webhook adapter.  
7. Authz + case/ops/directory/eval APIs.  
8. Frontend.  
9. Evaluation command, benchmarks, docs, CI.  

Each step keeps `npm test` green.
