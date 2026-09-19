'use client';

import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

type Evaluation = {
  datasetVersion?: string;
  datasetSize?: number;
  classificationAccuracy?: number;
  employeeMatchPrecision?: number;
  modelVersion?: string;
};

const formatPct = (value?: number): string =>
  typeof value === 'number' ? `${Math.round(value * 100)}%` : '—';

export function EvaluationStrip() {
  const [data, setData] = useState<Evaluation | null>(null);

  useEffect(() => {
    void api
      .get<Evaluation>('/api/evaluation')
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const metrics = [
    {
      label: 'Dataset',
      value: `${data?.datasetVersion ?? 'eval-v1'}`,
      hint: `${data?.datasetSize ?? 6} fixture cases`
    },
    {
      label: 'Classification',
      value: formatPct(data?.classificationAccuracy),
      hint: 'Subject parser vs labels'
    },
    {
      label: 'Employee precision',
      value: formatPct(data?.employeeMatchPrecision),
      hint: 'Local / CI only'
    }
  ];

  return (
    <div>
      <p className="inline-flex rounded-full bg-highlight/15 px-3 py-1 text-xs font-medium text-primary">
        Local / CI fixture evaluation — not a production SLA
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="card-asymmetric bg-white p-6 shadow-lift">
            <p className="text-xs tracking-[0.16em] text-muted">{metric.label}</p>
            <p className="mt-3 text-4xl font-bold tracking-tight text-primary">{metric.value}</p>
            <p className="mt-2 text-sm text-muted">{metric.hint}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 max-w-2xl text-sm text-muted">
        These numbers come from the versioned fixture dataset and a local subject-name parser. They are
        not Gemini quality and are not a live-model SLA. Live Intercom results are on Overview.
      </p>
    </div>
  );
}
