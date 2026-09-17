# HR Intelligence Apify deployment

This repository contains a private, on-demand Apify Actor runtime that reuses the backend's compiled intelligence handlers. The code is ready for a manually validated rollout; Render production must remain on its current mode until the Actor build and safe-conversation smoke test pass.

## Actor location and job contract

The Actor definition is `Intercom-app/backend/.actor/actor.json`. Its Docker context is the backend package, and its entry point is the compiled `src/actor/main.ts`. The Actor does not start an HTTP server, use Standby, use a browser, or write case data to an Apify Dataset. It reads its input from the run's default key-value store and writes only safe status metadata to that store's `OUTPUT` record.

Supported inputs are validated by a strict Zod discriminated union:

- `intelligence`: stored conversation ID, Intercom ID, revision and processing flags.
- `peer-refresh`: conversation IDs, case type, bounded employee identity IDs, related-case scope and sibling refresh flag.
- `recover-pending-outbox`: a batch limit from 1 to 20.
- `store-directory-sync`: the fixed `apify-schedule` source.

The Actor loads HR case content from PostgreSQL. Inputs, durable run metadata, logs, and output do not contain conversation bodies or Gemini prompts. Output includes operational status, duration, IDs, and bounded counts only.

## Environment variables

### Render HR API

Set these for the Apify deployment:

```dotenv
JOB_PROCESSING_MODE=apify
RUN_API=true
RUN_WORKERS=false
APIFY_API_TOKEN=<scoped token allowed to run the HR Intelligence Actor>
APIFY_ACTOR_ID=kTSaFi1vV3eHoeZft
APIFY_API_BASE_URL=https://api.apify.com/v2
DATABASE_URL=<production PostgreSQL URL>
```

`APIFY_DEFAULT_MEMORY_MBYTES` defaults to `512`, `APIFY_RUN_TIMEOUT_SECONDS` to `180`, `APIFY_REQUEST_TIMEOUT_MS` to `10000`, and `APIFY_MAX_ATTEMPTS` to `3`. Set a larger memory value only after an observed Actor memory need. Do not put any Apify secret in the web application's environment.

Keep the Render API's existing required settings: distinct `JWT_SECRET` and `JWT_REFRESH_SECRET`, `INTERCOM_ENABLED=true`, `INTERCOM_ACCESS_TOKEN`, `INTERCOM_CLIENT_SECRET`, `INTERCOM_WORKSPACE_ID`, `INTERCOM_ADMIN_ID`, and live Gemini values (`LLM_MODE=live`, `GEMINI_API_KEY`, `GEMINI_MODEL`, `AI_PROMPT_VERSION`) when live intelligence is enabled. Keep existing confidence settings such as `EMPLOYEE_MATCH_MIN_CONFIDENCE` and `MANUAL_REVIEW_CONFIDENCE`. Preserve the other configured auth, CORS, and provider settings used by the existing API.

### Apify HR Actor

Configure these secrets and values in the HR Actor's environment:

```dotenv
DATABASE_URL=<same production PostgreSQL database used by the HR API>
DATABASE_POOL_MAX=4
NODE_ENV=production
LLM_MODE=live
GEMINI_API_KEY=<Gemini key>
GEMINI_MODEL=<same model configured for the API>
AI_PROMPT_VERSION=<same prompt version configured for the API>
EMPLOYEE_MATCH_MIN_CONFIDENCE=<same configured value>
MANUAL_REVIEW_CONFIDENCE=<same configured value>
INTERCOM_ENABLED=true
INTERCOM_ACCESS_TOKEN=<Intercom API token>
INTERCOM_WORKSPACE_ID=<Intercom workspace ID>
INTERCOM_ADMIN_ID=<Intercom admin ID>
APIFY_API_TOKEN=<scoped token that can run this HR Actor>
```

`INTERCOM_CLIENT_SECRET` is not used by the Actor because the Actor does not receive webhooks; its process supplies a local placeholder only to satisfy the shared API configuration validator. `INTERCOM_API_BASE_URL`, `INTERCOM_API_VERSION`, and `INTERCOM_WRITEBACK_TAGS_ENABLED` use the existing defaults unless the API uses custom values. `APIFY_ACTOR_ID` is provided by the Apify runtime; set it explicitly only if the platform does not provide it to the container.

If Box directory sync is enabled, also set `BOX_SYNC_ENABLED=true`, `BOX_CLIENT_ID`, `BOX_CLIENT_SECRET`, `BOX_ENTERPRISE_ID`, and `BOX_FILE_ID`. Leave it disabled otherwise. Resend remains on its BullMQ queue and is not included in this Actor migration.

