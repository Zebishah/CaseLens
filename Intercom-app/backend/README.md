# HR Intelligence API

The backend is a strict-TypeScript Express API for signed conversation ingestion, HR intelligence processing, employee resolution, related-case retrieval, Intercom Canvas rendering, and portfolio operations.

See the [repository README](../../README.md) for the product overview and complete architecture.

## Development setup

```bash
cp .env.example .env
npm ci
docker compose up -d
npm run db:push
npm run dev
```

The API listens on `http://localhost:3002` by default. Interactive API documentation is available at `/docs` outside production.

## Processing modes

- `JOB_PROCESSING_MODE=inline`: processes work in the API process and does not require Redis. This is the recommended low-cost demo configuration.
- `JOB_PROCESSING_MODE=bullmq`: dispatches jobs to the retained BullMQ implementation. It requires `REDIS_URL`; workers start only when `RUN_WORKERS=true`.
- `JOB_PROCESSING_MODE=apify`: persists revision-aware Actor dispatch records and starts the private HR Actor asynchronously. It requires `APIFY_API_TOKEN` and `APIFY_ACTOR_ID`, but does not connect to Redis or start BullMQ workers.

`RUN_API` and `RUN_WORKERS` control which process roles start. The production background path is Render API plus private, on-demand Apify Actors (`JOB_PROCESSING_MODE=apify`, `RUN_API=true`, `RUN_WORKERS=false`). BullMQ/Redis is a supported alternative; inline mode is for local, fallback, and demo execution. Follow [Apify deployment and smoke testing](../../docs/APIFY_DEPLOYMENT.md) for Actor setup.

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

For local schema development:

```bash
npm run db:push
```

Deployment-safe SQL migrations and their TypeScript runners are stored in `scripts/`. After creating the base schema with `npm run db:push`, use `npm run db:migrate` to apply and record the ordered application migrations. Existing targeted `db:migrate-*` scripts remain available for controlled repair/debugging. Review the selected `DATABASE_MIGRATION_URL` or `DATABASE_URL` before running a migration. Migrations are never applied at application startup.

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
