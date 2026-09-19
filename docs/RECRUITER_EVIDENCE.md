# Recruiter evidence

This file separates demonstrable engineering from claims that would overstate the evidence.

## Live recruiter demonstration

The recommended review order is: public problem/value story → AI intelligence and impact → recruiter dashboard → case detail → architecture → operations/evaluation evidence → optional invited Intercom workspace. The global Ask HR Intelligence assistant can explain the current screen, but its responses are read-only and its live counts should not be treated as customer outcome metrics.

The portfolio can demonstrate, using synthetic data:

- A real Intercom inbox as the operator workspace.
- Signed Intercom conversation events entering the application.
- Gemini-backed extraction/classification when live LLM mode is enabled.
- Employee directory resolution, related employee history, stakeholder suggestions, manual review, and internal-note/tag write-back.
- A separate dashboard for case exploration, directory data, operational health, and labelled evaluation results.
- A restricted viewer account and a separate synthetic Intercom teammate account.
- A guided subtitled video from the landing page and the dashboard’s Demo & access tab.

The workspace owner has manually exercised the Intercom integration. This is demonstration evidence, not a production customer SLA or independent load test.

## Verified engineering in the repository

- Raw-body HMAC verification and workspace validation for Intercom webhook and Canvas traffic.
- Durable notification idempotency through a PostgreSQL unique key.
- Recovery of an event recorded before an interrupted enqueue.
- Revision-aware deduplication in the on-demand Apify path and deterministic BullMQ job IDs in the supported alternative, so a later reply is not hidden by older active work.
- Configurable retries/backoff, failure propagation, and stale-snapshot/write-back protection.
- Transactional generic ingestion: inbound event, conversation, messages, and outbox event commit together.
- Identity matching through exact email/name, aliases, first/last/full-name evidence, and bounded fuzzy matching with manual review.
- Related-case retrieval across name variants and close spellings without requiring the same category.
- Human corrections that survive later analysis until an explicit re-analysis.
- JWT algorithm/issuer/audience checks, viewer/admin authorization, login throttling, CORS/Helmet, input validation, safe request IDs, and atomic demo quotas.
- Targeted PostgreSQL indexes for message, identity, outbox, event, email, and fuzzy-name access paths.
- Automated backend unit/integration tests, frontend unit tests, and browser-level Playwright E2E checks run through the repository quality gates. See the latest successful CI run for current test counts and coverage; tests use synthetic fixtures and mocked provider calls.

## Defensible CV bullets

Use these without inventing business numbers:

- Architected an AI-powered HR case workflow integrating Intercom Canvas, signed webhooks, Gemini classification, employee resolution, related-case retrieval, stakeholder routing, and internal-note write-back.
- Built durable event processing with PostgreSQL idempotency, transactional outbox ingestion, revision-aware BullMQ jobs, bounded retries, and stale-write protection to prevent duplicate handling and lost updates.
- Hardened a role-based TypeScript/Node.js platform with JWT verification, login throttling, schema validation, atomic demo quotas, structured request tracing, and optimized PostgreSQL lookup indexes.
- Delivered a recruiter-ready Next.js operations dashboard and synthetic Intercom walkthrough with restricted viewer access, explicit loading/error states, case exploration, directory views, and measured test/evaluation evidence.

Current test counts belong to CI output rather than this narrative document. Only add dated exact counts, accuracy, latency, or throughput after copying the latest successful command output and labeling its environment.

## Do not claim

- Production traffic volume, revenue, time saved, failure reduction, or customer outcomes that were not measured.
- Local CPU microbenchmarks as HTTP or end-to-end latency.
- Fixture evaluation as live Gemini accuracy.
- Full multi-tenant isolation, full refresh-token revocation, or vulnerability-free dependencies.
- That every adapter uses the same outbox flow.
- Company/client names or non-synthetic data.
