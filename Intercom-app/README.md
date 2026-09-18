# Intercom application workspace

This folder contains the HR Intelligence API and its Next.js reviewer/operator dashboard. For the product overview, current production architecture, portfolio evidence, security boundaries, and system screenshots, start with the [root README](../README.md).

## Projects

- [`backend/`](backend/README.md): Express API, PostgreSQL persistence, Intercom/Apify integrations, Actor runtime, and migration/evaluation scripts.
- [`web/`](web/): Next.js App Router application for cases, reviewer access, architecture, and operational summaries.

## Local development

Follow the [backend setup](backend/README.md#development-setup) and configure the web app's `NEXT_PUBLIC_API_URL` for the local API. Run the frontend checks from `web/`:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

For the complete environment setup and production migration command, see the root README and [`docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).
