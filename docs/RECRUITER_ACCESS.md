# Recruiter access

The portfolio exposes two separate, synthetic-only review paths. Neither path uses employer or customer data.

## Read-only product dashboard

Create a dedicated dashboard viewer:

```bash
cd Intercom-app/backend
SEED_VIEWER_EMAIL=reviewer@example.com \
SEED_VIEWER_PASSWORD='use-a-unique-strong-password' \
SEED_VIEWER_NAME='Recruiter Review' \
npm run db:seed-viewer
```

A `viewer` can inspect Overview, sanitized cases, People & stores, and Architecture. Server-side authorization blocks corrections, feedback, imports, sync controls, replay, recovery, Operations, AI Evaluation, and user management.

Never publish or share an admin account.

## Shared synthetic Intercom workspace

The landing page and Overview can show an intentionally public, tightly restricted Intercom teammate. This is acceptable only because this Developer Workspace contains generated portfolio records and no private data.

Configure the frontend deployment:

```env
NEXT_PUBLIC_INTERCOM_WORKSPACE_URL=https://app.intercom.com/a/inbox/YOUR_WORKSPACE_ID/inbox
NEXT_PUBLIC_INTERCOM_WORKSPACE_NAME=HR Intelligence demo
NEXT_PUBLIC_INTERCOM_DEMO_EMAIL=demo-reviewer@example.com
NEXT_PUBLIC_INTERCOM_DEMO_PASSWORD=unique-password-used-only-for-this-demo
NEXT_PUBLIC_DEMO_VIDEO_EMBED_URL=https://www.youtube.com/embed/VIDEO_ID
```

These `NEXT_PUBLIC_*` values are intentionally visible to every site visitor. Never put Intercom access tokens, client secrets, personal Google credentials, or reused passwords in them.

Lock the Intercom teammate down before publishing:

- Allow only the synthetic demo inbox/conversations.
- Remove Developer Hub, app installation/configuration, teammate management, workspace settings, exports, billing, security, contacts/data deletion, and outbound messaging permissions where Intercom permits.
- Do not make the teammate an administrator.
- Keep all contacts and conversations generated.
- Rotate the password regularly and immediately if the workspace is modified.
- Prefer the subtitled video when the shared seat is unavailable or Intercom blocks concurrent sessions.

## Visitor flow

1. Open the portfolio landing page and find **Live recruiter demo**.
2. Copy the displayed demo teammate email and password.
3. Choose **Open Intercom inbox** and sign in.
4. Select the configured HR Intelligence demo workspace if prompted.
5. Open **Inbox**, then **All** or **Unassigned**.
6. Open any synthetic HR ticket.
7. Inspect the HR Intelligence panel: identity resolution, category, related cases, routing, and review status.
8. Return to the read-only dashboard for aggregated case and architecture evidence.

## Video

Use an iframe-compatible YouTube, Vimeo, or Loom embed URL. Publish a 3–5 minute subtitled walkthrough showing webhook arrival, processing, identity matching, related cases, Intercom write-back, and the read-only dashboard. Do not display secrets, browser password managers, personal tabs, or Developer Hub credentials in the recording.
