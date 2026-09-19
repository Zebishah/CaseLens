import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CasesPage from '../../app/cases/page';
import CaseDetailPage from '../../app/cases/[id]/page';

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock('next/link', () => ({ default: ({ href, children, ...props }: React.ComponentProps<'a'>) => <a href={href} {...props}>{children}</a> }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: '42' }) }));
vi.mock('../../components/AppShell', () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('../../lib/api', () => ({ api: { get: apiGet, post: vi.fn() } }));
vi.mock('../../lib/auth-token', () => ({
  AUTH_STATE_EVENT: 'auth-state',
  getAdminToken: () => 'synthetic-access-token',
  getAdminUser: () => ({ id: 1, email: 'reviewer@example.com', name: 'Reviewer', role: 'viewer' })
}));

describe('case views', () => {
  beforeEach(() => apiGet.mockReset());

  it('renders a persisted case row with a link to its details', async () => {
    apiGet.mockResolvedValueOnce({
      items: [{
        id: 42,
        source: 'demo',
        subject: 'Leave request review',
        status: 'ready',
        category: 'leave',
        employee: 'Ayesha Sophie',
        storeNumber: null,
        relatedCaseCount: 2,
        confidence: 91,
        receivedAt: '2026-09-01T10:00:00.000Z',
        mentionStatus: 'resolved'
      }],
      total: 1
    });

    render(<CasesPage />);

    const caseLink = await screen.findByRole('link', { name: /Leave request review/ });
    expect(caseLink).toHaveAttribute('href', '/cases/42');
    expect(screen.getByText('Ayesha Sophie')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('announces that case results are loading while the request is pending', () => {
    apiGet.mockReturnValueOnce(new Promise(() => undefined));
    render(<CasesPage />);
    expect(screen.getByLabelText('Loading page')).toHaveAttribute('aria-busy', 'true');
  });

  it('shows a recoverable error when the case list request fails', async () => {
    apiGet.mockRejectedValueOnce(new Error('Temporary service error'));
    render(<CasesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load cases');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('renders the persisted case details and keeps reviewer output read-only', async () => {
    apiGet.mockResolvedValueOnce({
      case: { intercomSyncStatus: 'synced', openInIntercomUrl: null },
      conversation: { subject: 'Leave request review', source: 'demo', senderName: 'Reporter', sender: 'reporter@example.test', body: 'Synthetic case body.' },
      snapshot: {
        caseType: 'leave',
        processingMode: 'fixture',
        requiresManualReview: false,
        employeeMatches: [{ canonicalName: 'Ayesha Sophie', confidenceScore: 91, matchMethod: 'alias' }],
        relatedCases: [],
        ccRecipients: { recipients: [] }
      },
      timeline: { createdAt: '2026-09-01T10:00:00.000Z', processedAt: '2026-09-01T10:01:00.000Z' }
    });

    render(<CaseDetailPage />);

    expect(await screen.findByText('Synthetic case body.')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Leave request review' })).toHaveLength(2);
    expect(screen.getAllByText('Ayesha Sophie')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Save feedback' })).not.toBeInTheDocument();
  });
});
