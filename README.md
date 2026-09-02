# HR Case Operations Platform (CaseOps)

Sanitized, recruiter-demonstrable HR intelligence system. **Intercom is the operator workspace** (inbox + Canvas Kit). This application is the intelligence, operations, and evaluation layer. Demo and inbound email are optional source adapters.

The public portfolio demo runs with `INTERCOM_ENABLED=false`. That does not mean Intercom is unused in the product: it is the intended operator UI when enabled.

## What it does

1. Ingests a conversation (Intercom webhook, demo form, or Resend email).
2. Resolves employees and stores against a directory.
3. Classifies the case, finds related cases, and recommends store stakeholders.
4. Shows results in the Intercom Canvas Inbox App and writes a concise internal note.
5. Exposes the same persisted records on an authenticated dashboard (not a second inbox).

## Repository layout

- `Intercom-app/backend` — Express API, optional BullMQ workers, PostgreSQL. Redis is required only for `JOB_PROCESSING_MODE=bullmq`.
- `Intercom-app/web` — Next.js intelligence/ops dashboard
- `docs/` — architecture, security, case study, Intercom hub, production-readiness audit, acceptance matrix

## Quick start (local)

1. PostgreSQL (`Intercom-app/backend/docker-compose.yml` or a hosted equivalent). Redis is optional for `JOB_PROCESSING_MODE=inline`.
2. Backend:

```bash
cd Intercom-app/backend
cp .env.example .env
# Set DATABASE_URL and JWT_SECRET
# Portfolio demo: JOB_PROCESSING_MODE=inline, INTERCOM_ENABLED=false, LLM_MODE=fixture
# Queue architecture: JOB_PROCESSING_MODE=bullmq plus REDIS_URL
npm install
npm run db:push          # or npm run db:migrate-portfolio after an existing schema
npm run db:seed-portfolio
npm test
npm run dev
```

The API listens on `http://localhost:3002`.

3. Frontend:

```bash
cd Intercom-app/web
cp .env.example .env.local
npm install
npm run lint
npm run typecheck
npm run dev
```

Open `http://localhost:3001`. Sign in to the dashboard. Use **Try Demo** only with synthetic data.

## Tests and measurements

Do not quote a historical test count. Re-run:

```bash
cd Intercom-app/backend
npm test
npm run lint
npm run typecheck
npm run eval:run
npm run bench:local
npm run intercom:canvas-smoke
```

See `docs/BENCHMARKS.md`, `docs/FINAL_PRODUCTION_READINESS_AUDIT.md`, and `docs/HR_INTELLIGENCE_ACCEPTANCE_MATRIX.md`.

Live Intercom is **not** verified until Developer Workspace webhooks and Canvas URLs succeed. The Canvas Kit Hub page rendering blank is an external blocker.

## Safety

Never commit `.env` files, API keys, or real employee/customer data. See `docs/SECURITY.md`.
