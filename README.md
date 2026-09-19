# HR Intelligence — AI-Powered B2B HR Intelligence Platform

HR Intelligence is an AI-Powered B2B HR Intelligence Platform for organizations using Intercom and email. It turns fragmented HR conversations into structured, explainable case intelligence: classification, employee identity resolution, related history, stakeholder context, routing, and auditable human-reviewed outcomes.

## Problem → solution → impact

Before this layer, HR operations teams could spend repetitive effort reading long conversations, identifying an employee from inconsistent names, searching related history, looking up store and stakeholder context, and carrying findings between systems. HR Intelligence normalizes Intercom, inbound email, and reviewer sample intake, structures the case, preserves deterministic identity evidence, surfaces related history and routing context, and keeps the operator in Intercom.

The defensible organizational value is centralized case intelligence, reduced repetitive lookup work, safer handling of uncertain identity matches, consistent team workflows, better traceability, and recoverable asynchronous work. This environment does not claim unmeasured savings, production volume, or customer outcomes.

[View the HR Intelligence product walkthrough](https://nagumo-hr-intelligence.vercel.app)

![HR Intelligence resolving an employee identity and related cases inside Intercom](Intercom-app/frontend/public/product-screenshots/sarah-identity-resolution.webp)

## Platform capabilities

- Signed Intercom webhook ingestion and embedded Canvas Kit workflows
- LLM-assisted extraction with deterministic fixture mode and confidence-based review
- Exact, alias, token, and fuzzy employee-name resolution
- Related-case retrieval with explainable evidence and time-window controls
- Store-directory routing and CC-recipient suggestions
- Idempotent inbound-event recording, transactional outbox dispatch, retries, and recovery
- Role-based dashboard access for administrators and read-only reviewers
- Public synthetic demo sessions with request limits and data retention controls
- A site-wide read-only “Ask HR Intelligence” assistant with public product help and role-gated case, operations, directory, and fixture-evaluation context
- Invite-controlled authentication: no public signup, no exposed reviewer password, and a short-lived server-issued reviewer walkthrough

## Architecture

```mermaid
flowchart LR
  A[Intercom or inbound email] --> B[Signed ingestion API]
  B --> C[(PostgreSQL and durable outbox)]
  B -.-> R[(Redis cache and rate limits)]
  C --> D{Execution mode}
  D -->|inline fallback| E[API process]
  D -->|BullMQ optional| F[Redis queue worker]
  D -->|Apify production| G[On-demand private HR Actor]
  E --> H[Shared intelligence handlers]
  F --> H
  G --> H
  H --> I[Gemini, matching and related cases]
  I --> C
  C --> J[Intercom Canvas and dashboard]
```

The production architecture runs the API on Render and starts private Apify Actor runs for background jobs. The webhook persists the conversation and durable dispatch state before returning; AI processing continues in the Actor. Actors load case content from PostgreSQL and call the same intelligence handlers as the optional BullMQ worker. PostgreSQL remains the source of truth. When configured, Upstash Redis provides shared API rate-limit counters and short-lived store-directory/CC-routing caches; it holds no business source of truth.

The repository supports three modes: `inline` for local/fallback execution, `bullmq` for the retained Redis worker architecture, and `apify` for on-demand execution. BullMQ still has its queue, worker, retries, exponential backoff, revision-aware IDs, worker tests, store-directory schedule, and optional Resend worker. It is an alternative deployment path; do not describe it as the live production path when Apify is selected. Production keeps `JOB_PROCESSING_MODE=apify`; Redis does not run workers in that mode.

On-demand Actors keep long AI work outside the webhook request and do not require a continuously running Redis consumer in Apify mode. Durable ingestion and revision-aware dispatch are retained. See [Apify deployment](docs/APIFY_DEPLOYMENT.md) for the Actor contract, database setup, smoke test, and operational recovery procedure.

Architecture history: the system first implemented Redis/BullMQ distributed processing with retries, revision-aware deduplication, and worker concurrency, then added the on-demand Apify production path while retaining BullMQ as an alternative. No traffic, latency, or cost metrics are claimed.

## Repository layout

```text
Intercom-app/
├── backend/
│   ├── src/
│   │   ├── config/       Environment, database, logging, Redis and provider configuration
│   │   ├── database/     Drizzle schemas, connection management and startup schema checks
│   │   ├── middlewares/  Authentication, RBAC, validation, rate limiting and signatures
│   │   ├── modules/      Feature-oriented domain and application modules
│   │   ├── jobs/         Background worker entry points
│   │   ├── queues/       BullMQ dispatch adapters
│   │   └── routes/       API and provider route composition
│   ├── scripts/          Migrations, seeds, evaluations and integration smoke tests
│   └── tests/            Unit, integration, contract and end-to-end tests
└── web/
    ├── app/              Next.js App Router pages and route-level error/loading UI
    ├── components/       Workspace, landing-page and product-walkthrough components
    ├── lib/              Typed API, authentication and display utilities
    └── public/           Sanitized product evidence
```

## Technology

| Layer            | Technology                                             |
| ---------------- | ------------------------------------------------------ |
| Frontend         | Next.js, React, TypeScript, Tailwind CSS               |
| API              | Node.js, Express, TypeScript, Zod                      |
| Data             | PostgreSQL, Drizzle ORM, pgvector, trigram search      |
| Async processing | On-demand Apify Actors, optional BullMQ/Redis, inline fallback |
| Integrations     | Intercom, Gemini, Box and optional inbound email       |
| Quality          | Jest, Supertest, Vitest, React Testing Library, ESLint, TypeScript and GitHub Actions |

## Security and reliability

- HMAC verification is applied to Intercom and inbound-email webhooks before parsing.
- Access and refresh tokens have separate secrets, issuer and audience validation.
- Refresh tokens use secure, HTTP-only cookies; dashboard authorization is enforced by backend RBAC.
- Passwords are bcrypt-hashed and are excluded from API projections.
- Production configuration validates required secrets and provider dependencies at startup.
- Rate limits protect authentication, public demos, webhooks and invitation requests.
- Synthetic reviewer records are isolated from real customer and employee data.
- The assistant uses bounded Zod-validated inputs, existing auth/RBAC boundaries, deterministic read-only tools, and never receives raw provider payloads, secrets, SQL, shell access, or mutation capabilities.

See [the product audit](docs/PRODUCT_AUDIT.md) for the problem/value matrix and recruiter-facing presentation decisions. See [recruiter evidence](docs/RECRUITER_EVIDENCE.md) for the evidence boundary and claims that should not be made.

## Local development

Requirements: Node.js 20+, Docker, and npm.

```bash
cd Intercom-app/backend
cp .env.example .env
docker compose up -d
npm ci
npm run db:migrate
npm run dev
```

`npm run db:migrate` is the normal path for both a fresh local database and production: it applies the ordered, transactional migration set. `npm run db:push` remains available only as a development convenience for intentionally prototyping a schema against a disposable local database; never use it against production or a shared environment.

In another terminal:

```bash
cd Intercom-app/frontend
cp .env.example .env.local
npm ci
npm run dev
```

The web application runs at `http://localhost:3001`; the API runs at `http://localhost:3002`.

## Verification

```bash
cd Intercom-app/backend
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build

cd ../frontend
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

The reviewer account is intentionally read-only. Intercom access is separately approved because Intercom performs identity verification for new teammates.

> This repository and its hosted product walkthrough use synthetic data only. Provider secrets and production credentials are never committed.
