import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../../components/AppShell';

const { state, replace, restoreSession } = vi.hoisted(() => ({
  state: { path: '/overview', role: 'admin', demo: false }, replace: vi.fn(), restoreSession: vi.fn()
}));
const router = { replace };
vi.mock('next/navigation', () => ({ usePathname: () => state.path, useRouter: () => router }));
vi.mock('next/link', () => ({ default: ({ href, children, ...props }: React.ComponentProps<'a'>) => <a href={href} {...props}>{children}</a> }));
vi.mock('../../lib/api', () => ({ api: { restoreSession }, ApiError: class extends Error {} }));
vi.mock('../../lib/auth-token', () => ({ AUTH_STATE_EVENT: 'auth', getAdminUser: () => ({ role: state.role }), isDemoRecruiter: () => state.demo }));

beforeEach(() => {
  state.path = '/overview'; state.role = 'admin'; state.demo = false; replace.mockReset();
  restoreSession.mockImplementation(async () => ({ user: { role: state.role, name: 'Test administrator' } }));
});

describe('security page authorization in the dashboard', () => {
  it('shows Account security to administrators', async () => {
    render(<AppShell title="Dashboard">Dashboard content</AppShell>);
    expect(await screen.findByRole('link', { name: /Account security/ })).toHaveAttribute('href', '/settings/security');
  });
  it.each(['viewer', 'user', 'demo'])('hides the password tool from %s accounts', async (role) => {
    state.role = role === 'demo' ? 'viewer' : role;
    state.demo = role === 'demo';
    render(<AppShell title="Dashboard">Dashboard content</AppShell>);
    await screen.findByText('Dashboard content');
    expect(screen.queryByRole('link', { name: /Account security/ })).not.toBeInTheDocument();
  });
  it('blocks direct navigation to security for a reviewer', async () => {
    state.path = '/settings/security'; state.role = 'viewer';
    render(<AppShell title="Security">Private form</AppShell>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/overview'));
    expect(screen.queryByText('Private form')).not.toBeInTheDocument();
  });
});
