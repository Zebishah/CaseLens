# Final production-readiness audit

Inspection date: 2026-09-01  
Repository: `Hr-intercom` working tree (`Intercom-app/` plus `docs/`). Outer git commit `85f289c`; application code remains largely untracked at the outer repo.  
No push, deploy, commit, or live Intercom credential use was performed for this pass.

Status labels (exactly one per requirement):

- **Verified automatically** — covered by a test or command run in this checkout
- **Verified against a real external service** — live Intercom/Gemini/Box/Resend
- **Implemented but awaiting manual verification** — code exists; Developer Workspace or operator still required
- **Partially implemented** — present but missing a required guarantee
- **Missing**
- **Intentionally excluded**

Mocked Intercom/Gemini behavior is never labelled live-verified.

---

## Architecture map (from code)

| Behavior | Route | Service | Persistence | Queue / inline | UI | Automated test | Live status |
|---|---|---|---|---|---|---|---|
| Intercom webhook ingest | `HEAD/POST /webhooks/intercom` | `webhook.service` + HMAC middleware | `inbound_events`, `conversations` | Enqueue or fire-and-forget `processCaseIntelligence` | Operations last-webhook | `tests/integration/webhook/webhook.test.ts`, E2E HTTP | Implemented but awaiting manual verification |
| Canvas initialize/submit/configure | `POST /canvas/*` | `canvas.service` + HMAC-SHA256 | Conversation resolved from Intercom conversation id | Enqueue revision-aware jobs | Intercom Inbox App | `canvas.test.ts`, `canvas.contract.smoke.test.ts` | Implemented but awaiting manual verification (Developer Hub Canvas page blank) |
| Shared intelligence | none (worker/inline) | `process-case-intelligence` → `intelligence.processor` | `conversations.intelligence_snapshot` | BullMQ `intercom-intelligence-queue` or inline | Canvas + dashboard explorer | processor/unit/integration | Verified automatically (fixture/mocked Gemini) |
| Identity resolution | same processor | `employee.matching.service` | `employee_identities`, `employee_aliases`, `conversation_employees` | same | Canvas employee section | matching unit tests | Partially implemented (no dedicated employee-ID column match) |
| Store/company | mapper + `parseReporterContext` | reporter email local-part + directory | `reporter_store_number`, store directory | same | Canvas CC + store input | reporter-context unit tests | Verified automatically for email-local store numbers |
| Classification | processor | `resolveCaseType` + Gemini `caseType` | `conversations.case_type` | same | Canvas category line | case-type unit tests + eval fixture | Verified automatically (fixture heuristics); live Gemini awaiting manual |
| Related cases | processor | `related.retrieval.service` | snapshot `relatedCases` | peer-refresh jobs | Canvas related list | related unit tests + eval fixture | Partially implemented (same-employee list; category filter currently disabled) |
| Stakeholders | Canvas CC | `ccRecipientsService` | snapshot `ccRecipients` | none | Canvas CC section | cc-recipients tests | Verified automatically against directory fixtures |
| Operator corrections | `POST /api/cases/:id/corrections` + Canvas dismiss/store | `operator-correction.util` | `case_corrections` + snapshot `operatorConfirmedFields` | later AI honors confirmed fields unless Re-analyze | Dashboard case + Canvas | `operator-correction.util.test.ts` | Verified automatically for persist/precedence unit; dashboard HTTP awaiting manual |
| Write-back | after ready intelligence | `syncIntercomIntelligence` | `intercom_sync_*` | not in webhook request | Intercom note/tags | `intercom.sync.service.test.ts` | Implemented but awaiting manual verification |
| Demo adapter | `/api/demo/*` | `demo-process.service` | same conversations table, `source=demo` | inline or `demo-process-{id}` job | Try Demo | demo unit tests | Implemented but awaiting manual verification |
| Email adapter | Resend webhook | `ingestion.service` | inbound_events/outbox | same processor | dashboard source=email | resend webhook tests | Implemented but awaiting manual verification when `RESEND_ENABLED` |
| Dashboard overview | `GET /api/cases/overview` (admin JWT) | `cases.controller` | `countByIntelligenceStatus`, duplicates, latest intercom event | n/a | `/overview` | route now authenticated | Verified automatically for query provenance; UI manual |
| Evaluation | `GET /api/evaluation` (admin) + `npm run eval:run` | `evaluation.runner` | dataset file `eval/dataset.v1.json` | n/a | `/evaluation` | eval command | Verified automatically as **fixture subject-heuristic**, not live Gemini |

---

## Requirement statuses

