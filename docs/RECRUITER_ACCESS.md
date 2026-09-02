# Recruiter access

The portfolio uses two deliberately separate access paths.

## 1. Read-only dashboard

Create a dedicated reviewer account instead of sharing an operator account:

```bash
cd Intercom-app/backend
SEED_VIEWER_EMAIL=reviewer@example.com \
SEED_VIEWER_PASSWORD='use-a-unique-strong-password' \
SEED_VIEWER_NAME='Recruiter Review' \
npm run db:seed-viewer
```

A `viewer` can inspect the overview, sanitized cases, directory records, and architecture. The API blocks corrections, feedback, imports, sync controls, replay, recovery, operations, and evaluation endpoints.

Share dashboard credentials privately and rotate or remove the account after the review.

## 2. Intercom operator workflow

Never share the Google account used to create the Developer Workspace.

For a scheduled live review:

1. Invite the recruiter's own work email as an Intercom teammate.
2. Grant only the minimum inbox/conversation access needed for the synthetic demo.
3. Do not grant workspace settings, app configuration, teammate management, export, billing, or security permissions.
4. Use only generated conversations and contacts.
5. Remove the teammate when the review is complete.

Set the optional frontend link to the relevant inbox or demo conversation:

```env
NEXT_PUBLIC_INTERCOM_WORKSPACE_URL=https://app.intercom.com/a/inbox/YOUR_WORKSPACE_ID/inbox
```

This link does not bypass Intercom authentication. Only individually invited teammates can open the workspace.

## Recommended recruiter flow

1. Open the portfolio landing page.
2. Sign in with the read-only dashboard account.
3. Review Overview, Case explorer, People & stores, and Architecture.
4. Open one case and use **Open in Intercom**.
5. In Intercom, show the original conversation, Canvas intelligence, related history, and write-back.

For asynchronous applications, use a short screen recording. Reserve live Intercom invitations for scheduled interviews or serious reviewers.
