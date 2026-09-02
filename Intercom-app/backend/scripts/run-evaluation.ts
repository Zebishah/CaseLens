import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgres://eval:eval@127.0.0.1:5432/eval';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.JWT_SECRET ??= 'evaluation-script-placeholder-secret';
process.env.INTERCOM_ENABLED ??= 'false';
process.env.LLM_MODE ??= 'fixture';
process.env.JOB_PROCESSING_MODE ??= 'inline';
process.env.RUN_WORKERS ??= 'false';

const { runEvaluation } = await import('../src/modules/evaluation/evaluation.runner.js');

const gitCommit = (): string => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};

const metrics = runEvaluation();
const result = {
  label: 'Local fixture evaluation',
  date: new Date().toISOString().slice(0, 10),
  environment: 'local',
  processingMode: process.env.JOB_PROCESSING_MODE,
  llmMode: process.env.LLM_MODE,
  gitCommit: gitCommit(),
  command: 'npm run eval:run',
  ...metrics
};

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../benchmarks/raw');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, `eval-fixture-${result.date}-${result.gitCommit}.json`);
writeFileSync(outFile, JSON.stringify(result, null, 2));

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`Wrote ${outFile}\n`);
