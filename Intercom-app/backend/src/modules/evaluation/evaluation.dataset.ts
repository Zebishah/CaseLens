import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type EvaluationCase = {
  id: string;
  body: string;
  subject: string;
  senderEmail: string;
  senderName: string;
  expectedEmployee: string | null;
  expectedStore: string | null;
  expectedCategory: string;
  expectedRelated: boolean;
  expectedUnrelated: boolean;
  expectedManualReview: boolean;
  ambiguous?: boolean;
  missingStore?: boolean;
};

export const EVALUATION_DATASET_VERSION = 'eval-v2';

const datasetCandidates = [
  path.resolve(process.cwd(), 'eval/dataset.v1.json'),
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../eval/dataset.v1.json')
];

export const loadEvaluationDataset = (): EvaluationCase[] => {
  const datasetPath = datasetCandidates.find((candidate) => existsSync(candidate));
  if (!datasetPath) {
    throw new Error('Evaluation dataset file was not found');
  }

  return JSON.parse(readFileSync(datasetPath, 'utf8')) as EvaluationCase[];
};
