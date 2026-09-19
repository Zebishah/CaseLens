# Benchmarks and verification

No production performance or business metrics are claimed. Values below are labelled by environment.

## Historical CI verification

The repository previously recorded a CI snapshot from September 2026. It is retained as historical context only; current test counts and coverage belong to the latest successful CI run and are not hard-coded here.

| Check | Result | Label |
|---|---:|---|
| Backend lint | Passed | CI verification |
| Backend typecheck | Passed | CI verification |
| Backend tests | Passed | Historical CI verification |
| Backend production build | Passed | CI verification |
| Migration/evaluation files | Present | CI verification |
| Frontend lint + typecheck | Passed | CI verification |
| Frontend production build | Passed | CI verification |
| Frontend routes | Generated successfully | Historical CI build output |

Dependency advisories change over time. See `docs/SECURITY.md` for the latest local audit classification and its limits.

## Reproducible local commands

```bash
cd Intercom-app/backend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run eval:run
npm run bench:local
npm run intercom:canvas-smoke

cd ../frontend
npm ci
npm run lint
npx tsc --noEmit
npx playwright install chromium
npm run test:e2e
npm run build
```

Raw local benchmark/evaluation JSON is written under `Intercom-app/backend/benchmarks/raw/` and is intentionally gitignored. Record the environment, date, dataset size, commit, and command before quoting a result.

## Existing local CPU microbenchmark

A prior 400-iteration local run measured only small pure functions:

| Metric | p50 | p95 |
|---|---:|---:|
| Event normalization | 0.018 ms | 0.043 ms |
| Payload hashing | 0.003 ms | 0.013 ms |
| Resend signature verification | 0.005 ms | 0.006 ms |
| Intercom HMAC-SHA1 verification | 0.004 ms | 0.005 ms |
| Error classification | 0.004 ms | 0.005 ms |

These values are **not** HTTP acknowledgement latency, end-to-end processing time, throughput, or a production SLO.

## Existing fixture evaluation

A prior local `eval-v1` fixture run used 6 anonymized cases and fixture heuristics. It is not live Gemini or SQL-retrieval quality:

| Metric | Value |
|---|---:|
| Classification accuracy | 0.67 |
| Employee precision | 0.67 |
| Employee recall | 1.00 |
| Related precision | 0.75 |
| Related recall | 1.00 |
| Low-confidence rate | 0.17 |
| Manual-review rate | 0.33 |

Do not put these fixture values on the CV as production AI accuracy. The defensible numerical evidence today is the passing CI suite; product impact should be described through verified failure modes prevented, not invented percentages.
# Evidence boundary

Assistant responses and fixture evaluation are engineering evidence, not proof of customer savings or production performance. Keep fixture metrics explicitly labeled as fixture metrics and report any future latency, throughput, or business outcomes with the environment and measurement method.
