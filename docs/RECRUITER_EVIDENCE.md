# Recruiter evidence

## 1. Verified original system functionality

Confirmed by reading this checkout (not by live Intercom):

- Intercom webhook HMAC + conversation sync
- Canvas Kit initialize/submit/configure
- Gemini or fixture name/category extraction
- Employee match (exact, alias, fuzzy, token) — not a dedicated HR employee-id key
- Related-case retrieval by identity/name (category filter currently off)
- Box Excel store-directory sync (optional)
- Dashboard intelligence/ops explorer

Test counts belong only to the latest `npm test` run. See `docs/BENCHMARKS.md`. Do not quote 338, 362, or 413 unless that run produced them.

## 2. Confirmed original contributions

Treat as original to the pre-existing Intercom-app backend: intelligence processor, matching utilities, Canvas builder, store-directory parser. This file does not invent product metrics or headcount impact.

## 3. Sanitized portfolio improvements

- Optional Intercom/Box/Resend flags
- Source-agnostic ingestion + inbound_events/outbox
- Revision-aware BullMQ job ids (reply not lost while an older job is active)
- Operator corrections persisted on the snapshot (`operatorConfirmedFields`)
- Independent tag write-back (`INTERCOM_WRITEBACK_TAGS_ENABLED`)
- Recruiter demo sessions
- Evaluation dataset + `npm run eval:run` (fixture heuristic, 6 cases)
- Canvas contract smoke (`npm run intercom:canvas-smoke`)

## 4. Measured evidence

See `docs/BENCHMARKS.md`. Only numbers produced by a command in this repo. Fixture eval is not production model quality.

## 5. Unverified — do not claim

- Production accuracy, latency, or volume
- Live Intercom Canvas (Developer Hub Canvas Kit page has been blank)
- That vector search improved quality (not used)
- That related-case SQL precision equals the fixture eval related scores
- Business outcomes or customer names

## 6. Suggested CV bullets (only after tests/eval in this pass)

Replace the measurements with the command output from `docs/BENCHMARKS.md` this-pass table:

- Built an Intercom Canvas Kit HR intelligence layer: signed webhooks, directory identity resolution, related-case retrieval, stakeholder CC, and internal-note write-back, with a separate operations dashboard.
- Stopped duplicate Intercom notifications via durable `inbound_events` and stopped lost replies via revision-aware BullMQ job ids plus stale-snapshot protection.
- Separated fixture evaluation (`eval-v1`, 6 anonymized cases) from live Gemini so model-quality claims stay honest.
