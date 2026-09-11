'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { AlertBanner, MetricCard, PageSkeleton } from '../../components/dashboard/ui';
import { api } from '../../lib/api';
import { formatCategoryLabel } from '../../lib/case-display';

type CaseOutcome = {
  id: string;
  subject: string;
  expectedEmployee: string | null;
  predictedEmployee: string | null;
  expectedCategory: string;
  predictedCategory: string;
  nameMatch: boolean;
  categoryMatch: boolean;
  inFixtureDirectory: boolean;
  flaggedForReview: boolean;
};

type Evaluation = {
  datasetVersion: string;
  datasetSize: number;
  promptVersion: string;
  modelVersion: string;
  usesLiveModel: boolean;
  method: string;
  fixtureDirectory: string[];
  classificationAccuracy: number;
  classificationHits: number;
  employeeMatchPrecision: number;
  employeeMatchRecall: number;
  employeeTruePositives: number;
  employeeFalsePositives: number;
  employeeFalseNegatives: number;
  directoryResolutionPrecision: number;
  directoryTruePositives: number;
  relatedCasePrecision: number;
  relatedCaseRecall: number;
  relatedTruePositives: number;
  relatedFalsePositives: number;
  relatedFalseNegatives: number;
  lowConfidenceRate: number;
  lowConfidenceCount: number;
  manualReviewRate: number;
  manualReviewCount: number;
  cases: CaseOutcome[];
};

const pct = (value: number): string => `${Math.round(value * 100)}%`;

export default function EvaluationPage() {
  const [data, setData] = useState<Evaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Evaluation>('/api/evaluation')
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load evaluation'));
  }, []);

  const passCount = data?.cases.filter((row) => row.nameMatch && row.categoryMatch).length ?? 0;
  const reviewCount = data?.manualReviewCount ?? 0;
  const total = data?.datasetSize ?? 0;

  return (
    <AppShell
      title="AI Quality"
      description="A measured fixture baseline for extraction, classification, identity resolution, related-case behavior, and safe human-review decisions — separate from live production quality."
    >
      {error ? (
        <AlertBanner tone="danger" title="Could not load evaluation">
          {error}
        </AlertBanner>
      ) : null}
      {!data && !error ? <PageSkeleton variant="overview" /> : null}
      {data ? (
        <div className="space-y-6">
          <AlertBanner tone="info" title="Deterministic safety baseline" action={<button type="button" className="rounded-lg border border-sky-200 bg-white/70 px-3 py-2 text-xs font-semibold text-sky-900 hover:bg-white" onClick={() => window.dispatchEvent(new CustomEvent('hr-assistant:open'))}>Explain evaluation</button>}>
            These reproducible checks run against {data.datasetSize}{' '}
            versioned anonymized cases ({data.datasetVersion}) using baseline {data.modelVersion}. Production tickets
            use Gemini with prompt {data.promptVersion}; offline results are intentionally reported separately.{' '}
            <Link href="/overview" className="font-medium text-primary hover:text-primary-hover">
              See live stats on Overview
            </Link>
            .
          </AlertBanner>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Validation cases"
              value={String(data.datasetSize)}
              hint={`${data.datasetVersion} · versioned anonymized regression set`}
              icon="cases"
            />
            <MetricCard
              label="Name extraction"
              value={pct(data.employeeMatchRecall)}
              hint={`${data.employeeTruePositives} exact matches · ${data.employeeFalsePositives} wrong · ${data.employeeFalseNegatives} missed`}
              icon="users"
            />
            <MetricCard
              label="Category classification"
              value={pct(data.classificationAccuracy)}
              hint={`${data.classificationHits} of ${data.datasetSize} cases matched the labeled category`}
              icon="cases"
            />
            <MetricCard
              label="Safety escalations"
              value={`${reviewCount}/${total}`}
              hint="Conservative review for incomplete identity or store evidence"
              icon="shield"
              tone={reviewCount > 0 ? 'warning' : 'success'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="dash-panel">
              <h2 className="text-sm font-semibold tracking-tight text-primary">Evaluation scope</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
                <li>
                  <span className="font-medium text-primary">Identity extraction.</span> Extract a person from the
                  subject and compare it with the labeled result. Precision {pct(data.employeeMatchPrecision)}.
                </li>
                <li>
                  <span className="font-medium text-primary">Directory resolution.</span> The controlled evaluation directory contains{' '}
                  {data.fixtureDirectory.join(' and ')}. {data.directoryTruePositives} resolved
                  · {pct(data.directoryResolutionPrecision)} precision.
                </li>
                <li>
                  <span className="font-medium text-primary">Association baseline.</span> A case is associated only
                  after a controlled directory match. This remains separate from live SQL retrieval. Precision{' '}
                  {pct(data.relatedCasePrecision)}, recall{' '}
                  {pct(data.relatedCaseRecall)} ({data.relatedTruePositives} hits, {data.relatedFalsePositives} extra,{' '}
                  {data.relatedFalseNegatives} missed).
                </li>
              </ul>
            </section>
            <section className="dash-panel lg:col-span-2">
              <h2 className="text-sm font-semibold tracking-tight text-primary">Quality gates</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {passCount} of {total} cases matched both identity and category. {data.lowConfidenceCount} lacked
                sufficient identity evidence. {reviewCount} were safely routed to human review.
              </p>
              <div className="mt-5 space-y-3">
                <Bar
                  label="Name + category both correct"
                  count={passCount}
                  total={total}
                  color="bg-success"
                />
                <Bar label="Protected by human review" count={reviewCount} total={total} color="bg-highlight" />
                <Bar
                  label="Insufficient identity evidence"
                  count={data.lowConfidenceCount}
                  total={total}
                  color="bg-primary/30"
                />
              </div>
            </section>
          </div>

          <section className="dash-panel overflow-hidden p-0">
            <div className="px-5 py-4">
              <h2 className="text-sm font-semibold tracking-tight text-primary">Validation case evidence</h2>
              <p className="mt-1 text-sm text-muted">
                Expected versus observed results for each anonymized regression case.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="dash-table min-w-full text-left text-sm">
                <thead>
                  <tr>
                    {['Subject', 'Name', 'Category', 'Directory', 'Review'].map((heading) => (
                      <th key={heading} className="px-5 py-3">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.cases.map((row) => (
                    <tr key={row.id} className="dash-row border-t border-primary/8">
                      <td className="max-w-[22rem] px-5 py-3">
                        <p className="font-medium text-primary">{row.subject}</p>
                        <p className="text-xs text-muted">{row.id}</p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-primary">{row.predictedEmployee ?? '—'}</p>
                        <p className="text-xs text-muted">
                          {row.nameMatch ? 'Matches label' : `Expected ${row.expectedEmployee ?? 'none'}`}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-primary">{formatCategoryLabel(row.predictedCategory)}</p>
                        <p className="text-xs text-muted">
                          {row.categoryMatch ? 'Matches label' : `Expected ${formatCategoryLabel(row.expectedCategory)}`}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-muted">{row.inFixtureDirectory ? 'In sample set' : '—'}</td>
                      <td className="px-5 py-3 text-muted">
                        {row.flaggedForReview ? 'Would review' : 'Clear'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}

function Bar({
  label,
  count,
  total,
  color
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const width = total > 0 ? `${Math.round((count / total) * 100)}%` : '0%';
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-primary">{label}</span>
        <span className="tabular-nums text-muted">
          {count} · {width}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-paper">
        <div className={`h-full rounded-full ${color}`} style={{ width }} />
      </div>
    </div>
  );
}
