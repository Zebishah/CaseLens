# Deployment (Render-compatible)

Do not provision paid services from this document. Use existing external PostgreSQL. Redis is required only for `JOB_PROCESSING_MODE=bullmq`.

## Web service

- Build: `cd Intercom-app/backend && npm run build:render`
- Start: `NODE_ENV=production RUN_API=true JOB_PROCESSING_MODE=inline node dist/server.js`
  - Production queue process: `JOB_PROCESSING_MODE=bullmq RUN_WORKERS=true` plus `REDIS_URL`
- Health: `GET /health`
- Readiness: `GET /ready` (PostgreSQL; Redis only when `JOB_PROCESSING_MODE=bullmq`)

Set `JOB_PROCESSING_MODE=inline` for the public HR Intelligence product walkthrough so no BullMQ workers run and Redis is not required.

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
npm run db:push
npm run db:migrate-portfolio
npm run db:migrate-intercom-sync
npm run db:migrate-intercom-source-revision
npm run db:seed-portfolio
```

## Render backend settings

Use `Intercom-app/backend` as the service **Root Directory**. Use `npm run build:render` as the **Build Command** and `npm start` as the **Start Command**. The Render build script uses `npm install --include=dev` so deployment remains resilient if Render invokes the command from a workspace where npm does not discover the nested lockfile; the tracked lockfile remains available for normal local and CI installs.

Frontend: deploy `Intercom-app/web` with `NEXT_PUBLIC_API_URL` pointing at the API origin. The backend allowlist includes the current portfolio origins (`https://nagumo-hr-intelligence.vercel.app` and `https://hr-intercom.onrender.com`) plus `RENDER_EXTERNAL_URL` for same-service Render deployments. For another frontend domain, add its exact origin to `CORS_ORIGINS` with no trailing slash.

## Cold start

The UI Wake Demo button polls `/ready`. A sleeping free instance is shown as “Starting demo service”, not as an application bug.
# Recruiter-facing deployment note

The hosted product walkthrough should expose the public landing story and deterministic assistant even when optional providers are unavailable. Configure the API URL and CORS origin for the web app, keep reviewer credentials separate from Intercom invitations, and use synthetic or sanitized records only. The assistant is not a dependency of core case ingestion or processing.
