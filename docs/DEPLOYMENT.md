# Deployment (Render)

The repository does not maintain a Render keep-alive workflow. The old file was nested under `Intercom-app/.github`, where GitHub Actions would not execute it, and artificial uptime is not part of the portfolio deployment model.

Do not provision paid services from this document. Use existing external PostgreSQL. Upstash Redis is optional for local/fallback operation and is recommended for production shared rate limiting and directory caches. It does not run workers in Apify mode.

## Production API service

- Build: `cd Intercom-app/backend && npm run build:render`
- Start: `NODE_ENV=production RUN_API=true JOB_PROCESSING_MODE=apify RUN_WORKERS=false node dist/server.js`
- Background work: private on-demand Apify Actor runs dispatched by the Render API
- Supported alternative: `JOB_PROCESSING_MODE=bullmq RUN_WORKERS=true` plus `REDIS_URL`
- Local/fallback/demo mode: `JOB_PROCESSING_MODE=inline`
- Health: `GET /health`
- Readiness: `GET /ready` (reports safe Redis configured/reachable flags; Redis is required for readiness only when `JOB_PROCESSING_MODE=bullmq`)

PostgreSQL is the source of truth. In production, keep `JOB_PROCESSING_MODE=apify`, `RUN_API=true`, and `RUN_WORKERS=false`. Configure the Upstash connection URL as `REDIS_URL` on the Render API service to enable shared API rate-limit counters and short-lived store routing/CC caches. Use the provider's `rediss://` URL; credentials remain in Render environment settings and must not be committed. With no `REDIS_URL`, the API uses process-local memory rate limits and reads directory metadata directly from PostgreSQL. During a Redis outage, rate limits temporarily become per-instance and directory/CC caches bypass Redis.

Deployment sequence:

1. Create or select an Upstash Redis database in the deployment region and copy its Redis connection URL (`rediss://...`).
2. Add that value as the secret `REDIS_URL` in the Render API service environment. Keep `JOB_PROCESSING_MODE=apify`, `RUN_API=true`, and `RUN_WORKERS=false`.
3. Deploy the API using the existing Render build and start commands below; no database migration or worker service is needed for Redis.
4. Check `GET /ready` after deploy. Confirm `redisConfigured: true` and `redisReachable: true`; the response does not expose the URL or credentials.

Set `INTERCOM_ENABLED=false` and `BOX_SYNC_ENABLED=false` unless you are connecting the Developer Workspace. Set `LLM_MODE=fixture` for deterministic samples, or `LLM_MODE=live` plus `GEMINI_API_KEY` for arbitrary custom cases.

For approved reviewer dashboard accounts, configure the Brevo SMTP API sender on the backend:

```env
BREVO_ENABLED=true
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=access@your-verified-domain.example
BREVO_SENDER_NAME=HR Intelligence
PUBLIC_APP_URL=https://your-frontend.example
INVITE_TTL_HOURS=48
```

The sender address/domain must be verified in Brevo. Approval sends a one-time password setup link; it does not grant administrator access or create an Intercom teammate.

When Intercom is enabled on Render, set backend-only:

- `INTERCOM_ACCESS_TOKEN`
- `INTERCOM_CLIENT_SECRET`
- `INTERCOM_WORKSPACE_ID`
- `INTERCOM_ADMIN_ID`
- Optional: `INTERCOM_API_BASE_URL`, `INTERCOM_API_VERSION` (defaults `https://api.intercom.io` / `2.11`)

Webhook URL: `https://<api-host>/webhooks/intercom`  
Canvas URLs: `https://<api-host>/canvas/initialize`, `/canvas/submit`, `/canvas/configure`  

See [INTERCOM_DEVELOPER_HUB.md](./INTERCOM_DEVELOPER_HUB.md).

Apply schema before serving traffic:

```bash
cd Intercom-app/backend
npm run db:migrate
npm run db:seed-portfolio
```

The command above applies the ordered, recorded, transactional application migrations and is the only migration command for production. `db:push` is retained solely for disposable local prototyping and must not be run against a shared or production database. For an existing deployment, inspect the target database and migration history first. Targeted `db:migrate-*` commands remain available for controlled diagnosis or a single migration. Never run migrations automatically during API startup.

After deploying persistent refresh-session validation, users with refresh cookies issued before this migration may need to sign in once more because those older sessions were not stored in the database. Short-lived recruiter demo sessions are unaffected.

## Render backend settings

Use `Intercom-app/backend` as the service **Root Directory**. Use `npm run build:render` as the **Build Command** and `npm start` as the **Start Command**. The Render build script uses `npm install --include=dev` so deployment remains resilient if Render invokes the command from a workspace where npm does not discover the nested lockfile; the tracked lockfile remains available for normal local and CI installs.

Frontend: deploy `Intercom-app/web` with `NEXT_PUBLIC_API_URL` pointing at the API origin. The backend allowlist includes the current portfolio origins (`https://nagumo-hr-intelligence.vercel.app` and `https://hr-intercom.onrender.com`) plus `RENDER_EXTERNAL_URL` for same-service Render deployments. For another frontend domain, add its exact origin to `CORS_ORIGINS` with no trailing slash.

## Cold start

The UI Wake Demo button polls `/ready`. A sleeping free instance is shown as “Starting demo service”, not as an application bug.
# Recruiter-facing deployment note

The hosted product walkthrough should expose the public landing story and deterministic assistant even when optional providers are unavailable. Configure the API URL and CORS origin for the web app, keep reviewer credentials separate from Intercom invitations, and use synthetic or sanitized records only. The assistant is not a dependency of core case ingestion or processing.
