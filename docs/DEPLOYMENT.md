# Deployment (Render-compatible)

Do not provision paid services from this document. Use existing external PostgreSQL. Redis is required only for `JOB_PROCESSING_MODE=bullmq`.

## Web service

- Build: `cd Intercom-app/backend && npm run build:render`
- Start: `NODE_ENV=production RUN_API=true JOB_PROCESSING_MODE=inline node dist/server.js`
  - Production queue process: `JOB_PROCESSING_MODE=bullmq RUN_WORKERS=true` plus `REDIS_URL`
- Health: `GET /health`
- Readiness: `GET /ready` (PostgreSQL; Redis only when `JOB_PROCESSING_MODE=bullmq`)

Set `JOB_PROCESSING_MODE=inline` for the public portfolio so no BullMQ workers run and Redis is not required.

Set `INTERCOM_ENABLED=false` and `BOX_SYNC_ENABLED=false` unless you are connecting the Developer Workspace. Set `LLM_MODE=fixture` for deterministic samples, or `LLM_MODE=live` plus `GEMINI_API_KEY` for arbitrary custom cases.

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

Frontend: deploy `Intercom-app/web` with `NEXT_PUBLIC_API_URL` pointing at the API origin. Add that origin to `CORS_ORIGINS`.

## Cold start

The UI Wake Demo button polls `/ready`. A sleeping free instance is shown as “Starting demo service”, not as an application bug.
