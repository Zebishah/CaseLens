'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { AlertBanner, PageSkeleton } from '../../components/dashboard/ui';
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
      description="Versioned offline regression suite for extraction, classification, and safe human-review behavior on anonymized cases."
    >
      {error ? (
        <AlertBanner tone="danger" title="Could not load evaluation">
          {error}
        </AlertBanner>
      ) : null}
      {!data && !error ? <PageSkeleton variant="overview" /> : null}
      {data ? (
        <div className="space-y-6">
          <AlertBanner tone="info" title="Deterministic safety baseline">
            Scores come from a local subject-name heuristic ({data.modelVersion}) against {data.datasetSize}{' '}
            versioned cases ({data.datasetVersion}). Live tickets use Gemini with prompt {data.promptVersion}.{' '}
            <Link href="/overview" className="font-medium text-primary hover:text-primary-hover">
              See live stats on Overview
            </Link>
            .
          </AlertBanner>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ScoreCard
              label="Validation cases"
              value={String(data.datasetSize)}
              hint={`${data.datasetVersion} · versioned anonymized regression set`}
            />
            <ScoreCard
              label="Name extraction"
              value={pct(data.employeeMatchRecall)}
              hint={`${data.employeeTruePositives} exact matches · ${data.employeeFalsePositives} wrong · ${data.employeeFalseNegatives} missed`}
            />
            <ScoreCard
              label="Category classification"
              value={pct(data.classificationAccuracy)}
              hint={`${data.classificationHits} of ${data.datasetSize} cases matched the labeled category`}
            />
            <ScoreCard
              label="Safety escalations"
              value={`${reviewCount}/${total}`}
              hint="Conservative review for incomplete identity or store evidence"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="dash-panel">
              <h2 className="text-sm font-semibold tracking-tight text-primary">Evaluation scope</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-muted">
                <li>
                  <span className="font-medium text-primary">Names.</span> Pull a person from the subject line and
                  compare to the labeled name. Precision {pct(data.employeeMatchPrecision)}.
                </li>
                <li>
                  <span className="font-medium text-primary">Directory resolution.</span> The controlled evaluation directory contains{' '}
                  {data.fixtureDirectory.join(' and ')} exist in this harness. {data.directoryTruePositives} resolved
                  · {pct(data.directoryResolutionPrecision)} precision.
                </li>
                <li>
                  <span className="font-medium text-primary">Related-case proxy.</span> A fixture is “related” only if
                  that sample directory hit. Not live SQL search. Precision {pct(data.relatedCasePrecision)}, recall{' '}
                  {pct(data.relatedCaseRecall)} ({data.relatedTruePositives} hits, {data.relatedFalsePositives} extra,{' '}
                  {data.relatedFalseNegatives} missed).
                </li>
              </ul>
            </section>
            <section className="dash-panel lg:col-span-2">
              <h2 className="text-sm font-semibold tracking-tight text-primary">Quality gates</h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {passCount} of {total} rows matched both name and category. {data.lowConfidenceCount} are treated as
                low confidence (no two-word name). {reviewCount} would be sent to a human in this harness.
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

function ScoreCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="dash-panel">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-primary">{value}</p>
      <p className="mt-2 text-sm leading-5 text-muted">{hint}</p>
    </div>
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
