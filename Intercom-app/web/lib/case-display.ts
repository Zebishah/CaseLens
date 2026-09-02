export const formatCategoryLabel = (caseType: string | null | undefined): string => {
  const normalized = caseType?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return 'General';
  }
  const slug = normalized === 'misconduct' ? 'conduct' : normalized;
  return slug
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export const formatMentionStatus = (status: string | null | undefined): string => {
  switch (status) {
    case 'resolved':
      return 'Matched';
    case 'unresolved':
      return 'Unmatched mention';
    case 'ambiguous':
      return 'Needs review';
    case 'no_employee_mentioned':
      return 'No employee';
    default:
      return 'Not processed';
  }
};

export const formatRelativeTime = (value: string | Date | null | undefined): string => {
  if (!value) {
    return '—';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  const deltaMs = Date.now() - date.getTime();
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 1) {
    return 'Just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};
