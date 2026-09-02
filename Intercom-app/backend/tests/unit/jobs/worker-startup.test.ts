import { describe, expect, test, jest } from '@jest/globals';

const workerInstance = { on: jest.fn() };
const Worker = jest.fn().mockImplementation(() => workerInstance);

await jest.unstable_mockModule('bullmq', () => ({
  Worker,
  Queue: jest.fn(),
  UnrecoverableError: class UnrecoverableError extends Error {}
}));

const { startIntercomIntelligenceWorker } = await import(
  '../../../src/jobs/intercom-intelligence.job.js'
);

describe('intelligence worker startup', () => {
  test('does not instantiate a BullMQ Worker on import', () => {
    expect(Worker).not.toHaveBeenCalled();
  });

  test('instantiates a Worker only when startIntercomIntelligenceWorker is called', () => {
    startIntercomIntelligenceWorker();
    expect(Worker).toHaveBeenCalledTimes(1);
  });
});
