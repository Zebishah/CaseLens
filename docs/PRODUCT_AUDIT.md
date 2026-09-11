# HR Intelligence product audit

## Product story

| Current feature | Client/operator problem | What it solves | Business value | Technical value | UI presentation |
| --- | --- | --- | --- | --- | --- |
| Unified ingestion | Intercom, email, and demo inputs can otherwise need separate workflows | Normalizes intake into one case model | More consistent intake and less duplicated workflow logic | Signed/validated adapters, idempotent inbound events, shared processor | One intelligence layer around the existing workflow |
| Identity resolution | Names are incomplete, inconsistent, or misspelled | Matches exact, alias, token, and fuzzy evidence with review fallback | Safer employee linking; less manual directory lookup | Deterministic matching remains authoritative and confidence is stored | Identity evidence, not autonomous identity decisions |
| Related-case retrieval | Prior employee history is hard to find across conversations | Links relevant history with scope and time-window evidence | Less manual searching and easier context discovery | Bounded, explainable retrieval snapshots | Why are these cases related? |
| Store/stakeholder routing | Store and ownership context is often a separate lookup | Uses directory context to surface stakeholder guidance | Less repetitive routing lookup | Directory-backed deterministic recipient rules | Routing context with the source shown |
| Intercom Canvas/write-back | Operators should not have to leave their inbox | Puts persisted intelligence beside the case | Less context switching while retaining the familiar workspace | Integration is optional and write-back failure is isolated | Intercom remains the operator workspace |
| Outbox and retries | A saved case can be stranded if enqueue fails | Makes pending dispatch recoverable | Lower risk of lost queue work | Transactional persistence, recovery, bounded retries | Operations pending outbox and recovery explanation |
| Evaluation harness | AI claims need a reproducible baseline | Measures anonymized fixture behavior | Quality claims stay defensible | Versioned dataset and explicit fixture/live distinction | Fixture evaluation, never implied production accuracy |
| Recruiter access controls | Shared third-party credentials are unsafe and unreliable | Separates public story, viewer dashboard, and invitation access | Safer review path | JWT/RBAC, throttling, synthetic data boundary | Personal invitation and visible workspace identity |

## Recruiter narrative

Before HR Intelligence, operators had to read long HR conversations, identify the employee, search prior cases, determine store/company context, find stakeholders, and carry that context between systems. After intake, the system can structure those repetitive steps, preserve evidence, and return the result to the operator in Intercom. Human review remains part of the design whenever evidence is incomplete.

The landing page follows that order: problem, transformation, AI intelligence, operational impact, architecture, demo, and FAQ. Exact savings, volume, and production outcomes are intentionally not claimed because this repository does not contain measured client metrics.

## Assistant audit

`POST /api/assistant/ask` is one shared, read-only surface used by the public landing page and every dashboard route. It accepts only a bounded question, route, and optional numeric case ID. Public product questions use a deterministic knowledge fallback. Protected case, directory, workspace, operations, and evaluation answers use existing repositories and enforce the same authenticated role boundary as the pages. Case fields are projected to bounded summaries; raw messages, raw provider payloads, tokens, SQL, shell commands, mutations, and arbitrary URLs are not exposed.

The current provider is explicitly reported as `deterministic-fallback`. This is intentional: assistant failure cannot interrupt core Intercom/email case processing, and a model provider can be added behind the same tool boundary later without changing authorization or deterministic identity decisions.

## Validation checklist

- Frontend: landing story, FAQ, global assistant, access shell, responsive tables, loading/error/empty states.
- Backend: Zod validation, optional-auth semantics, viewer/admin separation, bounded case projection, deterministic fallback.
- Evidence boundary: synthetic recruiter data, fixture evaluation separated from live counts, no fabricated business outcomes.
