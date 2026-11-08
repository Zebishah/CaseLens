import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '../../app/login/page';

const { apiMocks, routerReplace } = vi.hoisted(() => ({
  apiMocks: {
    restoreSession: vi.fn(),
    enterDemo: vi.fn(),
    login: vi.fn(),
    resendVerification: vi.fn()
  },
  routerReplace: vi.fn()
}));

vi.mock('next/link', () => ({ default: ({ href, children, ...props }: React.ComponentProps<'a'>) => <a href={href} {...props}>{children}</a> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: routerReplace }) }));
vi.mock('../../lib/api', () => {
  class ApiError extends Error {
    constructor(message: string, readonly status: number, readonly sleeping = false, readonly code?: string) {
      super(message);
    }
  }
  return { api: apiMocks, ApiError };
});

describe('login and recruiter access', () => {
  beforeEach(() => {
    apiMocks.restoreSession.mockResolvedValue(null);
    apiMocks.enterDemo.mockResolvedValue({ token: 'synthetic-session' });
    apiMocks.login.mockResolvedValue({ token: 'access-token' });
    apiMocks.resendVerification.mockResolvedValue({ message: 'Check your inbox for a verification link.' });
    routerReplace.mockReset();
    window.history.replaceState({}, '', '/login');
  });

  it('lets a recruiter enter the read-only demo through the API', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const enterDemo = await screen.findByRole('button', { name: 'Enter read-only demo' });
    await user.click(enterDemo);

    await waitFor(() => expect(apiMocks.enterDemo).toHaveBeenCalledOnce());
    expect(routerReplace).toHaveBeenCalledWith('/overview');
  });

  it('shows an accessible unauthorized message after an invalid login', async () => {
    const user = userEvent.setup();
    apiMocks.login.mockRejectedValueOnce(new (await import('../../lib/api')).ApiError('Invalid credentials', 401));
    render(<LoginPage />);

    await user.type(await screen.findByLabelText('Email address'), 'reviewer@example.com');
    await user.type(screen.getByLabelText('Password'), 'incorrect-password');
    await user.click(screen.getByRole('button', { name: 'Sign in to workspace' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The email or password is incorrect.');
    expect(routerReplace).not.toHaveBeenCalled();
  });

  it('exposes the password visibility toggle as a pressed-state control', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const password = await screen.findByLabelText('Password');
    const toggle = screen.getByRole('button', { name: 'Show' });
    expect(password).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('offers verification after a correct-password login requires it, and resends with a cooldown', async () => {
    const user = userEvent.setup();
    apiMocks.login.mockRejectedValueOnce(new (await import('../../lib/api')).ApiError(
      'Verify your email', 403, false, 'EMAIL_VERIFICATION_REQUIRED'
    ));
    render(<LoginPage />);
    await user.type(await screen.findByLabelText('Email address'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password-123');
    await user.click(screen.getByRole('button', { name: 'Sign in to workspace' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('needs verification');
    await user.click(screen.getByRole('button', { name: 'Send verification code' }));
    expect(apiMocks.resendVerification).toHaveBeenCalledWith('admin@example.com', 'correct-password-123');
    expect(await screen.findByRole('status')).toHaveTextContent('Check your inbox');
    expect(screen.getByRole('button', { name: 'Resend available in one minute' })).toBeDisabled();
    expect(routerReplace).not.toHaveBeenCalled();
  });

});