Use a separate scoped Apify token for the Render API and Actor. Grant only permission to start runs of the HR Intelligence Actor. The Actor may start same-Actor child runs for deferred peer and sibling processing, so store an Actor-scoped run token as its `APIFY_API_TOKEN` secret. Do not grant access to the RTA Actor, datasets, or unrelated storage. If the account's token controls cannot restrict the Actor ID, use a backend dispatch endpoint for child work or keep child dispatch disabled until a least-privilege credential is available.

### Frontend

No Apify variables or secrets belong in the frontend environment.

## Database migration

Before enabling Apify mode, apply the repository's idempotent migration to the production database:

```bash
cd Intercom-app/backend
npm run db:migrate-apify-actor-runs
```

The migration creates `intelligence_actor_runs`, which stores the safe Actor input, revision/dedupe key, Apify run ID, attempt count, state, and safe error classification. It does not alter or delete existing business data, queues, outbox records, or worker configuration.

## Rollout and manual smoke test

1. Create a **private** Actor named `hr-intelligence-worker` in the existing Apify account.
2. Connect the repository and set the Actor source directory to `Intercom-app/backend`; use `.actor/actor.json` and its backend Docker context.
3. Configure the Actor environment and secrets listed above. Do not configure Standby.
4. Build the Actor and confirm the Docker image completes successfully.
5. Manually run `{"type":"intelligence","conversationId":<safe test ID>,"intercomId":"<test Intercom ID>","skipSync":true,"forceReprocess":false,"skipPeerRefresh":true}` against an approved test/demo conversation. Confirm the Actor output contains only safe metadata and the conversation reaches `READY` in the HR application.
6. Create a scoped API token with permission to run the HR Actor. Add it to both Render and the Actor as `APIFY_API_TOKEN`.
7. Apply `db:migrate-apify-actor-runs` to the Render production database.
8. Configure Render with `JOB_PROCESSING_MODE=apify`, `RUN_API=true`, and `RUN_WORKERS=false`, plus the Apify values. Keep `REDIS_URL` optional and unused in this mode.
9. Deploy Render and send a verified Intercom webhook. Confirm it is acknowledged promptly and an HR Actor run is created.
10. Confirm the Actor reads the stored conversation and the case becomes intelligence `READY`. Confirm duplicate webhook delivery does not create another normal run for the same revision.
11. Create an Apify Schedule for `{"type":"recover-pending-outbox","limit":20}` with cron `*/5 * * * *`. Each scheduled run processes one bounded batch and exits. Do not configure a repeat loop inside the Actor.
12. If Box sync is enabled, create a second schedule using the value of `STORE_DIRECTORY_SYNC_CRON` and input `{"type":"store-directory-sync","source":"apify-schedule"}`. When Box is disabled, this run reports `skipped` safely.

Schedule timezone settings should match the intended timezone for `STORE_DIRECTORY_SYNC_CRON`. Configure the Actor's maximum concurrent runs in Apify to a small value appropriate for the Neon connection plan; each Actor container uses a pool capped at four connections. Do not schedule the recovery Actor through Render or start an always-on worker.

## Retained alternatives and operational choices

- Inline still processes locally and does not require Redis or Apify.
- BullMQ remains fully available with `JOB_PROCESSING_MODE=bullmq`, `RUN_WORKERS=true`, and `REDIS_URL`; its retries, backoff, concurrency, queues, worker tests, and schedules remain intact.
- Apify revision dedupe uses `(conversation_id, job_type, source_revision)` for normal intelligence. A force reprocess gets a fresh durable execution key.
- PostgreSQL session advisory locks serialize active processing for a single conversation across Actor containers. A different conversation uses a different lock key.
- Apify start failures leave the existing outbox pending. Actor run failures are stored with a safe retry classification and get at most three attempts via the recovery schedule, with a five-minute initial delay that doubles on each retry. Recovery itself is bounded and never dispatches another recovery job.
- Peer refresh and sibling processing stay enabled in Apify mode, with sibling fan-out capped by the existing limit of 20. Resend stays on the optional BullMQ implementation. Store-directory sync supports both BullMQ and the scheduled Actor input.
- The backend's existing idempotent webhook verification, workspace checks, duplicate handling, ping path, and `conversation.admin.noted` loop prevention are retained.

## Architecture history and claim boundary

The repository contains the implemented Redis/BullMQ worker architecture with retries, revision-aware deduplication, and configurable worker concurrency, and now includes an on-demand Apify execution path. After the manual smoke test and Render mode switch, a truthful history statement is: “Implemented a Redis/BullMQ distributed processing pipeline with retries, revision-aware deduplication and worker concurrency; later migrated live background execution to on-demand Apify Actors while retaining the BullMQ implementation.” Until then, describe Apify as the implemented target architecture rather than as an already switched production service. No traffic, latency, or cost metrics are claimed.
