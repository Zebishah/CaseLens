export const INTELLIGENCE_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed'
} as const;

export type IntelligenceStatus = (typeof INTELLIGENCE_STATUS)[keyof typeof INTELLIGENCE_STATUS];

export const EMPLOYEE_MATCH_METHOD = {
  EXACT: 'exact',
  FUZZY: 'fuzzy',
  ALIAS: 'alias',
  TOKEN: 'token',
  MANUAL: 'manual'
} as const;

export type EmployeeMatchMethod =
  (typeof EMPLOYEE_MATCH_METHOD)[keyof typeof EMPLOYEE_MATCH_METHOD];

/** Related and category case lists only include conversations newer than this window. */
export const RELATED_CASE_MAX_AGE_MONTHS = 6;

/** Maximum cases shown per related/category sidebar section. */
export const RELATED_CASE_LIST_LIMIT = 20;

/** Maximum typo-tolerant related cases shown below exact related cases. */
export const FUZZY_RELATED_CASE_LIST_LIMIT = 10;

/** Candidate pool size when scanning for typo-tolerant related cases. */
export const FUZZY_RELATED_CASE_SCAN_LIMIT = 60;

/** Customer/contact messages stored for AI extraction / matching. */
export const CONVERSATION_MESSAGE_SAVE_LIMIT = 20;
