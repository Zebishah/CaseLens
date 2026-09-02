# Benchmarks

No production measurements are claimed. Numbers below are **Local benchmark** or **CI test** only.

## How to run locally

```bash
cd Intercom-app/backend
npm test
npm run eval:run
npm run bench:local
npm run intercom:canvas-smoke
```

Raw JSON from `bench:local` and `eval:run` is written under `Intercom-app/backend/benchmarks/raw/` (gitignored).

Re-run commands on this pass before quoting counts. Historical rows below are **not** this pass.

## Baseline captured 2026-09-01 (pre-portfolio modules)

| Check | Result | Label |
|-------|--------|-------|
| `npm test` | 53 suites, 338 tests passed | Local / this checkout |
| Typecheck | pass | Local |
| Build | pass | Local |
| Lint | 23 unused-variable errors | Local |

## After production-readiness pass (2026-09-01, git `85f289c` working tree)

| Check | Result | Label |
|-------|--------|-------|
| `npm test` (backend) | **79 suites, 439 tests passed** | Local / CI test |
| `npm run lint` (backend) | pass | Local |
| `npm run typecheck` (backend) | pass | Local |
| `npm run build` (backend) | pass | Local |
| `npm run eval:run` | see table | Local fixture evaluation |
| `npm run bench:local` | see table | Local benchmark |
| `npm run intercom:canvas-smoke` | covered by Jest canvas contract + canvas HTTP tests | Local / CI test |
| `npx next lint` (frontend) | pass with existing hook/font warnings; **non-interactive** via `eslint.config.mjs` | Local |
| `npm run typecheck` (frontend) | pass | Local |
| `npm run build` (frontend) | Next.js 15 production build, 11 routes | Local |

Live Intercom/Gemini/Canvas Developer Hub: **not measured**.

### `npm run bench:local` this pass (400 iterations, CPU-only)

| Metric | p50 | p95 |
|--------|-----|-----|
| Event normalize | 0.018 ms | 0.043 ms |
| Payload hash | 0.003 ms | 0.013 ms |
| Resend signature verify | 0.005 ms | 0.006 ms |
| Intercom webhook HMAC-SHA1 verify | 0.004 ms | 0.005 ms |
| Error classification | 0.004 ms | 0.005 ms |

Duplicate payload hashes (recipient order ignored): **true**. Bounded backoff: 1000 / 2000 / 16000 ms.

These are not HTTP webhook acknowledgement or end-to-end processing times. Express-stack webhook+Canvas flow is covered by `tests/integration/e2e/intercom-http-flow.test.ts` without a latency SLO.

### `npm run eval:run` this pass (`eval-v1`, 6 anonymized cases, fixture heuristics)

| Metric | Value | Label |
|--------|-------|-------|
| Dataset size | 6 | Local fixture evaluation |
| Classification accuracy | 0.67 | Local fixture evaluation |
| Employee-match precision | 0.67 | Local fixture evaluation |
| Employee-match recall | 1.00 | Local fixture evaluation |
| Related-case precision | 0.75 | Local fixture evaluation |
| Related-case recall | 1.00 | Local fixture evaluation |
| Low-confidence rate | 0.17 | Local fixture evaluation |
| Manual-review rate | 0.33 | Local fixture evaluation |
| Prompt / model version | extraction-v1 / fixture-v1 | Local fixture evaluation |
| Command | `npm run eval:run` | 2026-09-01 local inline / fixture |

Do not present these scores as production model quality or as SQL related-case retrieval quality.

## After portfolio hardening (2026-09-01, earlier the same day)

| Check | Result | Label |
|-------|--------|-------|
| `npm run lint` (backend) | pass | Local |
| `npx tsc -p tsconfig.json --noEmit` (backend) | pass | Local |
| `npm run build` (backend) | pass | Local |
| `npm test` (backend) | **63 suites, 362 tests passed** | Local / CI test |
| `npm run build` (frontend) | Next.js 15 production build, 10 routes | Local |
| `npm run bench:local` | see table below | Local benchmark |
| `npm run eval:run` | dataset `eval-v1`, 6 cases | Local benchmark |

### `npm run bench:local` (400 iterations, CPU-only)

| Metric | p50 | p95 |
|--------|-----|-----|
| Event normalize | 0.034 ms | 0.079 ms |
| Payload hash | 0.011 ms | 0.018 ms |
| Resend signature verify | 0.022 ms | 0.038 ms |
| Error classification | 0.004 ms | 0.021 ms |

Duplicate payload hashes (recipient order ignored): **true**. Bounded backoff: 1000 / 2000 / 16000 ms.

These are not webhook acknowledgement or end-to-end processing times. Those require a running PostgreSQL, Redis, and worker and were not measured in this session (`pg_isready` had no local listener during the original audit).

### `npm run eval:run` (fixture heuristics on `eval/dataset.v1.json`)

| Metric | Value | Label |
|--------|-------|-------|
| Dataset size | 6 | Local benchmark |
| Classification accuracy | 0.67 | Local benchmark |
| Employee-match precision | 0.67 | Local benchmark |
| Employee-match recall | 1.00 | Local benchmark |
| Related-case precision | 0.75 | Local benchmark |
| Related-case recall | 1.00 | Local benchmark |
| Low-confidence rate | 0.17 | Local benchmark |
| Manual-review rate | 0.33 | Local benchmark |
| Prompt / model version | extraction-v1 / fixture-v1 | Local benchmark |

Do not present these scores as production model quality. They measure the deterministic subject/name fixture path on a small anonymized set.