| Requirement | Status | Evidence |
|---|---|---|
| Intercom is the operator workspace; dashboard is intelligence/ops | Verified automatically | Dashboard copy; Canvas is the conversation UI; cases page is read-only explorer |
| Source-agnostic pipeline (Intercom / demo / email) | Verified automatically | `ingestion.service` + `processCaseIntelligence`; adapters do not duplicate matching/classification |
| Webhook HMAC-SHA1 raw body, `sha1=`, timing-safe | Verified automatically | `intercom.signature.ts`, webhook HTTP tests |
| `HEAD /webhooks/intercom` 200 | Verified automatically | webhook integration test |
| Workspace/app id checked before ingest | Verified automatically | mismatch returns 401; no inbound event |
| Duplicate notification id does not reprocess | Verified automatically | `inbound_events` unique + adapter test + E2E replay |
| Webhook does not run Gemini/related/write-back | Verified automatically | handler enqueues / fire-and-forget |
| One local case per Intercom conversation | Verified automatically | unique `intercom_id` upsert |
| New user reply not lost while a BullMQ job is active | Verified automatically | conversation-only job id **would collide**; revision-aware `intelligence-{id}-r{messageCount}-{updatedAtMs}` + `shouldReprocessIntelligence` uses Intercom `updated_at` because only the opening message is stored (`CONVERSATION_MESSAGE_SAVE_LIMIT = 1`) |
| Stale persist cannot overwrite newer snapshot | Verified automatically | `isStaleIntelligencePersist` |
| Stale write-back skipped | Verified automatically | `syncIntercomIntelligence` compares snapshot vs current revision |
| Canvas HMAC-SHA256 raw body | Verified automatically | canvas HTTP tests |
| Canvas does not trust client local case id | Verified automatically | resolved from signed conversation id |
| Canvas states (not ingested, pending, ready, failed, disabled, manual review, related, sync failed, operator corrected, stale) | Verified automatically | `canvas.contract.smoke.test.ts` |
| Live Canvas Kit in Developer Hub | Implemented but awaiting manual verification | Hub Canvas page reported blank — external blocker |
| Human corrections persist and survive later AI | Verified automatically (unit) | snapshot `operatorConfirmedFields`; Re-analyze (`forceReprocess`) clears them |
| Related-case add/remove on dashboard | Partially implemented | Canvas dismiss persists; dashboard has no add/remove related-case API |
| Related-case precision/recall (product retrieval) | Partially implemented | `eval:run` uses **subject-heuristic fixture**, not the SQL retrieval service |
| Vector search | Intentionally excluded | no benchmark showing improvement |
| Tags optional / isolated from notes | Verified automatically | `INTERCOM_WRITEBACK_TAGS_ENABLED`; tag 403 does not fail note sync |
| Overview/evaluation APIs authenticated | Verified automatically | admin JWT + role |
| Dashboard numbers from DB/runtime | Verified automatically | overview queries repositories; evaluation is fixture command output |
| Fake dashboard metrics | Intentionally excluded | none found in dashboard pages (search placeholder only) |
| Object-level multi-workspace isolation | Intentionally excluded | single-tenant private app; workspace id is env, not per-row ACL |
| CSRF on cookie mutations | Partially implemented | `requireCsrf` exists; Bearer JWT is the dashboard auth path |
| Live Gemini quality metrics | Missing as production claims | fixture eval only; do not cite as production model quality |
| Kafka / Kubernetes / extra broker / extra LLM | Intentionally excluded | |
| Frontend non-interactive lint | Verified automatically after `eslint.config.mjs` | `npm run lint` in `Intercom-app/web` |
| Full E2E signed webhook → canvas | Verified automatically | `tests/integration/e2e/intercom-http-flow.test.ts` (mocked Intercom/Gemini, real Express). **79 suites / 439 tests** on 2026-09-01 this pass. |
| Live Developer Workspace end-to-end | Implemented but awaiting manual verification | requires user-provided Intercom env; `INTERCOM_ENABLED` currently false in local `.env` |

---

## BullMQ job-id finding

Previous job id `intelligence-{conversationId}` plus `removeOnComplete: true` still **drops a new reply while a job is waiting or active** across API vs worker processes. In-process locks do not span processes.

**Change (tests demonstrated the collision):** deterministic id `intelligence-{conversationId}-r{messageCount}-{sourceUpdatedAtMs}`. Duplicate notifications keep the same revision key. `forceReprocess` (Canvas Re-analyze / sibling refresh) uses a unique `force-` suffix so an in-flight job cannot swallow an explicit rerun.

Trade-off: rapid replies can enqueue more than one job for the same conversation. Stale-persist CAS still drops older snapshot writes. Duplicate *notifications* are still blocked before enqueue.

---

## What is not production-ready

Do not call the Intercom integration live-verified until Developer Workspace webhook + Canvas initialize succeed against the real app. The Intercom Canvas Kit documentation page rendering blank is an **external blocker**.

Do not call AI quality production-ready: `npm run eval:run` is a 6-row anonymized subject heuristic (`eval-v1`), labelled Local fixture evaluation.

---

## Migrations this pass

None. Operator confirmation is stored on the existing JSON snapshot plus `case_corrections`. `INTERCOM_WRITEBACK_TAGS_ENABLED` is env-only.
