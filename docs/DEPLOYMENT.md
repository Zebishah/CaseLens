# Deployment (Render)

The repository does not maintain a Render keep-alive workflow. External uptime monitoring can use the public API root described below; no GitHub Actions schedule is required.

Do not provision paid services from this document. Use existing external PostgreSQL. Upstash Redis is optional for local/fallback operation and is recommended for production shared rate limiting and directory caches. It does not run workers in Apify mode.

## Production API service

- Build: `cd Intercom-app/backend && npm run build:render`
- Start: `NODE_ENV=production RUN_API=true JOB_PROCESSING_MODE=apify RUN_WORKERS=false node dist/server.js`
- Background work: private on-demand Apify Actor runs dispatched by the Render API
- Supported alternative: `JOB_PROCESSING_MODE=bullmq RUN_WORKERS=true` plus `REDIS_URL`
- Local/fallback/demo mode: `JOB_PROCESSING_MODE=inline`
- Public liveness: `GET /` (HTTP 200 with an uncached JSON success response; no authentication or dependency checks)
- Health: `GET /health` (HTTP 204)
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

Frontend: deploy `Intercom-app/frontend` with `NEXT_PUBLIC_API_URL` pointing at the API origin. The backend allowlist includes the current portfolio origins (`https://nagumo-hr-intelligence.vercel.app` and `https://hr-intercom.onrender.com`) plus `RENDER_EXTERNAL_URL` for same-service Render deployments. For another frontend domain, add its exact origin to `CORS_ORIGINS` with no trailing slash.

## Cold start

The UI Wake Demo button polls `/ready`. A sleeping free instance is shown as “Starting demo service”, not as an application bug.

## UptimeRobot monitoring

After deploying the backend change, create a monitor with these settings:

| Setting | Value |
| --- | --- |
| Monitor type | HTTP(s) |
| Friendly name | HR Intelligence API |
| URL | `https://hr-intercom.onrender.com/` (use the current API origin if it changes) |
| HTTP method | GET, selected under Advanced Settings |
| Monitoring interval | 5 minutes |
| Expected status | 200 |
| Authentication / custom headers | None required |
| Alert contact | Your preferred downtime notification contact |

The root returns `{ "success": true, "data": { "status": "ok", "message": "HR Intelligence API is running" } }`. It checks that the HTTP process responds, without querying PostgreSQL, Redis, or AI providers. Express also handles `HEAD /` with the same HTTP status and no body. Use the existing `/ready` endpoint for dependency readiness monitoring instead.

See [UptimeRobot's monitor setup guide](https://help.uptimerobot.com/en/articles/11358364-how-to-create-your-first-monitor-on-uptimerobot-quick-setup-guide) and [HTTP method guidance](https://uptimerobot.com/knowledge-hub/monitoring/which-urls-should-you-monitor/).

Five-minute requests can help avoid Render's 15-minute idle spin-down, but they do not guarantee uninterrupted availability: free services can restart and share a 750-hour monthly workspace allowance. See [Render Free service limits](https://render.com/docs/free). Paid web services do not spin down due to inactivity; see [Render's FAQ](https://render.com/docs/faq).
# Recruiter-facing deployment note

The hosted product walkthrough should expose the public landing story and deterministic assistant even when optional providers are unavailable. Configure the API URL and CORS origin for the web app, keep reviewer credentials separate from Intercom invitations, and use synthetic or sanitized records only. The assistant is not a dependency of core case ingestion or processing.
