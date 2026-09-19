# HR Intelligence API

The backend is a strict-TypeScript Express API for signed conversation ingestion, HR intelligence processing, employee resolution, related-case retrieval, Intercom Canvas rendering, and portfolio operations.

See the [repository README](../../README.md) for the product overview and complete architecture.

## Development setup

```bash
cp .env.example .env
npm ci
docker compose up -d
npm run db:migrate
npm run dev
```

`npm run db:migrate` is the normal path for fresh local databases and production. `npm run db:push` is retained only for disposable local schema prototyping and must not be used against shared or production databases.

The API listens on `http://localhost:3002` by default. Interactive API documentation is available at `/docs` outside production.

## Processing modes

- `JOB_PROCESSING_MODE=inline`: processes work in the API process and does not require Redis. This is the recommended low-cost demo configuration.
- `JOB_PROCESSING_MODE=bullmq`: dispatches jobs to the retained BullMQ implementation. It requires `REDIS_URL`; workers start only when `RUN_WORKERS=true`.
- `JOB_PROCESSING_MODE=apify`: persists revision-aware Actor dispatch records and starts the private HR Actor asynchronously. It requires `APIFY_API_TOKEN` and `APIFY_ACTOR_ID`, and does not start BullMQ workers. If `REDIS_URL` is set, the API uses Redis only for distributed rate limiting and ephemeral store-directory/CC caches.

`RUN_API` and `RUN_WORKERS` control which process roles start. The production background path is Render API plus private, on-demand Apify Actors (`JOB_PROCESSING_MODE=apify`, `RUN_API=true`, `RUN_WORKERS=false`). Configure `REDIS_URL` with the Upstash `rediss://` URL for shared API rate limits and short-lived directory/CC caches. PostgreSQL remains authoritative; when Redis is absent or unavailable, the API uses local rate-limit counters and direct PostgreSQL reads. BullMQ/Redis remains a supported worker alternative; inline mode is for local, fallback, and demo execution. Follow [Apify deployment and smoke testing](../../docs/APIFY_DEPLOYMENT.md) for Actor setup.

The BullMQ worker architecture remains available and tested as an alternative deployment. Inline mode remains the local/fallback path.

## Main modules

| Module                      | Responsibility                                                         |
| --------------------------- | ---------------------------------------------------------------------- |
| `ingestion`                 | Idempotent inbound events, transactional outbox records and recovery   |
| `intercom` / `webhook`      | Signature verification, conversation synchronization and write-back    |
| `canvas`                    | Embedded Intercom UI state, actions and error-safe rendering           |
| `intelligence`              | Processing lifecycle, related-case search, ranking and summaries       |
| `employee`                  | Extraction, validation, directory matching and name-variant resolution |
| `store-directory`           | Directory imports, synchronization and CC-recipient routing            |
| `demo`                      | Rate-limited synthetic sessions and deterministic/live processing      |
| `auth` / `user`             | Session issuance, password hashing and role-based access               |
| `operations` / `evaluation` | Restricted reliability controls and quality evidence                   |

## Database changes

For local schema development and deployment:

```bash
npm run db:migrate
```

Deployment-safe SQL migrations and their TypeScript runners are stored in `scripts/`. `db:migrate` applies and records the ordered application migrations transactionally. Existing targeted `db:migrate-*` scripts remain available for controlled repair/debugging. Review the selected `DATABASE_MIGRATION_URL` or `DATABASE_URL` before running a migration. Migrations are never applied at application startup. `db:push` is development-only and is not part of deployment.

## Useful commands

```bash
npm run lint                 # Static code-quality checks
npm run typecheck            # Strict TypeScript validation
npm test                     # Unit and integration suite
npm run test:coverage        # Coverage report
npm run build                # Production compilation
npm run eval:run             # Deterministic quality evaluation
npm run bench:local          # Local matching benchmarks
npm run intercom:smoke       # Live Intercom integration check
npm run intercom:canvas-smoke
```

Seed scripts require explicit credentials through environment variables. Never commit `.env` files, provider secrets, database URLs, or generated credentials.
