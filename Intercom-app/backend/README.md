# Intercom HR Intelligence — Backend

Node.js + TypeScript API for the Operational Intelligence Layer (Milestone 1: employee match + related conversations sidebar).

## Setup (SM1)
1. Clone repository and go to the `backend` folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your env file and fill in Intercom credentials:
   ```bash
   cp .env.example .env
   ```
   Required Intercom variables when `INTERCOM_ENABLED=true`: `INTERCOM_ACCESS_TOKEN`, `INTERCOM_CLIENT_SECRET`, `INTERCOM_WORKSPACE_ID`, `INTERCOM_ADMIN_ID`. `INTERCOM_BOT_ADMIN_ID` and `INTERCOM_WEBHOOK_SECRET` remain aliases. See `../../docs/INTERCOM_DEVELOPER_HUB.md`.
4. Infrastructure — pick one:
   - **Railway Postgres (public URL) + local Redis** — no Docker. Set `DATABASE_URL` to Railway public URL, `REDIS_URL=redis://localhost:6379`, ensure local Redis is running (`redis-cli ping` → `PONG`).
   - **All local** — `docker compose up -d`, then `DATABASE_URL=postgresql://user:password@localhost:5432/db_name`.
5. Run in development:
   ```bash
   npm run dev
   ```
   The API listens on `http://localhost:3002` (`PORT` in `.env`).

## Database setup (SM2)
1. Enable extensions, then push schema (`vector` for embedding column, `pg_trgm` for name matching):
   ```bash
   npm run db:push
   ```
   (`db:push` runs `db:extensions` first on whatever `DATABASE_URL` points to.) If Railway rejects `vector`, use Docker Postgres instead.
   Or generate SQL migrations: `npm run migrate` then apply with your migration runner.
3. Optional dev seed (Jonathan Fritz + related cases):
   ```bash
   npm run db:seed
   ```

### SM3 — Intercom layer
- `src/modules/intercom/intercom.signature.ts` — webhook (`x-hub-signature`) + canvas (`x-body-signature`) verification
- `src/modules/intercom/intercom.client.ts` — `getConversation`, `getAdmin` (Intercom REST API)
- `src/modules/intercom/intercom.types.ts` — Zod schemas for webhook/canvas payloads
- `src/middlewares/intercomWebhook.middleware.ts` — raw body parser + verify
- `POST /webhooks/intercom` — SM4 conversation sync (wired in `src/routes/intercom.routes.ts`)
- `src/middlewares/intercomCanvas.middleware.ts` — canvas verify (wire on `/canvas/*` in SM7)

### Milestone 1 tables
- `employee_identities` — one row per real person
- `employee_aliases` — name spellings linked to an identity
- `conversations` — synced Intercom cases + `intelligence_snapshot` for the sidebar
- `conversation_messages` — message text (embeddings column reserved for M5)

## Scripts
- `npm run build` - Compile TypeScript
- `npm run start` - Run production build
- `npm run test` - Run tests once
- `npm run test:watch` - Watch tests
- `npm run test:coverage` - Coverage report
- `npm run lint` - Run ESLint
- `npm run format` - Run Prettier
- `npm run migrate` - Generate Drizzle migrations from schema
- `npm run db:push` - Apply schema directly to Postgres (local dev)
- `npm run db:seed` - Load Milestone 1 sample data

## Testing
Run all tests:
```bash
npm run test
```

Integration tests use Supertest with the Express app.

## Drizzle migrations
This project includes schema definitions only. To generate migrations:
```bash
npm run migrate
```

## Project Structure
- `src/config` - environment, db, redis, intercom, logger config
- `src/constants` - shared constants (`intercom.constants.ts` for M1 thresholds and webhook topics)
- `src/modules` - feature modules (auth, user, example; intercom modules added in later sub-milestones)
- `src/middlewares` - auth, validation, error, rate limit, request logger
- `src/services` - shared JWT/cache services
- `src/database` - drizzle connection and schema definitions
- `src/queues`, `src/jobs` - BullMQ queue and processor
- `tests/unit`, `tests/integration` - unit and integration tests
