/** Real Intercom Developer Hub topic names (there is no generic conversation.created). */
export const INTERCOM_WEBHOOK_TOPICS = {
  /** Contact/email/user starts a conversation — primary topic for HR inbox. */
  CONVERSATION_USER_CREATED: 'conversation.user.created',
  /** Admin starts a 1:1 conversation. */
  CONVERSATION_ADMIN_SINGLE_CREATED: 'conversation.admin.single.created',
  /** Legacy alias used in tests/fixtures only — not in Intercom UI. */
  CONVERSATION_CREATED: 'conversation.created',
  /** Intercom "Send a test notification request" uses this topic. */
  PING: 'ping',
  CONVERSATION_USER_REPLIED: 'conversation.user.replied',
  CONVERSATION_ADMIN_REPLIED: 'conversation.admin.replied',
  /** Notes created by this app — do not subscribe; handling is ignored to avoid write-back loops. */
  CONVERSATION_ADMIN_NOTED: 'conversation.admin.noted'
} as const;

export const INTERCOM_CONVERSATION_REPLY_TOPICS = [
  INTERCOM_WEBHOOK_TOPICS.CONVERSATION_USER_REPLIED,
  INTERCOM_WEBHOOK_TOPICS.CONVERSATION_ADMIN_REPLIED
] as const;

export const isConversationReplyTopic = (topic: string): boolean =>
  (INTERCOM_CONVERSATION_REPLY_TOPICS as readonly string[]).includes(topic);

export const INTERCOM_CONVERSATION_CREATED_TOPICS = [
  INTERCOM_WEBHOOK_TOPICS.CONVERSATION_USER_CREATED,
  INTERCOM_WEBHOOK_TOPICS.CONVERSATION_ADMIN_SINGLE_CREATED,
  INTERCOM_WEBHOOK_TOPICS.CONVERSATION_CREATED
] as const;

export const isConversationCreatedTopic = (topic: string): boolean =>
  (INTERCOM_CONVERSATION_CREATED_TOPICS as readonly string[]).includes(topic);

export const INTERCOM_MATCH = {
  CONFIDENCE_THRESHOLD: 60,
  FUZZY_SIMILARITY_THRESHOLD: 0.6,
  POSSIBLE_MATCH_MIN_CONFIDENCE: 50,
  POSSIBLE_MATCH_MAX_CONFIDENCE: 85,
  /** Minimum confidence before an extracted spelling is saved as a learned alias. */
  ALIAS_LEARNING_MIN_CONFIDENCE: 75,
  TOKEN_MIN_LENGTH: 3,
  POSSIBLE_MATCH_LIMIT: 5
} as const;

export const INTERCOM_CASE_TYPES = {
  MISCONDUCT: 'misconduct',
  CONDUCT: 'conduct',
  ATTENDANCE: 'attendance',
  SCHEDULE: 'schedule',
  VACATION: 'vacation',
  LEAVE: 'leave',
  PAYROLL: 'payroll',
  BENEFITS: 'benefits',
  INJURY: 'injury',
  ACCOMMODATION: 'accommodation',
  TERMINATION: 'termination',
  ONBOARDING: 'onboarding',
  TRANSFER: 'transfer',
  COACHING: 'coaching',
  ESCALATION: 'escalation',
  POLICY: 'policy',
  GENERAL: 'general'
} as const;

export type IntercomCaseType = (typeof INTERCOM_CASE_TYPES)[keyof typeof INTERCOM_CASE_TYPES];

export const INTERCOM_CASE_TYPE_SLUGS = Object.values(INTERCOM_CASE_TYPES);

