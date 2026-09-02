import { env } from '../../config/env.config.js';
import {
  EVALUATION_DATASET_VERSION,
  loadEvaluationDataset,
  type EvaluationCase
} from './evaluation.dataset.js';
import { parseReporterContext } from '../employee/employee.reporter-context.util.js';
import { extractEmployeeNamesFromSubject } from '../employee/employee.subject-name.util.js';
import { normalizeCaseTypeSlug } from '../conversation/case-type.util.js';

export type EvaluationCaseOutcome = {
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

export type EvaluationMetrics = {
  datasetVersion: string;
  datasetSize: number;
  promptVersion: string;
  modelVersion: string;
  usesLiveModel: boolean;
  method: 'subject-heuristic';
  fixtureDirectory: string[];
  classificationAccuracy: number;
  classificationHits: number;
  employeeMatchPrecision: number;
  employeeMatchRecall: number;
  employeeTruePositives: number;
  employeeFalsePositives: number;
  employeeFalseNegatives: number;
  employeeNameFalsePositiveRate: number;
  directoryResolutionPrecision: number;
  directoryResolutionRecall: number;
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
  processingDurationMsP50: number;
  evaluatedAt: string;
  cases: EvaluationCaseOutcome[];
};

const FIXTURE_DIRECTORY = new Set(['Jordan Hale', 'Riley Chen']);

const predict = (item: EvaluationCase) => {
  const names = extractEmployeeNamesFromSubject(item.subject);
  const reporter = parseReporterContext(item.senderName, item.senderEmail);
  const category = normalizeCaseTypeSlug(item.subject.split('—')[0] ?? item.subject);
  const predictedEmployee = names[0] ?? null;
  const directoryResolved =
    predictedEmployee && FIXTURE_DIRECTORY.has(predictedEmployee) ? predictedEmployee : null;
  const lowConfidence = !predictedEmployee || predictedEmployee.split(' ').length < 2;
  const unresolved = Boolean(predictedEmployee && !directoryResolved);
  return {
    employee: predictedEmployee,
    directoryEmployee: directoryResolved,
    store: reporter.storeNumber,
    category,
    related: Boolean(directoryResolved && directoryResolved === item.expectedEmployee),
    manualReview: lowConfidence || unresolved || !reporter.storeNumber || Boolean(item.ambiguous)
  };
};

export const runEvaluation = (): EvaluationMetrics => {
  const dataset = loadEvaluationDataset();
  let classificationHits = 0;
  let employeeTp = 0;
  let employeeFp = 0;
  let employeeFn = 0;
  let directoryTp = 0;
  let directoryFp = 0;
  let directoryFn = 0;
  let relatedTp = 0;
  let relatedFp = 0;
  let relatedFn = 0;
  let lowConfidence = 0;
  let manualReview = 0;
  const cases: EvaluationCaseOutcome[] = [];

  for (const item of dataset) {
    const predicted = predict(item);
    const categoryMatch = predicted.category === item.expectedCategory;
    const nameMatch = predicted.employee === item.expectedEmployee;
    if (categoryMatch) {
      classificationHits += 1;
    }

    if (item.expectedEmployee && predicted.employee === item.expectedEmployee) {
      employeeTp += 1;
    } else if (predicted.employee && predicted.employee !== item.expectedEmployee) {
      employeeFp += 1;
    } else if (item.expectedEmployee && predicted.employee !== item.expectedEmployee) {
      employeeFn += 1;
    }

    if (predicted.directoryEmployee && predicted.directoryEmployee === item.expectedEmployee) {
      directoryTp += 1;
    } else if (predicted.directoryEmployee) {
      directoryFp += 1;
    } else if (item.expectedEmployee && FIXTURE_DIRECTORY.has(item.expectedEmployee)) {
      directoryFn += 1;
    }

    if (item.expectedRelated && predicted.related) relatedTp += 1;
    else if (predicted.related && !item.expectedRelated) relatedFp += 1;
    else if (item.expectedRelated && !predicted.related) relatedFn += 1;

    if (!predicted.employee || predicted.employee.split(' ').length < 2) lowConfidence += 1;
    if (predicted.manualReview) manualReview += 1;

    cases.push({
      id: item.id,
      subject: item.subject,
      expectedEmployee: item.expectedEmployee,
      predictedEmployee: predicted.employee,
      expectedCategory: item.expectedCategory,
      predictedCategory: predicted.category,
      nameMatch,
      categoryMatch,
      inFixtureDirectory: Boolean(predicted.directoryEmployee),
      flaggedForReview: predicted.manualReview
    });
  }

  const precision = (tp: number, fp: number) => (tp + fp === 0 ? 0 : tp / (tp + fp));
  const recall = (tp: number, fn: number) => (tp + fn === 0 ? 0 : tp / (tp + fn));

  return {
    datasetVersion: EVALUATION_DATASET_VERSION,
    datasetSize: dataset.length,
    promptVersion: env.AI_PROMPT_VERSION,
    modelVersion: 'fixture-v1',
    usesLiveModel: false,
    method: 'subject-heuristic',
    fixtureDirectory: [...FIXTURE_DIRECTORY],
    classificationAccuracy: classificationHits / dataset.length,
    classificationHits,
    employeeMatchPrecision: precision(employeeTp, employeeFp),
    employeeMatchRecall: recall(employeeTp, employeeFn),
    employeeTruePositives: employeeTp,
    employeeFalsePositives: employeeFp,
    employeeFalseNegatives: employeeFn,
    employeeNameFalsePositiveRate:
      employeeTp + employeeFp === 0 ? 0 : employeeFp / (employeeTp + employeeFp),
    directoryResolutionPrecision: precision(directoryTp, directoryFp),
    directoryResolutionRecall: recall(directoryTp, directoryFn),
    directoryTruePositives: directoryTp,
    relatedCasePrecision: precision(relatedTp, relatedFp),
    relatedCaseRecall: recall(relatedTp, relatedFn),
    relatedTruePositives: relatedTp,
    relatedFalsePositives: relatedFp,
    relatedFalseNegatives: relatedFn,
    lowConfidenceRate: lowConfidence / dataset.length,
    lowConfidenceCount: lowConfidence,
    manualReviewRate: manualReview / dataset.length,
    manualReviewCount: manualReview,
    processingDurationMsP50: 0,
    evaluatedAt: new Date().toISOString(),
    cases
  };
};
