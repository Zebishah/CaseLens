# Intercom Developer Hub setup (private app)

This project uses **one private Intercom app** installed in your own Developer Workspace. There is no OAuth for third-party workspaces.

API version implemented by the client and tests: **2.11**. Default base URL: `https://api.intercom.io`.

## App

Create or reuse an app in [Developer Hub](https://developers.intercom.com/) for this workspace.

Collect:

- Access token → `INTERCOM_ACCESS_TOKEN`
- Client secret → `INTERCOM_CLIENT_SECRET` (webhooks **and** Canvas Kit)
- Workspace / app id from the inbox URL `https://app.intercom.com/a/inbox/<workspace-id>/...` → `INTERCOM_WORKSPACE_ID`
- Teammate id that will author internal notes → `INTERCOM_ADMIN_ID`

Optional aliases (existing deployments): `INTERCOM_WEBHOOK_SECRET` → client secret, `INTERCOM_BOT_ADMIN_ID` → admin id.

Never put these in `NEXT_PUBLIC_*`, frontend `.env`, or health responses.

## Render API and background processing

Render API (`RUN_API=true`):

- `INTERCOM_ENABLED`, token, client secret, workspace id, admin id
- Production background work uses `JOB_PROCESSING_MODE=apify`, `RUN_WORKERS=false`, and a private on-demand HR Actor. The API persists intake and dispatch metadata in PostgreSQL before acknowledging the webhook.
- `JOB_PROCESSING_MODE=bullmq` with `REDIS_URL` and `RUN_WORKERS=true` remains a supported alternative deployment.
- `JOB_PROCESSING_MODE=inline` is for local, fallback and demo execution.

Optional BullMQ worker service:

- Same `DATABASE_URL`, `REDIS_URL`, Intercom token/admin id (write-back), `GEMINI_API_KEY` if `LLM_MODE=live`
- Does not need the webhook secret unless it also serves the API

Apply:

```bash
cd Intercom-app/backend
npm run db:migrate-intercom-sync
npm run db:migrate-intercom-source-revision
```

## Webhook

| Item | Value |
|---|---|
| URL | `https://<api-host>/webhooks/intercom` |
| Local | Tunnel to `http://localhost:3002/webhooks/intercom` |
| Validation | `HEAD /webhooks/intercom` returns 200 |
| Signature | `X-Hub-Signature: sha1=<hmac-sha1 of raw body>` using the **client secret** |

Subscribe in Developer Hub:

- `conversation.user.created`
- `conversation.user.replied`

Use **Send a test notification** (`ping`) to confirm the URL.

Do **not** subscribe to `conversation.admin.noted` (this app writes internal notes; that topic would loop).

The backend still **handles** `conversation.admin.single.created`, `conversation.admin.replied`, and legacy `conversation.created` if they are delivered. They are not required subscriptions.

If the payload includes `app_id`, it must match `INTERCOM_WORKSPACE_ID`.

## Canvas Kit / Inbox App

| Item | Value |
|---|---|
| Initialize | `POST https://<api-host>/canvas/initialize` |
| Submit | `POST https://<api-host>/canvas/submit` |
| Configure | `POST https://<api-host>/canvas/configure` |
| Signature | `X-Body-Signature` HMAC-SHA256 of the **raw** body using the same client secret |

This Inbox App is the primary operator view. Internal notes are a durable completion snapshot, not the only UI.

Contract smoke (never contacts the real workspace):

```bash
cd Intercom-app/backend
npm run intercom:canvas-smoke
```

If the Intercom Developer Hub **Canvas Kit** page renders blank in the browser, treat live Canvas configuration as an **external blocker**. Local contract tests passing is not live verification.

## Live smoke (no writes)

```bash
cd Intercom-app/backend
npm run intercom:smoke
```

Calls `GET /me` only. It never prints the access token or client secret.

Optional read of one conversation: `INTERCOM_SMOKE_CONVERSATION_ID=<id> npm run intercom:smoke -- --read-conversation`

## Verify a Messenger conversation

1. Enable `INTERCOM_ENABLED=true` and restart the API.
2. Create a contact conversation in the Developer Workspace Messenger.
3. Confirm Operations → last webhook and Cases → source `intercom`.
4. Open the conversation in Intercom: sidebar Canvas shows the snapshot; an internal HR Intelligence note appears after intelligence is ready.
5. Replay the same notification: no second case or second note.
6. User reply: same local case, new intelligence version.
7. Failed note sync: retry from Operations without re-running Gemini.

## Live Developer Workspace checklist (manual)

Provide these backend values (never `NEXT_PUBLIC_*`):

- `INTERCOM_ENABLED=true`
- `INTERCOM_ACCESS_TOKEN`
- `INTERCOM_CLIENT_SECRET`
- `INTERCOM_WORKSPACE_ID`
- `INTERCOM_ADMIN_ID`
- Confirm `INTERCOM_API_BASE_URL` (default `https://api.intercom.io`)
- Confirm `INTERCOM_API_VERSION` (default `2.11`)

Commands (do not run with production customer data):

1. `cd Intercom-app/backend && npm run db:migrate-intercom-sync && npm run db:migrate-intercom-source-revision` (or `npm run db:push` on a fresh database)
2. PostgreSQL via `docker compose up -d` in `Intercom-app/backend`; Redis is optional locally unless testing shared rate limits/caches, and required for the BullMQ worker mode
3. `npm run dev` (API, default `http://localhost:3002`)
4. BullMQ alternative only: same repo with `RUN_WORKERS=true` (or a second process). Production Apify mode dispatches private Actors on demand.
5. `cd Intercom-app/web && npm run dev` (`http://localhost:3001`)
6. `cd Intercom-app/backend && npm run intercom:smoke`
7. HTTPS tunnel to port 3002 (tool of your choice)
8. `curl -I https://<host>/webhooks/intercom` → 200
9. Developer Hub webhook URL `https://<host>/webhooks/intercom`
10. Topics: `conversation.user.created`, `conversation.user.replied` (do not subscribe to `conversation.admin.noted`)
11. Canvas URLs: `https://<host>/canvas/initialize`, `/canvas/submit`, `/canvas/configure`
12. Create a **synthetic** Messenger conversation
13. Operations dashboard: inbound event
14. Intelligence status pending → ready (inline or queue)
15. Open Canvas in the conversation
16. Internal note after ready
17. Overview counts from PostgreSQL
18. Replay the same notification: no second case/note
19. Send a second user reply
20. Same local case, new `intelligenceVersion`; Canvas shows latest

If step 11’s Hub page is blank, stop and record an external blocker. Do not mark live Canvas verified.
