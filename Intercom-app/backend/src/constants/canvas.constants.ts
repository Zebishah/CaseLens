export const CANVAS_COPY = {
  APP_TITLE: 'Case Lense',
  APP_CONNECTED: 'App is active and connected to your workspace.',
  APP_CONNECTED_DETAIL: 'Conversations are synced automatically. Intelligence appears when ready.',
  CASE_SUMMARY_HEADER: 'CASE SUMMARY',
  SYSTEM_STATE_HEADER: 'SYSTEM STATE',
  PROCESSING_READY: 'Ready',
  PROCESSING_QUEUED: 'Queued',
  PROCESSING_ACTIVE: 'Processing',
  PROCESSING_FAILED: 'Failed',
  WRITEBACK_NOT_REPORTED: 'Not reported',
  WRITEBACK_PENDING: 'Pending',
  WRITEBACK_SYNCED: 'Synced',
  WRITEBACK_FAILED: 'Needs retry',
  WRITEBACK_SKIPPED: 'Not enabled',
  CASE_CATEGORY_PREFIX: 'Case category',
  MENTIONED_IN_REPORT_PREFIX: 'Employees mentioned in report',
  EMPLOYEE_MATCH_HEADER: 'Employee Match',
  RELATED_CASES_HEADER: 'Related Cases',
  FUZZY_RELATED_CASES_HEADER: 'Possible related cases (spelling)',
  FUZZY_RELATED_CASES_DETAIL:
    'Similar name spelling in the subject — review before treating as the same employee.',
  CATEGORY_CASES_HEADER: 'Cases in this category',
  NO_EMPLOYEE_MATCH: 'No employee match found.',
  NO_EMPLOYEE_IDENTIFIED: 'No employee found in this conversation yet.',
  NO_EMPLOYEE_IDENTIFIED_STATUS:
    'Add the employee name in the subject, then click Re-analyze case.',
  UNRESOLVED_DIRECTORY_MATCH: 'This name is not in the employee directory yet.',
  REVIEW_REQUIRED: 'Please confirm this person in HR records before treating them as matched.',
  NO_EMPLOYEE_MATCH_HINT:
    'If you add or edit the employee name in the subject, click Re-analyze case to match them.',
  NO_RELATED_CASES: 'No other cases found for this employee yet.',
  NO_RELATED_CASES_NO_EMPLOYEE:
    'Related cases appear after we identify an employee. Add a name in the subject, then click Re-analyze case.',
  CLOSELY_RELATED_CASES_HEADER: 'Closely related cases',
  OTHER_EMPLOYEE_HISTORY_HEADER: 'Other cases for this employee',
  NO_CATEGORY_CASES: 'No other conversations found in this case category.',
  POSSIBLE_SAME_PERSON_HEADER: 'Possible same person',
  POSSIBLE_SAME_PERSON_DETAIL:
    'Similar name or email — confirm in HR records before treating as the same employee.',
  NOT_SYNCED: 'This conversation is still loading.',
  PROCESSING: 'Analyzing this case…',
  PROCESSING_DETAIL:
    'Intelligence is still processing. Refresh shortly to see the completed case review.',
  PROCESSING_REPORTER_PREFIX: 'Reporter',
  REFRESH_RESULTS: 'Refresh results',
  REANALYZE_CASE: 'Re-analyze case',
  REFRESH_HINT:
    'Refresh results loads the latest ready data. Re-analyze case re-runs matching after you edit the subject.',
  REANALYZE_HINT:
    'Use Re-analyze case when results look wrong or after you edit the subject.',
  SHOWING_LAST_ANALYZED: 'Showing the last ready results.',
  SUBJECT_EDIT_HINT:
    'If you edited the conversation subject or employee name, click Re-analyze case to update the results.',
  UPDATES_PENDING:
    'The subject changed. Click Re-analyze case to update the employee and related cases.',
  RESULTS_UPDATED: 'Results are up to date.',
  UPDATING_INTELLIGENCE: 'Updating this case…',
  REFRESH_STILL_UPDATING_HINT:
    'A newer conversation revision is being processed. Your previous result remains visible until the new result is ready.',
  PROCESSING_BACKGROUND:
    'Still working in the background. Click Refresh results in a few seconds. If nothing changes, close this conversation and open it again.',
  DOMAIN_SEARCH_BACKGROUND:
    'Searching company employees. Click Refresh results in a few seconds. If nothing changes, close this conversation and open it again.',
  DOMAIN_SEARCH_STARTED: 'Searching employees across the company.',
  DOMAIN_SEARCH_STALE_RESULTS:
    'The employee match below may update when this search finishes. Click Refresh results in a few seconds.',
  DOMAIN_SEARCH_REOPEN_HINT:
    'Click Refresh results in a few seconds. If nothing changes, close this conversation and open it again.',
  SCOPE_SEARCH_REOPEN_HINT:
    'Click Refresh results in a few seconds. If nothing changes, close this conversation and open it again.',
  SEARCH_BY_COMPANY_DOMAIN: 'Search by company domain',
  SEARCHING_COMPANY_DOMAIN: 'Searching employees across your company…',
  STORE_SEARCH_STARTED: 'Searching this store.',
  SEARCHING_CURRENT_STORE: 'Searching employees and related cases in this store…',
  STORE_SEARCH_STALE_RESULTS:
    'The results below may update when this search finishes. Click Refresh results in a few seconds.',
  FAILED: 'We could not finish analyzing this case.',
  FAILED_DETAIL:
    'The case remains available for manual review. Refresh results to try again.',
  FAILED_BUSY:
    'Analysis is busy right now. Wait a minute, then click Refresh results. If nothing changes, close this conversation and open it again.',
  INTERCOM_DISABLED:
    'This Intercom sidebar is turned off in this environment. Use the operations dashboard instead.',
  INTERCOM_SYNC_FAILED:
    'Results are ready here, but the Intercom note could not be saved. Retry from the dashboard or review the case manually.',
  MANUAL_REVIEW: 'Manual review recommended — AI assists; humans decide.',
  PROCESSING_VERSION_PREFIX: 'Processing version',
  LAST_UPDATED_PREFIX: 'Last updated',
  IDENTITY_EVIDENCE_PREFIX: 'Identity evidence',
  RELATED_LINK_EVIDENCE_PREFIX: 'Why this is related',
  EMPLOYEE_HISTORY_EVIDENCE_PREFIX: 'Why this appears',
  OPERATOR_CORRECTED: 'An operator confirmed these details. They stay until you Re-analyze case.',
  DB_UNAVAILABLE:
    'We could not load this case right now. Click Refresh results. If that does not help, close this conversation and open it again.',
  DISMISS_RELATED_CASE: '✕ Remove',
  DOMAIN_EMPLOYEE_MATCHES_HEADER: 'Company domain matches',
  DOMAIN_EMPLOYEE_MATCHES_DETAIL:
    'Similar employees found across the company domain — review HR records to confirm if they are the same person.',
  STORE_SEARCH_USE_DOMAIN_HINT: 'No employee match for this store yet.',
  CC_RECIPIENTS_HEADER: 'ROUTING',
  CC_RECIPIENTS_DETAIL: 'Store-aware stakeholder suggestions from the directory (display only).',
  /** No store on the ticket yet */
  CC_NO_STORE: 'No store number — enter a store number to load CC recipients.',
  CC_STORE_INPUT_LABEL: 'Store number',
  CC_STORE_INPUT_PLACEHOLDER: 'e.g. 78',
  CC_STORE_SUBMIT: 'Load CC recipients',
  CC_STORE_EDIT: 'Edit store number',
  CC_STORE_INPUT_HINT: 'Enter the store number to load CC recipients from the store directory.',
  CC_STORE_INPUT_REQUIRED: 'Enter a store number, then click Load CC recipients.',
  /** Store number looked up but not in the Box/Excel directory */
  CC_NOT_FOUND_PREFIX: 'No store found for number',
  CC_NOT_FOUND_HINT: 'Check the store number and try again.',
  CC_UNAVAILABLE: 'CC recipient directory is unavailable right now',
  /** Store exists in directory but has no CC contacts filled in */
  CC_EMPTY_FOR_STORE: 'No CC recipients found for this store.'
} as const;
