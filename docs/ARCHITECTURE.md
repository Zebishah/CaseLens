# Architecture

CaseOps is a **modular monolith**. Intercom is an adapter around a shared HR intelligence domain. Intelligence processing has two **job** modes, independent of `LLM_MODE`.

## Operator vs dashboard

```
Intercom Inbox (teammate)
  → Canvas Kit POST /canvas/initialize|submit|configure
  → local case resolved from signed Intercom conversation id
  → snapshot from PostgreSQL

Intercom webhooks
  → HEAD/POST /webhooks/intercom (raw HMAC-SHA1)
  → inbound_events (idempotent) + conversation upsert
  → outbox / BullMQ or inline processCaseIntelligence
  → Gemini or fixture extraction + directory match + related cases + CC
  → snapshot persist (stale-revision protected)
  → optional internal note + optional tags
```

The Next.js app lists cases, operations, directory, and evaluation. It does not recreate Intercom’s composer or inbox.

## Job processing modes

### Inline (`JOB_PROCESSING_MODE=inline`) — public recruiter demo

Webhook/demo still persist first. Intelligence runs in-process after ingest (`processCaseIntelligence`). Redis is not required. `/ready` requires PostgreSQL.

### BullMQ (`JOB_PROCESSING_MODE=bullmq`)

```
Adapter → inbound_events + outbox → Redis → Worker → processCaseIntelligence
```

Job ids for Intercom intelligence are **revision-aware**: `intelligence-{conversationId}-r{messageCount}-{intercomUpdatedAtMs}`. A waiting/active job for revision N cannot swallow revision N+1. Duplicate notifications share the same revision key and are also blocked by `inbound_events`. Explicit Re-analyze uses a `force-` suffix.

Only the opening message is stored (`CONVERSATION_MESSAGE_SAVE_LIMIT = 1`). New replies are detected via Intercom `updated_at` (`intercom_source_updated_at` vs snapshot `sourceRevision`), not via a growing local message count.

## LLM mode (separate)

| `LLM_MODE` | Meaning |
|------------|---------|
| `fixture` | Deterministic subject/name extraction. Label: **Deterministic demo**. |
| `live` | Configured Gemini API. Label: **Live AI**. Requires `GEMINI_API_KEY`. |

## Optional adapters

| Flag | Behavior when false |
|------|---------------------|
| `INTERCOM_ENABLED` | Credentials not required. Webhook POST returns 503. Canvas returns a **disabled** Canvas JSON (not a broken empty page). Demo, email, dashboard, and fixture AI still work. |
| `RESEND_ENABLED` | Inbound email webhook returns 503 |
| `BOX_SYNC_ENABLED` | Directory uses seed/CSV; Box client is not called |
| `INTERCOM_WRITEBACK_TAGS_ENABLED` | Default true. When false, notes still write; tags are skipped |

## Storage

PostgreSQL is the durable source of truth. Redis is required only for BullMQ mode.

## Human corrections

`POST /api/cases/:id/corrections` writes `case_corrections` **and** updates the snapshot (`operatorConfirmedFields`). Later intelligence runs keep confirmed `caseType`, `employee`, `stakeholders`, and `manualReview` unless Canvas **Re-analyze** (`forceReprocess`) clears them. Related-case hide is Canvas dismiss, stored on the snapshot.
# Product framing

The architecture exists to reduce repetitive HR operator lookup while preserving Intercom as the operator workspace. Intake is normalized, identity and related-case evidence are stored, routing context is surfaced, and the result can be written beside the conversation.

The public product story intentionally precedes this implementation view. See [the product audit](PRODUCT_AUDIT.md) and [assistant boundary](AI_ASSISTANT.md) for the business-to-engineering mapping and read-only assistant contract.
