import { describe, expect, it } from '@jest/globals';
import {
  canvasWorkspaceMatches,
  webhookWorkspaceMatches
} from '../../../src/modules/intercom/intercom.workspace.util.js';

describe('intercom.workspace.util', () => {
  it('accepts a matching webhook app_id', () => {
    expect(webhookWorkspaceMatches('test-workspace-id', 'test-workspace-id')).toBe(true);
  });

  it('rejects a mismatched webhook app_id when both sides are present', () => {
    expect(webhookWorkspaceMatches('other-app', 'test-workspace-id')).toBe(false);
  });

  it('skips comparison when the payload omits app_id', () => {
    expect(webhookWorkspaceMatches(null, 'test-workspace-id')).toBe(true);
    expect(webhookWorkspaceMatches(undefined, 'test-workspace-id')).toBe(true);
  });

  it('matches canvas workspace_id the same way', () => {
    expect(canvasWorkspaceMatches('test-workspace-id', 'test-workspace-id')).toBe(true);
    expect(canvasWorkspaceMatches('yiaixmn1', 'test-workspace-id')).toBe(false);
  });
});
