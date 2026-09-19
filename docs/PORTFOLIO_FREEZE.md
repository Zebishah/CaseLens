# Portfolio freeze

Status: portfolio-complete after the final hardening pass. This document records the supported shape of the system so future edits can be reviewed against a stable baseline.

## Supported production shape

- PostgreSQL is the source of truth for conversations, intelligence snapshots, identity data, outbox records, Actor runs, sessions, and logs.
- Render runs the API in `JOB_PROCESSING_MODE=apify`; private Apify Actors perform on-demand background processing.
- Redis/Upstash is retained for shared API rate limits and short-lived store-directory and CC caches. Redis is not durable job state and is not required in Apify mode.
- BullMQ + Redis remains a supported alternative for continuously running worker deployments.
- The Next.js dashboard exposes reviewer-safe case, directory, architecture, and demo surfaces. Administrative operations remain role-protected.

## Validated capabilities

- Signed intake, idempotency, transactional generic ingestion, revision-aware dispatch, retry/recovery state, and stale-write protection.
- Explainable identity matching, related-case evidence, stakeholder routing, and persisted case snapshots.
- Reviewer login/demo access, role-based navigation, explicit loading/error states, mocked browser E2E coverage, and targeted accessibility checks.
- Safe operational metrics at `/api/operations/metrics` for authenticated viewers; responses contain aggregate counts and health flags only.

## Deliberate limits

- Synthetic fixtures and local evaluation are not production accuracy, latency, or customer-outcome claims.
- The portfolio deployment is single-tenant and access tokens remain in session storage.
- Dependency audits can report upstream advisories; `docs/SECURITY.md` records the current classification and mitigations.

## Change policy

Future changes should preserve PostgreSQL truth, Apify production execution, the retained BullMQ path, Redis fallback behavior, browser E2E coverage, and migration discipline. New infrastructure or provider integrations need a separate design review; they are outside this freeze.
