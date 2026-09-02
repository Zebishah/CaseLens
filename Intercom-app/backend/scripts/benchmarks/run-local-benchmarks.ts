/**
 * Local CPU benchmarks. Results are labelled Local benchmark only.
 * Raw JSON is written to benchmarks/raw/ (gitignored).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import {
  hashIngestionPayload,
  normalizeIngestionEvent
} from '../../src/modules/ingestion/ingestion.normalize.js';
import { boundedBackoffMs, classifyProcessingError } from '../../src/modules/ingestion/error-classification.js';
import { verifyResendSignature } from '../../src/modules/resend/resend.signature.js';
import {
  computeWebhookSignature,
  verifyWebhookSignature
} from '../../src/modules/intercom/intercom.signature.js';

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index]!;
};

const timeMany = (rounds: number, fn: () => void): number[] => {
  const samples: number[] = [];
  for (let i = 0; i < rounds; i += 1) {
    const started = process.hrtime.bigint();
    fn();
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  return samples;
};

const gitCommit = (): string => {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
};

const event = normalizeIngestionEvent({
  source: 'demo',
  externalEventId: 'bench-1',
  senderEmail: '1042@northwind.co',
  senderName: 'Store Manager',
  recipients: ['hr@northwind.co'],
  subject: 'Attendance — Jordan Hale',
  plainTextContent: 'Jordan Hale was late at store 1042.',
  receivedAt: new Date('2026-09-01T12:00:00.000Z'),
  attachments: [],
  providerMetadata: {},
  correlationId: '11111111-1111-1111-1111-111111111111',
  processingMode: 'fixture'
});

const payload = JSON.stringify({ type: 'email.received', data: { email_id: 'em_1' } });
const secret = `whsec_${Buffer.from('benchmark-resend-secret').toString('base64')}`;
const id = 'msg_bench';
const timestamp = String(Math.floor(Date.now() / 1000));
const decoded = Buffer.from(secret.slice('whsec_'.length), 'base64');
const digest = createHmac('sha256', decoded).update(`${id}.${timestamp}.${payload}`).digest('base64');
const signatureHeader = `v1,${digest}`;

const normalizeSamples = timeMany(400, () => {
  normalizeIngestionEvent(event);
});
const hashSamples = timeMany(400, () => {
  hashIngestionPayload(event);
});
const signatureSamples = timeMany(400, () => {
  verifyResendSignature({
    payload,
    id,
    timestamp,
    signatureHeader,
    secret
  });
});
const webhookBody = Buffer.from(
  JSON.stringify({ type: 'notification_event', topic: 'ping', id: 'bench-ping', data: { item: {} } })
);
const webhookSecret = 'benchmark-intercom-client-secret';
const webhookHeader = computeWebhookSignature(webhookBody, webhookSecret);
const webhookSignatureSamples = timeMany(400, () => {
  verifyWebhookSignature(webhookHeader, webhookBody, webhookSecret);
});
const classifySamples = timeMany(400, () => {
  classifyProcessingError(new Error('Validation error: invalid payload'));
  classifyProcessingError(new Error('429 rate limit'));
});

const duplicateHashesMatch =
  hashIngestionPayload({ ...event, recipients: ['b@northwind.co', 'a@northwind.co'] }) ===
  hashIngestionPayload({ ...event, recipients: ['a@northwind.co', 'b@northwind.co'] });

const result = {
  label: 'Local benchmark',
  date: new Date().toISOString().slice(0, 10),
  environment: 'local',
  gitCommit: gitCommit(),
  datasetSize: 400,
  runCount: 400,
  command: 'npm run bench:local',
  rawResults: {
    normalizeMs: { p50: percentile(normalizeSamples, 50), p95: percentile(normalizeSamples, 95) },
    payloadHashMs: { p50: percentile(hashSamples, 50), p95: percentile(hashSamples, 95) },
    resendSignatureMs: { p50: percentile(signatureSamples, 50), p95: percentile(signatureSamples, 95) },
    intercomWebhookSignatureMs: {
      p50: percentile(webhookSignatureSamples, 50),
      p95: percentile(webhookSignatureSamples, 95)
    },
    classifyErrorMs: { p50: percentile(classifySamples, 50), p95: percentile(classifySamples, 95) },
    duplicatePayloadHashStable: duplicateHashesMatch,
    backoffMs: [boundedBackoffMs(1), boundedBackoffMs(2), boundedBackoffMs(5)]
  }
};

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../benchmarks/raw');
mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, `local-${result.date}-${result.gitCommit}.json`);
writeFileSync(outFile, JSON.stringify(result, null, 2));

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`Wrote ${outFile}\n`);
