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

export const intercomSyncMarker = (fingerprint: string): string => `HR Intelligence · sync:${fingerprint.slice(0, 12)}`;

export const buildIntercomWritebackTags = (snapshot: IntelligenceSnapshot): string[] => {
  const tags: string[] = [INTERCOM_WRITEBACK_TAGS.PROCESSED];
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
      employeeLine: `Employee mentioned: ${snapshot.unresolvedEmployeeMention ?? 'Unknown'}`,
      confidenceLine: 'Confidence: —',
      extraLines: ['Status: Not matched to directory']
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
    `<p><strong>HR Intelligence</strong><br/>${marker}</p>`,
    `<p>${employeeBlock.employeeLine}<br/>`,
    employeeBlock.confidenceLine,
    employeeBlock.extraLines.length > 0 ? `<br/>${employeeBlock.extraLines.join('<br/>')}` : '',
    `<br/>Store: ${conversation.reporterStoreNumber ?? '—'}<br/>`,
    `Category: ${snapshot.caseType ? formatCaseTypeLabel(snapshot.caseType) : '—'}<br/>`,
    `Related cases: ${relatedCaseCount}<br/>`,
    `Stakeholders: ${stakeholders.length > 0 ? stakeholders.join(', ') : '—'}<br/>`,
    `Review: ${snapshot.requiresManualReview ? 'Required' : 'Not required'}</p>`
  ].join('');

  return { body, fingerprint, marker, tags };
};
