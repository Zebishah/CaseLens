import { createHash } from 'node:crypto';
import { INTERCOM_WRITEBACK_TAGS } from '../../constants/intercom.constants.js';
import { formatCaseTypeLabel } from '../conversation/case-type.util.js';
import type { IntelligenceSnapshot } from '../../types/intelligence.types.js';
import type { ConversationRecord } from '../conversation/conversation.repository.js';

const confidenceLabel = (score: number | null | undefined): string => {
  if (score == null) {
    return 'Unknown';
  }
  if (score >= 85) {
    return 'High';
  }
  if (score >= 60) {
    return 'Medium';
  }
  return 'Low';
};

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/** Hidden idempotency marker; keeping it out of visible note copy avoids operator noise. */
export const intercomSyncMarker = (fingerprint: string): string => `<!-- hr-intelligence-sync:${fingerprint.slice(0, 12)} -->`;

export const buildIntercomWritebackTags = (snapshot: IntelligenceSnapshot): string[] => {
  const tags: string[] = [INTERCOM_WRITEBACK_TAGS.PROCESSED];
  if (snapshot.employeeMatches.length > 0 && !snapshot.requiresManualReview) {
    tags.push(INTERCOM_WRITEBACK_TAGS.EMPLOYEE_MATCHED);
  }
  if (snapshot.relatedCases.length > 0 || (snapshot.fuzzyRelatedCases?.length ?? 0) > 0) {
    tags.push(INTERCOM_WRITEBACK_TAGS.RELATED_CASES_FOUND);
  }
  if (snapshot.requiresManualReview) {
    tags.push(INTERCOM_WRITEBACK_TAGS.MANUAL_REVIEW);
  }
  const category = snapshot.caseType?.trim().toLowerCase();
  if (category) {
    tags.push(`category-${category.replace(/[^a-z0-9-]+/g, '-')}`);
  }
  return tags;
};

const formatNoteEmployeeBlock = (
  snapshot: IntelligenceSnapshot
): { employeeLine: string; confidenceLine: string; extraLines: string[] } => {
  const mentionStatus = snapshot.employeeMentionStatus;
  const employee = snapshot.employeeMatches[0];

  if (
    mentionStatus === 'unresolved' ||
    mentionStatus === 'ambiguous' ||
    (mentionStatus !== 'resolved' && Boolean(snapshot.unresolvedEmployeeMention))
  ) {
    return {
      employeeLine: `Employee: ${snapshot.unresolvedEmployeeMention ?? 'Unknown'}`,
      confidenceLine: 'Confidence: —',
      extraLines: ['Status: Mentioned, not matched to directory']
    };
  }

  if (!employee || mentionStatus === 'no_employee_mentioned') {
    return {
      employeeLine: 'Employee: No employee identified',
      confidenceLine: 'Confidence: —',
      extraLines: ['Status: No explicit employee name in subject']
    };
  }

  return {
    employeeLine: `Employee: ${employee.canonicalName}`,
    confidenceLine: `Confidence: ${confidenceLabel(employee.confidenceScore)}${
      employee.confidenceScore != null ? ` (${employee.confidenceScore}%)` : ''
    }`,
    extraLines: []
  };
};

export const buildIntercomIntelligenceNote = (
  conversation: Pick<ConversationRecord, 'reporterStoreNumber' | 'companyName'>,
  snapshot: IntelligenceSnapshot
): { body: string; fingerprint: string; marker: string; tags: string[] } => {
  const employee = snapshot.employeeMatches[0];
  const employeeBlock = formatNoteEmployeeBlock(snapshot);
  const stakeholders = (snapshot.ccRecipients?.recipients ?? [])
    .slice(0, 4)
    .map((recipient) => recipient.name)
    .filter(Boolean);
  const tags = buildIntercomWritebackTags(snapshot);
  const relatedCaseCount =
    snapshot.relatedCases.length + (snapshot.fuzzyRelatedCases?.length ?? 0);
  const fingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        employee: employee?.canonicalName ?? snapshot.unresolvedEmployeeMention ?? null,
        mentionStatus: snapshot.employeeMentionStatus ?? null,
        confidence: employee?.confidenceScore ?? null,
        store: conversation.reporterStoreNumber ?? null,
        category: snapshot.caseType ?? null,
        related: relatedCaseCount,
        stakeholders,
        review: Boolean(snapshot.requiresManualReview),
        version: snapshot.intelligenceVersion ?? null
      })
    )
    .digest('hex');
  const marker = intercomSyncMarker(fingerprint);

  const body = [
    '<p><strong>Case Lense Summary</strong></p>',
    '<p>',
    `${escapeHtml(employeeBlock.employeeLine)}<br/>`,
    `${escapeHtml(employeeBlock.confidenceLine)}<br/>`,
    `Company: ${escapeHtml(conversation.companyName ?? '—')}<br/>`,
    `Store: ${escapeHtml(conversation.reporterStoreNumber ?? '—')}<br/>`,
    `Category: ${escapeHtml(snapshot.caseType ? formatCaseTypeLabel(snapshot.caseType) : '—')}<br/>`,
    `Related cases: ${relatedCaseCount}<br/>`,
    `Stakeholder: ${escapeHtml(stakeholders.length > 0 ? stakeholders.join(', ') : '—')}<br/>`,
    `Review required: ${snapshot.requiresManualReview ? 'Yes' : 'No'}`,
    employeeBlock.extraLines.length > 0 ? `<br/>${employeeBlock.extraLines.map(escapeHtml).join('<br/>')}` : '',
    '</p>',
    `<p><strong>Why:</strong> ${escapeHtml(
      employee
        ? `Identity resolved with ${employee.matchMethod} directory evidence at ${employee.confidenceScore}% confidence.`
        : 'No confirmed employee identity was available.'
    )} ${relatedCaseCount > 0 ? 'Related history was found within the configured lookback.' : 'No related case was found.'} ${
      stakeholders.length > 0 ? 'Stakeholder suggestions came from store/company directory mapping.' : 'No stakeholder match was available.'
    } AI assists; humans decide.</p>`,
    marker
  ].join('');

  return { body, fingerprint, marker, tags };
};
