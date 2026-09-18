# Final hardening audit

| Current state | Problem | Recommended change | Security consequence | Migration required? | Risk |
| --- | --- | --- | --- | --- | --- |
| Login previously rendered a shared reviewer email/password | Credentials are easy to copy and become a permanent access shortcut | Server-issued short-lived demo session | No password is disclosed; demo is rate-limited and read-only | No schema change; uses existing demo session table | Low; demo depends on database availability |
| Registration endpoint existed for non-production environments | Internal HR software should not have open self-registration | Keep endpoint as an explicit invite-controlled 403; use seeded/admin-managed accounts and demo entry | Visitors cannot self-grant an account | No | Low; existing internal scripts remain available |
| Dashboard uses `admin` and `viewer` roles | Recruiters must not receive administrator access | Controlled demo returns viewer access and never a refresh cookie | Operations, evaluation, access management, and mutations remain role-gated | No | Low; current viewer projection is appropriate for synthetic portfolio data |
| Access requests store basic reviewer details and status | Deeper access needs a personal, reviewed path | Keep Intercom invitation personal and manual; extend to permission scopes/invite tokens only as a dedicated migration | Avoid shared third-party credentials | Yes, for scopes/invites | Medium; do not add columns without a full lifecycle |
| Brevo delivery and hashed invite tokens support reviewer invitations; password reset has no complete token/email flow | Account recovery must not imply an email was sent when it was not | Keep reset behavior explicit until a separate hashed, expiring reset-token flow is implemented | Never expose API keys or plaintext passwords | Yes, for reset-token hashes | Medium; requires provider and migration tests |
| Assistant is deterministic and read-only | A model must not become an authorization layer | Keep existing repository authorization and bounded projections; add providers only behind this boundary | Prompt injection cannot grant access or mutate cases | No for current fallback | Low |

## Current auth decision

The public experience is now: **Sign in · Explore recruiter demo · Request access · Forgot password**. The demo endpoint creates an existing `demo_sessions` record, issues a short-lived access token with viewer permissions, does not issue a refresh cookie, and is protected by the public demo rate limiter. Expiry is bounded by `DEMO_AUTH_TTL_MINUTES` (default 30, maximum 120).

The forgot-password route is intentionally honest about the current portfolio limitation: it does not claim to send email because a complete reset-token flow is not implemented. Reviewer invitation email uses a separate hashed, one-time token flow through the server-only Brevo integration. This avoids a misleading or insecure pseudo-reset flow.
