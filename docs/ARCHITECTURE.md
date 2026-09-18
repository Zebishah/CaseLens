# Architecture

HR Intelligence is a TypeScript modular monolith. Intercom and inbound email are intake/operator integrations around a shared case-intelligence domain. PostgreSQL is the source of truth.

## Production processing path

```text
Intercom / inbound email
  → Render API: verify, validate and normalize
  → PostgreSQL: case state + durable ingestion/outbox records
  → private on-demand Apify Actor
  → Gemini extraction + employee matching + related-case retrieval
  → PostgreSQL: persisted snapshot and execution state
  → Intercom Canvas / dashboard
```

The Render API acknowledges verified intake after durable persistence and dispatch. The Actor loads the case from PostgreSQL and invokes the same business handlers used by the retained BullMQ worker and inline processing mode. The Actor writes bounded status metadata; case content remains in PostgreSQL.

## Execution modes

| Mode | Use | Runtime |
|---|---|---|
| `apify` | Production background processing | Render API dispatches private, on-demand Actor runs. Redis workers are not required. |
| `bullmq` | Supported alternative | Render/API and BullMQ worker use Redis queues, retries and backoff. |
| `inline` | Local, fallback and demo | Shared handler runs in the API process; it does not provide the same crash recovery as durable background execution. |

BullMQ remains supported and tested. It is not the selected production processing path. Resend and optional directory jobs retain their existing queue integrations where configured.

## Reliability boundaries

- **Idempotency:** a unique source/external-event key makes duplicate webhook deliveries safe.
- **Transactional outbox:** generic intake commits the case and dispatch intent in one PostgreSQL transaction; recovery can find work not yet dispatched.
- **Revision-aware deduplication:** a newer Intercom revision can be processed while an older revision is active.
- **Stale-write protection:** older work cannot replace a newer snapshot or write outdated intelligence to Intercom.
- **Advisory locking:** a PostgreSQL session lock prevents concurrent processing of the same conversation across Actor containers.
- **Retry and recovery:** Actor-run records hold status, attempts, retryability and safe error classifications; bounded recovery retries eligible failures.
- **Non-fatal secondary effects:** a deferred peer refresh or optional Intercom write-back failure does not retroactively fail successful primary case intelligence.

These guarantees apply to their documented paths. Intercom ingestion uses durable event state and revision-aware dispatch; generic ingestion uses the explicit transactional outbox.

## Intelligence pipeline

```text
Stored conversation
  → Gemini or deterministic fixture extraction
  → employee identity resolution
  → related-case retrieval with explainable evidence
  → routing context and review flags
  → persisted snapshot
  → optional Intercom note/tag write-back
```

`LLM_MODE=fixture` is deterministic sample processing. `LLM_MODE=live` uses the configured Gemini API. Fixture and local benchmark results are not production accuracy or latency claims.

## Operator surfaces and data

Intercom Inbox and Canvas remain the operator workspace. The Next.js application presents persisted cases, directory context, reviewer access, architecture, and read-only operational aggregates. Administrative recovery controls are separate and require the admin role.

PostgreSQL stores conversations, messages, identity links, intelligence snapshots, inbound events, outbox records, Actor runs, refresh sessions, and application logs. Redis is needed only by the BullMQ execution mode.

## Setup and migrations

Create the base database schema with the documented setup procedure, then apply ordered SQL migrations with `npm run db:migrate`. The ordered runner records applied migration IDs and runs each migration in a transaction. Existing targeted `db:migrate-*` scripts remain available. Migrations are never applied automatically at application startup.

See [deployment](DEPLOYMENT.md), [Apify deployment](APIFY_DEPLOYMENT.md), and [the recruiter evidence boundary](RECRUITER_EVIDENCE.md) for setup and verification details.
