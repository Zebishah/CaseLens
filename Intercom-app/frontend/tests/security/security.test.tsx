import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import SecuritySettingsPage from '../../app/settings/security/page';
import VerifyEmailPage from '../../app/verify-email/page';

const { apiMocks, replace } = vi.hoisted(() => ({ apiMocks: { changePassword: vi.fn(), verifyEmail: vi.fn() }, replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: React.ComponentProps<'a'>) => <a href={href} {...props}>{children}</a> }));
vi.mock('../../components/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('../../components/AuthShell', () => ({ AuthShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('../../lib/api', () => ({ api: apiMocks }));

beforeEach(() => {
  vi.clearAllMocks();
  apiMocks.changePassword.mockResolvedValue(undefined);
  apiMocks.verifyEmail.mockResolvedValue({ verified: true });
  window.history.replaceState({}, '', '/settings/security');
});

describe('administrator password form', () => {
  it('rejects mismatched passwords before calling the API', async () => {
    const user = userEvent.setup();
    render(<SecuritySettingsPage />);
    await user.type(screen.getByLabelText('Current password'), 'current-password-123');
    await user.type(screen.getByLabelText(/New password/), 'replacement-password-123');
    await user.type(screen.getByLabelText('Confirm new password'), 'different-password-456');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match');
    expect(apiMocks.changePassword).not.toHaveBeenCalled();
  });

  it('saves matching passwords and sends the administrator back to sign in', async () => {
    const user = userEvent.setup();
    render(<SecuritySettingsPage />);
    await user.type(screen.getByLabelText('Current password'), 'current-password-123');
    await user.type(screen.getByLabelText(/New password/), 'replacement-password-123');
    await user.type(screen.getByLabelText('Confirm new password'), 'replacement-password-123');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() => expect(apiMocks.changePassword).toHaveBeenCalledWith('current-password-123', 'replacement-password-123'));
    expect(replace).toHaveBeenCalledWith('/login?reason=password-changed');
  });
});

describe('email confirmation page', () => {
  it('requires explicit confirmation and works with Strict Mode effect replay', async () => {
    const user = userEvent.setup();
    const token = 'a'.repeat(64);
    window.history.replaceState({}, '', `/verify-email?token=${token}`);
    render(<StrictMode><VerifyEmailPage /></StrictMode>);
    expect(window.location.search).toBe('');
    expect(apiMocks.verifyEmail).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Verify email address' }));
    expect(apiMocks.verifyEmail).toHaveBeenCalledOnce();
    expect(apiMocks.verifyEmail).toHaveBeenCalledWith(token);
    expect(await screen.findByRole('heading', { name: 'Email verified.' })).toBeInTheDocument();
  });

  it('explains expired links and leaves a path to request another', async () => {
    const user = userEvent.setup();
    apiMocks.verifyEmail.mockRejectedValueOnce(new Error('This verification link is invalid or expired.'));
    window.history.replaceState({}, '', `/verify-email?token=${'a'.repeat(64)}`);
    render(<VerifyEmailPage />);
    await user.click(screen.getByRole('button', { name: 'Verify email address' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('expired');
    expect(screen.getByRole('link', { name: 'Return to sign in' })).toHaveAttribute('href', '/login');
  });
});
