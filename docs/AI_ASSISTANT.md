# Ask HR Intelligence

The site-wide assistant is a single read-only surface at `POST /api/assistant/ask`. It is available on the public landing, login/help, access-request page, and authenticated recruiter/admin screens.

## Trust boundary

The client sends only the current route, a fixed workspace context, an optional numeric case ID, and a question capped at 1,200 characters. The API validates the request with Zod. An absent token can answer product knowledge; a supplied invalid bearer token is rejected rather than downgraded to public access. Case, directory, workspace, operations, and evaluation tools use the authenticated role from the verified token, never a role supplied by the browser.

The assistant returns bounded projections and never receives or returns raw provider payloads, complete conversation bodies, credentials, tokens, SQL, shell commands, arbitrary URLs, or mutation capabilities. It cannot change identity matches, modify roles, approve access, send Intercom messages, or operate queues. Deterministic identity and retrieval results remain authoritative; the assistant only explains stored evidence.

## Tool boundary

| Tool | Access | Data boundary |
| --- | --- | --- |
| `getPlatformHelp` | Public | Product, workflow, security, architecture, and recruiter guidance |
| `getWorkspaceSummary` / `searchCases` | Viewer/admin | Bounded live counts and case subjects/results |
| `getCaseSummary` / `explainEmployeeMatch` / `getRelatedCases` / `getStakeholderContext` | Viewer/admin | One authorized case’s stored intelligence evidence |
| `getDirectorySummary` | Viewer/admin | Directory counts and routing explanation, not raw payloads |
| `getOperationsSummary` | Admin | Bounded processing/outbox counts |
| `getEvaluationSummary` | Admin | Versioned fixture metrics, separate from live quality |

## Provider behavior

The current assistant reports `deterministic-fallback`. This ensures a provider outage cannot stop core Intercom, email, or demo processing and prevents unsupported interpretation of sensitive case text. A Gemini → Groq provider chain can be introduced behind the same validated tool boundary later; it must not bypass authorization or deterministic identity decisions.

## Test coverage

Focused tests cover public questions, invalid supplied tokens, bounded validation, prompt-injection-shaped case requests, viewer denial of admin tools, invalid case IDs, and deterministic fallback behavior.
