import { intercomConfig } from '../../config/intercom.config.js';

export const normalizeIntercomWorkspaceId = (value: string | number | null | undefined): string =>
  String(value ?? '').trim();

/** When the payload includes an app/workspace id, it must match the configured developer workspace. */
export const webhookWorkspaceMatches = (
  payloadAppId: string | number | null | undefined,
  configuredWorkspaceId: string = intercomConfig.workspaceId
): boolean => {
  const provided = normalizeIntercomWorkspaceId(payloadAppId);
  const expected = normalizeIntercomWorkspaceId(configuredWorkspaceId);
  if (!provided || !expected) {
    return true;
  }
  return provided === expected;
};

export const canvasWorkspaceMatches = (
  payloadWorkspaceId: string | number | null | undefined,
  configuredWorkspaceId: string = intercomConfig.workspaceId
): boolean => webhookWorkspaceMatches(payloadWorkspaceId, configuredWorkspaceId);
