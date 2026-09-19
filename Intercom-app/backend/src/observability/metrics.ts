export type MetricsSnapshot = {
  api: {
    requests: number;
    errors5xx: number;
    averageLatencyMs: number | null;
  };
  redis: {
    cacheHits: number;
    cacheMisses: number;
    cacheBypasses: number;
    rateLimitRedisFallbacks: number;
    rateLimitRejects: number;
    hitRate: number | null;
  };
  apify: {
    dispatchAttempts: number;
    dispatchFailures: number;
    successfulRuns: number;
    failedRuns: number;
    reconciledRuns: number;
  };
  ai: {
    liveRequests: number;
    failures: number;
    averageLatencyMs: number | null;
  };
  outbox: {
    recovered: number;
  };
};

const counters = {
  apiRequests: 0,
  apiErrors5xx: 0,
  apiLatencyTotalMs: 0,
  cacheHits: 0,
  cacheMisses: 0,
  cacheBypasses: 0,
  rateLimitRedisFallbacks: 0,
  rateLimitRejects: 0,
  apifyDispatchAttempts: 0,
  apifyDispatchFailures: 0,
  apifySuccessfulRuns: 0,
  apifyFailedRuns: 0,
  apifyReconciledRuns: 0,
  aiLiveRequests: 0,
  aiFailures: 0,
  aiLatencyTotalMs: 0,
  outboxRecovered: 0
};

export const operationalMetrics = {
  apiCompleted(statusCode: number, durationMs: number): void {
    counters.apiRequests += 1;
    counters.apiLatencyTotalMs += Math.max(0, durationMs);
    if (statusCode >= 500) counters.apiErrors5xx += 1;
  },
  cacheHit(): void { counters.cacheHits += 1; },
  cacheMiss(): void { counters.cacheMisses += 1; },
  cacheBypass(): void { counters.cacheBypasses += 1; },
  rateLimitFallback(): void { counters.rateLimitRedisFallbacks += 1; },
  rateLimitRejected(): void { counters.rateLimitRejects += 1; },
  apifyDispatchAttempt(): void { counters.apifyDispatchAttempts += 1; },
  apifyDispatchFailure(): void { counters.apifyDispatchFailures += 1; },
  apifyRunSucceeded(): void { counters.apifySuccessfulRuns += 1; },
  apifyRunFailed(): void { counters.apifyFailedRuns += 1; },
  apifyRunReconciled(): void { counters.apifyReconciledRuns += 1; },
  aiRequest(): void { counters.aiLiveRequests += 1; },
  aiFailure(): void { counters.aiFailures += 1; },
  aiCompleted(durationMs: number): void { counters.aiLatencyTotalMs += Math.max(0, durationMs); },
  outboxRecovered(count: number): void { counters.outboxRecovered += Math.max(0, count); },
  snapshot(): MetricsSnapshot {
    const cacheOperations = counters.cacheHits + counters.cacheMisses;
    return {
      api: {
        requests: counters.apiRequests,
        errors5xx: counters.apiErrors5xx,
        averageLatencyMs: counters.apiRequests ? Math.round(counters.apiLatencyTotalMs / counters.apiRequests) : null
      },
      redis: {
        cacheHits: counters.cacheHits,
        cacheMisses: counters.cacheMisses,
        cacheBypasses: counters.cacheBypasses,
        rateLimitRedisFallbacks: counters.rateLimitRedisFallbacks,
        rateLimitRejects: counters.rateLimitRejects,
        hitRate: cacheOperations ? Number((counters.cacheHits / cacheOperations).toFixed(3)) : null
      },
      apify: {
        dispatchAttempts: counters.apifyDispatchAttempts,
        dispatchFailures: counters.apifyDispatchFailures,
        successfulRuns: counters.apifySuccessfulRuns,
        failedRuns: counters.apifyFailedRuns,
        reconciledRuns: counters.apifyReconciledRuns
      },
      ai: {
        liveRequests: counters.aiLiveRequests,
        failures: counters.aiFailures,
        averageLatencyMs: counters.aiLiveRequests ? Math.round(counters.aiLatencyTotalMs / counters.aiLiveRequests) : null
      },
      outbox: { recovered: counters.outboxRecovered }
    };
  }
};