/** Subject-line keywords — fallback when Gemini/tags are unavailable. */
export const INTERCOM_CASE_TYPE_KEYWORDS: Record<IntercomCaseType, readonly string[]> = {
  [INTERCOM_CASE_TYPES.MISCONDUCT]: [
    'misconduct',
    'harassment',
    'harasses',
    'harass',
    'discipline',
    'theft',
    'steal',
    'violence',
    'assault',
    'discrimination',
    'weed',
    'marijuana',
    'drugs',
    'drug',
    'drug use',
    'using drugs',
    'using',
    'smoking weed',
    'intoxicated',
    'drunk at work',
    'under the influence'
  ],
  [INTERCOM_CASE_TYPES.CONDUCT]: ['conduct', 'ethics', 'compliance', 'integrity'],
  [INTERCOM_CASE_TYPES.ATTENDANCE]: [
    'attendance',
    'absenteeism',
    'tardy',
    'tardiness',
    'absence',
    'late',
    'absent',
    'no-show',
    'no show',
    'missed shift',
    'clock in',
    'clock-in'
  ],
  [INTERCOM_CASE_TYPES.SCHEDULE]: [
    'schedule',
    'shift swap',
    'shift swaps',
    'availability',
    'scheduling'
  ],
  [INTERCOM_CASE_TYPES.VACATION]: ['vacation', 'pto', 'time off', 'holiday'],
  [INTERCOM_CASE_TYPES.LEAVE]: ['leave', 'fmla', 'medical leave', 'bereavement'],
  [INTERCOM_CASE_TYPES.PAYROLL]: ['payroll', 'paycheck', 'wage', 'overtime', 'salary'],
  [INTERCOM_CASE_TYPES.BENEFITS]: ['benefits', 'insurance', '401k', 'health plan'],
  [INTERCOM_CASE_TYPES.INJURY]: [
    'injury',
    'workers_comp',
    'workers comp',
    'workers compensation',
    'workplace injury',
    'work injury'
  ],
  [INTERCOM_CASE_TYPES.ACCOMMODATION]: [
    'accommodation',
    'ada',
    'disability',
    'reasonable accommodation'
  ],
  [INTERCOM_CASE_TYPES.TERMINATION]: ['termination', 'separation', 'resignation', 'exit'],
  [INTERCOM_CASE_TYPES.ONBOARDING]: ['onboarding', 'new hire', 'orientation'],
  [INTERCOM_CASE_TYPES.TRANSFER]: [
    'transfer',
    'store transfer',
    'role change',
    'role move',
    'store move'
  ],
  [INTERCOM_CASE_TYPES.COACHING]: [
    'coaching',
    'productivity',
    'performance concern',
    'performance concerns',
    'performance plan',
    'performance improvement',
    'work quality',
    'pip',
    'pip plan'
  ],
  [INTERCOM_CASE_TYPES.ESCALATION]: ['escalation', 'escalate', 'urgent'],
  [INTERCOM_CASE_TYPES.POLICY]: ['policy', 'handbook', 'company policy', 'policy question'],
  [INTERCOM_CASE_TYPES.GENERAL]: []
} as const;

export const INTERCOM_API = {
  BASE_URL: 'https://api.intercom.io',
  API_VERSION: '2.11',
  REQUEST_TIMEOUT_MS: 15_000
} as const;

export const INTERCOM_SYNC_STATUS = {
  SKIPPED: 'skipped',
  PENDING: 'pending',
  SYNCED: 'synced',
  FAILED: 'failed'
} as const;

export type IntercomSyncStatus = (typeof INTERCOM_SYNC_STATUS)[keyof typeof INTERCOM_SYNC_STATUS];

export const INTERCOM_WRITEBACK_TAGS = {
  PROCESSED: 'hr-intelligence-processed',
  MANUAL_REVIEW: 'manual-review',
  EMPLOYEE_MATCHED: 'employee-matched',
  RELATED_CASES_FOUND: 'related-cases-found'
} as const;

export const INTERCOM_HEADERS = {
  WEBHOOK_SIGNATURE: 'x-hub-signature',
  CANVAS_SIGNATURE: 'x-body-signature',
  API_VERSION: 'Intercom-Version'
} as const;
