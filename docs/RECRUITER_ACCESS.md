# Recruiter access

The portfolio uses separate access paths for the dashboard and Intercom. No shared Intercom password, verification code, production data, or employer account is exposed.

## Public walkthrough

Every visitor can use the landing page without signing in:

- Product and architecture narrative
- Subtitled walkthrough video
- Sanitized screenshots of the Inbox, HR Intelligence Canvas, and dashboard
- Explanation of the dashboard/Intercom boundary
- Personal Intercom invitation request form

Frontend deployment variables:

```env
NEXT_PUBLIC_INTERCOM_WORKSPACE_NAME=Nagumo Workspace [DEV]
NEXT_PUBLIC_DEMO_VIDEO_EMBED_URL=https://www.youtube.com/embed/VIDEO_ID
NEXT_PUBLIC_DEMO_SCREENSHOT_INBOX_URL=https://cdn.example.com/intercom-inbox.png
NEXT_PUBLIC_DEMO_SCREENSHOT_CANVAS_URL=https://cdn.example.com/hr-intelligence-canvas.png
NEXT_PUBLIC_DEMO_SCREENSHOT_DASHBOARD_URL=https://cdn.example.com/dashboard.png
```

The optional `NEXT_PUBLIC_INTERCOM_WORKSPACE_URL` is rendered only for authenticated administrators. It is not a secret, but public visitors and viewer accounts do not receive that shortcut.

## Dashboard reviewer

Create a separate read-only dashboard viewer:

```bash
cd Intercom-app/backend
SEED_VIEWER_EMAIL=reviewer@example.com \
SEED_VIEWER_PASSWORD='use-a-unique-strong-password' \
SEED_VIEWER_NAME='Recruiter Review' \
npm run db:seed-viewer
```

A viewer can inspect Overview, sanitized cases, People & stores, and Architecture. Server authorization blocks corrections, imports, recovery, Operations, AI Quality, invitation administration, and user management.

## Intercom invitation request

Apply the recruiter-access migration once per database:

```bash
cd Intercom-app/backend
npm run db:migrate-recruiter-access
```

Public workflow:

1. The reviewer opens `/access`.
2. They provide their name, work email, organization/role, review purpose, and consent.
3. The API validates the request, rate-limits submissions, uses a honeypot, normalizes the email, and avoids duplicate pending requests.
4. The response confirms receipt without revealing whether that email already has a pending request.
5. An administrator reviews the request under Dashboard → Access requests.
6. After verifying the requester, the administrator marks it approved.
7. The administrator manually invites that exact email from Intercom teammate settings with minimum permissions.
8. The administrator marks the request invited.
9. The reviewer accepts the official email and completes Intercom's own verification.
10. They select **Nagumo Workspace [DEV]**, open **Inbox → All or Unassigned**, and inspect a synthetic ticket.

Approval in this application intentionally does not call an undocumented or privileged Intercom invitation API. It records an auditable operator decision; Intercom remains the identity and invitation authority.

## Intercom teammate restrictions

Before inviting a reviewer:

- Allow access only to the synthetic demonstration workspace/inbox.
- Do not grant administrator permissions.
- Remove Developer Hub, installation/configuration, teammate management, billing, exports, security settings, data deletion, and outbound messaging access where supported.
- Never send shared credentials, email verification tokens, 2FA recovery codes, API tokens, or a Google account.
- Expire/remove the teammate after the review.
- Keep every contact and conversation synthetic.

## Recording and screenshots

The 3–5 minute subtitled walkthrough should show:

1. A synthetic Intercom conversation arriving.
2. The embedded HR Intelligence panel.
3. Employee resolution, category, related history, routing, and manual review.
4. Internal note/tag write-back.
5. Dashboard Overview and Architecture.
6. A brief administrator-only Operations view showing idempotency, outbox/queue health, and write-back status.

Do not record browser password managers, verification emails, personal tabs, API credentials, Developer Hub secrets, or real people/company data.
