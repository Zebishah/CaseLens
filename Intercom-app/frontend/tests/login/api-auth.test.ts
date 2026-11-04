import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from '../../lib/api';
import { getAdminToken, setAdminToken } from '../../lib/auth-token';

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { vi.restoreAllMocks(); });

describe('authentication API client', () => {
  it('preserves the verification error code from the backend', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: false, message: 'Verify your email', details: { code: 'EMAIL_VERIFICATION_REQUIRED' }
    }), { status: 403 }));
    await expect(api.login('admin@example.com', 'password-123')).rejects.toMatchObject({
      status: 403, code: 'EMAIL_VERIFICATION_REQUIRED'
    });
    expect(getAdminToken()).toBeNull();
  });

  it('shows account email delivery failures as provider errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: false, message: 'Email delivery is temporarily unavailable.'
    }), { status: 503 }));
    await expect(api.resendVerification('admin@example.com', 'password-123')).rejects.toMatchObject({
      status: 503, sleeping: false, message: 'Email delivery is temporarily unavailable.'
    });
  });

  it('clears the local administrator session only after a successful password change', async () => {
    setAdminToken('existing-access-token', { role: 'admin' });
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      success: false, message: 'The current password is incorrect'
    }), { status: 400 }));
    await expect(api.changePassword('wrong', 'replacement-password-123')).rejects.toBeInstanceOf(ApiError);
    expect(getAdminToken()).toBe('existing-access-token');
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { changed: true } }), { status: 200 }));
    await api.changePassword('correct', 'replacement-password-123');
    expect(getAdminToken()).toBeNull();
    expect(fetch.mock.calls[1]?.[0]).toEqual(expect.stringContaining('/api/auth/change-password'));
    const init = fetch.mock.calls[1]?.[1] as RequestInit;
    expect(init.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer existing-access-token' }));
    expect(JSON.parse(init.body as string)).toEqual({ currentPassword: 'correct', newPassword: 'replacement-password-123' });
  });
});
