export type SampleScenarioId =
  | 'confident-employee'
  | 'store-from-email'
  | 'related-history'
  | 'unrelated-rejected'
  | 'ambiguous-employee'
  | 'missing-store'
  | 'store-stakeholders'
  | 'multiple-cc'
  | 'low-confidence-review';

export type SampleScenario = {
  id: SampleScenarioId;
  title: string;
  summary: string;
  senderEmail: string;
  senderName: string;
  recipients: string[];
  subject: string;
  body: string;
};

export const SAMPLE_SCENARIOS: SampleScenario[] = [
  {
    id: 'confident-employee',
    title: 'Employee identity found confidently',
    summary: 'Subject names Jordan Hale and matching directory data produce a high-confidence employee match.',
    senderEmail: '1042@northwind.co',
    senderName: 'Store 1042 Manager',
    recipients: ['hr@northwind.co'],
    subject: 'Attendance — Jordan Hale',
    body: 'Jordan Hale has been late three times this week at store 1042. Please advise on next steps for the attendance policy.'
  },
  {
    id: 'store-from-email',
    title: 'Store number extracted from sender email',
    summary: 'The sender local-part 1042@northwind.co is parsed as the store number.',
    senderEmail: '1042@northwind.co',
    senderName: 'Northwind Bakery',
    recipients: ['hr@northwind.co'],
    subject: 'Schedule change — Jordan Hale',
    body: 'Please update Jordan Hale availability starting Monday. The store inbox is sending this request.'
  },
  {
    id: 'related-history',
    title: 'Related historical conversations found',
    summary: 'A second case about the same employee should surface prior related cases.',
    senderEmail: '1042@northwind.co',
    senderName: 'Store 1042 Manager',
    recipients: ['hr@northwind.co'],
    subject: 'Write-up follow-up — Jordan Hale',
    body: 'Following last week’s attendance discussion, Jordan Hale now needs a documented coaching conversation.'
  },
  {
    id: 'unrelated-rejected',
    title: 'Unrelated conversations rejected',
    summary: 'A case about a different employee should not inherit unrelated history.',
    senderEmail: '1042@northwind.co',
    senderName: 'Store 1042 Manager',
    recipients: ['hr@northwind.co'],
    subject: 'Uniform allowance — Riley Chen',
    body: 'Riley Chen requested a replacement jacket. This is unrelated to attendance cases for other employees.'
  },
  {
    id: 'ambiguous-employee',
    title: 'Ambiguous employee match',
    summary: 'A short first name can produce more than one plausible match and should flag review.',
    senderEmail: '1042@northwind.co',
    senderName: 'Store 1042 Manager',
    recipients: ['hr@northwind.co'],
    subject: 'Coaching — Jordan',
    body: 'Jordan on the morning crew needs coaching. The last name was not provided.'
  },
  {
    id: 'missing-store',
    title: 'Missing store information',
    summary: 'A personal email without a store local-part should show missing store context.',
    senderEmail: 'alex.rivera@gmail.com',
    senderName: 'Alex Rivera',
    recipients: ['hr@northwind.co'],
    subject: 'Benefits question — Jordan Hale',
    body: 'Can someone confirm whether Jordan Hale is eligible for the updated benefits packet?'
  },
  {
    id: 'store-stakeholders',
    title: 'Store-specific stakeholder recommendation',
    summary: 'Store 1042 should recommend Northwind Bakery operations stakeholders.',
    senderEmail: '1042@northwind.co',
    senderName: 'Store 1042 Manager',
    recipients: ['hr@northwind.co'],
    subject: 'Safety incident — Jordan Hale',
    body: 'Jordan Hale reported a minor safety incident at store 1042. Please include the usual store operations partners.'
  },
  {
    id: 'multiple-cc',
    title: 'Multiple CC-recipient recommendations',
    summary: 'Helix Hospitality store 2218 includes fixed HR contacts plus the district manager.',
    senderEmail: '2218@helix.co',
    senderName: 'Helix Store 2218',
    recipients: ['hr@helix.co'],
    subject: 'Leave request — Morgan Blake',
    body: 'Morgan Blake submitted a leave request for store 2218. Please CC the standard Helix HR group.'
  },
  {
    id: 'low-confidence-review',
    title: 'Low-confidence manual review',
    summary: 'A misspelled uncommon name should remain in manual review rather than auto-linking.',
    senderEmail: '1042@northwind.co',
    senderName: 'Store 1042 Manager',
    recipients: ['hr@northwind.co'],
    subject: 'Complaint — Joradn Hail',
    body: 'We received a complaint naming Joradn Hail. The spelling may be wrong and needs a reviewer.'
  }
];

export const getSampleScenario = (id: string): SampleScenario | undefined =>
  SAMPLE_SCENARIOS.find((scenario) => scenario.id === id);
