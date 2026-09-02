const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

/** Resolve advisor display name from stored Intercom payload when available. */
export const extractAdvisorNameFromPayload = (
  rawPayload: Record<string, unknown> | null | undefined
): string | null => {
  if (!rawPayload) {
    return null;
  }

  const assignedAdmin = asRecord(rawPayload.assigned_admin);
  const assignee = asRecord(rawPayload.assignee);
  const teammates = rawPayload.teammates;
  const firstTeammate = Array.isArray(teammates) ? asRecord(teammates[0]) : undefined;

  return (
    asString(assignedAdmin?.name) ??
    asString(assignee?.name) ??
    asString(firstTeammate?.name) ??
    null
  );
};
