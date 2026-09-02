# Intercom integration completion audit

Inspection date: 2026-09-01  
Repository source of truth: current tree under `Intercom-app/` (outer git commit `85f289c`; application code is untracked at the outer repo).  
Scope: verify and complete the Intercom operator-workspace architecture without rewriting working hardening.

This document was written from the live code, tests, schema, and routes. Status labels:

- **complete** — implemented and covered by tests or an explicit live checklist
- **partial** — present but missing a required guarantee
- **missing** — not implemented
- **incorrect** — implemented in a way that contradicts the required contract

Statuses in [§ Completion status after this pass](#completion-status-after-this-pass) reflect the code after the verification pass.

---

## Mapped Intercom surface

### Routes (exact paths)

| Method | Path | Role |
|---|---|---|
| `HEAD` | `/webhooks/intercom` | Intercom URL validation |
| `POST` | `/webhooks/intercom` | Signed webhook ingest |
| `POST` | `/canvas/initialize` | Inbox App / Canvas Kit initialize |
| `POST` | `/canvas/submit` | Inbox App actions (refresh, re-analyze, store number, dismiss) |
| `POST` | `/canvas/configure` | Canvas configure |
| `POST` | `/api/operations/intercom-sync/:conversationId` | Admin retry of Intercom write-back only |
| `GET` | `/api/operations/queues` | Operations + Intercom health (no secrets) |
| `GET` | `/api/cases` / `/api/cases/:id` / `/api/cases/overview` | Intelligence explorer |

Mounted from `src/app.ts` via `intercomRoutes` **before** `express.json()`.

### Services / handlers

| Area | Path |
|---|---|
| Webhook HMAC | `src/modules/intercom/intercom.signature.ts` + `src/middlewares/intercomWebhook.middleware.ts` |
| Webhook handler | `src/modules/webhook/webhook.service.ts` |
| Notification idempotency | `src/modules/ingestion/intercom.webhook.adapter.ts` |
| Conversation upsert | `src/modules/conversation/conversation.service.ts` / `conversation.repository.ts` |
| REST client | `src/modules/intercom/intercom.client.ts` |
| Canvas Kit | `src/modules/canvas/canvas.service.ts` / `canvas.builder.ts` |
| Canvas HMAC | `src/middlewares/intercomCanvas.middleware.ts` |
| Shared intelligence | `src/modules/intelligence/process-case-intelligence.ts` |
| Write-back | `src/modules/intercom/intercom.sync.service.ts` |
| In-process coalesce | `src/modules/intelligence/intelligence-processing.lock.ts` |
| Queue coalesce | `src/queues/intercom-intelligence.queue.ts` job id `intelligence-{conversationId}` |

### Configuration variables (backend only)

Canonical names after this pass:

- `INTERCOM_ENABLED`
- `INTERCOM_ACCESS_TOKEN`
- `INTERCOM_CLIENT_SECRET` (HMAC for webhooks **and** Canvas Kit)
- `INTERCOM_WORKSPACE_ID`
- `INTERCOM_ADMIN_ID` (note/tag author)
- `INTERCOM_API_BASE_URL` (default `https://api.intercom.io`)
- `INTERCOM_API_VERSION` (default `2.11`)

Aliases kept for existing deployments:

- `INTERCOM_WEBHOOK_SECRET` → `INTERCOM_CLIENT_SECRET`
- `INTERCOM_BOT_ADMIN_ID` → `INTERCOM_ADMIN_ID`

No `NEXT_PUBLIC_*` Intercom secrets. Health/operations APIs return flags and timestamps only.

### Database fields (conversations)

Existing: `intercom_id` (unique), `source`, `intercom_contact_id`, `assigned_intercom_admin_id`, intelligence columns, `intercom_sync_status`, `intercom_last_synced_at`, `intercom_sync_error`, `intercom_intelligence_note_id`, `intercom_sync_fingerprint`, `intercom_sync_tags`.

Added this pass: `intercom_source_updated_at` (Intercom conversation `updated_at`).

Inbound idempotency remains `inbound_events (source, external_event_id)`.

### Tests (Intercom-related)

- `tests/integration/webhook/webhook.test.ts`
- `tests/integration/canvas/canvas.test.ts`
- `tests/unit/intercom/*`
- `tests/unit/ingestion/intercom.webhook.adapter.test.ts`
- `tests/unit/canvas/*`

CI uses `tests/setup-env.cjs` fakes. Live tokens are not required.

---

## Previous prompt requirements (inspection)

| Requirement | Inspection status | Notes |
|---|---|---|
| Intercom as operator UI; app as intelligence layer | **complete** | Dashboard copy and architecture match |
| Keep Postgres, ingestion, outbox, BullMQ, inline, Gemini, demo, eval, Resend, Box | **complete** | Untouched hardening |
| Webhook HMAC SHA1 raw body, `sha1=`, timing-safe | **complete** | `verifyWebhookSignature` |
| `HEAD /webhooks/intercom` | **complete** | |
| Webhook does not await Gemini | **complete** | enqueue / fire-and-forget |
| Topics `conversation.user.created` / `conversation.user.replied` | **partial** | Also handles `admin.single.created`, `admin.replied`, `ping`, legacy `conversation.created`. Does **not** handle `conversation.admin.noted`. |
| Validate workspace/app id on webhook | **missing** (fixed this pass) | Payload has `app_id`; was unused |
| Notification idempotency | **complete** | `inbound_events` + unique violation |
| Same Intercom conversation → same local case | **complete** | unique `intercom_id` upsert |
| New user reply updates same case, new intelligence | **complete** | reply topic refreshes + `shouldReprocessIntelligence` |
| Processing-version identity | **partial** (fixed this pass) | Message count on snapshot; no Intercom `updated_at` / version key |
| Write-back identity per intelligence version | **partial** (fixed this pass) | Content fingerprint; not tied to source revision |
| Stale job must not overwrite newer intelligence | **missing** (fixed this pass) | |
| Coalesce rapid replies | **partial** | Same BullMQ job id + in-process lock; lock now re-runs if messages grew |
| Canvas Kit primary operator view | **complete** | Working Inbox App at `/canvas/*` |
| Canvas `X-Body-Signature` HMAC-SHA256 raw body | **complete** | Middleware requires Buffer |
| One internal note per intelligence version | **partial** (fixed this pass) | One note per content fingerprint |
| No note while processing | **complete** | Write-back requires `intelligenceStatus === ready` |
| Failure isolation intelligence vs write-back | **complete** | |
| Retry write-back independently | **complete** | Operations route |
| 401/403 not infinitely retried | **partial** (fixed this pass) | Treated as non-retryable 400-class; now explicit 401/403 |
| 429 Retry-After, 5xx, timeout | **complete** | |
| Dashboard not an inbox | **complete** | |
| Open in Intercom | **complete** | Workspace inbox URL |
| Source-agnostic demo/email | **complete** | |
| `intercom:smoke` | **missing** (fixed this pass) | |
| Credential names `INTERCOM_ADMIN_ID`, API base/version env | **partial** (fixed this pass) | Used `INTERCOM_BOT_ADMIN_ID`; API version hardcoded `2.11` |
| Docs for Developer Hub / Canvas / Render | **partial** (fixed this pass) | |

---

## Webhook contract

- Header: `X-Hub-Signature` / `x-hub-signature`
- Algorithm: HMAC-SHA1 of **raw** bytes (`express.raw`)
- Prefix: `sha1=`
- Secret: `INTERCOM_CLIENT_SECRET`
- Compare: `crypto.timingSafeEqual` on hex digests
- Invalid/missing → 401
- Intercom disabled → 503
- Ack: handler returns 200 after ingest/enqueue; Gemini and write-back are not in the request

Recommended Developer Hub subscriptions for this private app:

1. `conversation.user.created`
2. `conversation.user.replied`

Still handled if delivered (kept for existing tests and optional operator-started conversations):

- `conversation.admin.single.created`
- `conversation.admin.replied`
- `ping` (Hub “send a test notification”)
- `conversation.created` (legacy fixture alias only)

Explicitly ignored (prevents note write-back loops): `conversation.admin.noted` and any other topic (200, no ingest side effects beyond ping/record rules).

---

## Canvas Kit

Primary operator UI. Displays persisted snapshot: employee, confidence, store/CC, classification, related cases, stakeholders, processing/manual-review banners, last-analyzed hints. Actions: Refresh results, Re-analyze case, store number, dismiss related case.

Signature: `X-Body-Signature`, HMAC-SHA256, raw body, same client secret.

---

## Write-back

After intelligence is `ready` for `source=intercom`:

- Internal admin note (`POST /conversations/{id}/reply`, `message_type: note`)
- Tags: `hr-intelligence-processed`, optional `manual-review`, `category-{slug}`
- Idempotent via fingerprint + note marker + stored note id
- Failure does not mark intelligence failed

---

## Completion status after this pass

| Item | Status |
|---|---|
| Credential model (token + client secret, aliases, no OAuth) | complete |
| `INTERCOM_ADMIN_ID` / API base / version env | complete |
| Webhook HMAC SHA1 raw body + HEAD | complete |
| Workspace `app_id` check | complete |
| Recommended topics user.created / user.replied | complete (extra topics handled if delivered; `admin.noted` ignored) |
| Canvas Kit primary UI | complete |
| Internal note per intelligence version | complete |
| Notification + conversation idempotency | complete |
| Source revision + stale persist guard | complete |
| Independent write-back retry | complete |
| `npm run intercom:smoke` | complete (live; CI uses mocks) |
| Dashboard not an inbox | complete |
| Source-agnostic demo/email | complete |

Automated proof is the verification commands in the completion report, not this file alone.
