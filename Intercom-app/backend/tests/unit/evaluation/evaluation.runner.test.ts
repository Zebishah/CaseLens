import { describe, expect, test } from '@jest/globals';
import { runEvaluation } from '../../../src/modules/evaluation/evaluation.runner.js';

describe('AI evaluation runner', () => {
  test('produces metrics for the versioned dataset without calling a live model', () => {
    const metrics = runEvaluation();
    expect(metrics.datasetSize).toBeGreaterThan(0);
    expect(metrics.modelVersion).toBe('fixture-v1');
    expect(metrics.classificationAccuracy).toBeGreaterThanOrEqual(0);
    expect(metrics.classificationAccuracy).toBeLessThanOrEqual(1);
  });

  test('returns a recruiter-readable report with counts and per-case outcomes', () => {
    const report = runEvaluation();
    expect(report.usesLiveModel).toBe(false);
    expect(report.method).toBe('subject-heuristic');
    expect(report.cases).toHaveLength(report.datasetSize);
    expect(report.classificationHits).toBeGreaterThanOrEqual(0);
    expect(report.classificationHits).toBeLessThanOrEqual(report.datasetSize);
    expect(report.manualReviewCount).toBeGreaterThanOrEqual(0);
    expect(report.cases[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        subject: expect.any(String),
        categoryMatch: expect.any(Boolean),
        nameMatch: expect.any(Boolean),
        flaggedForReview: expect.any(Boolean)
      })
    );
  });
});
