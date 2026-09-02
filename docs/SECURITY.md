# Security

## Rules in force

- Secrets live only in server environment variables. None are `NEXT_PUBLIC_*`.
- `.env` files are gitignored. `.env.example` lists names and descriptions only.
- Webhooks are processed only after signature verification on the **raw** body.
- Public demo sessions use hashed tokens, expiry, and per-session limits (including live AI calls).
- `JOB_PROCESSING_MODE=inline` does not start BullMQ workers and does not require Redis.
- Open user registration is disabled in production.
- `/api/users`, `/api/cases`, `/api/cases/overview`, `/api/evaluation`, operations, and directory require an admin JWT (except public demo and health).
- Logs must not include API keys, cookies, authorization headers, or full confidential conversations.
- Attachments are disabled in the first public release.
- Intercom webhook HMAC-SHA1 and Canvas HMAC-SHA256 use `INTERCOM_CLIENT_SECRET` on the raw body. Invalid signatures do not create inbound events.

## Residual risk

- CSRF cookie middleware exists but is not yet applied to every browser mutation. Bearer tokens remain the primary admin auth.
- The `xlsx` dependency has known advisories; only import trusted directory files.
- In-memory intelligence locks still exist for single-process safety; durable notification idempotency is the `inbound_events` unique key. BullMQ job ids are revision-aware so API/worker process splits cannot drop a later reply.
- This app is single-tenant. Workspace id is an environment check, not per-row multi-tenant ACL.
- Operator correction audit stores `actorRole`, not the teammate email (`actor_role` varchar 32).
