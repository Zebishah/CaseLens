import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const mockFindPendingByEmail = jest.fn();
const mockCreate = jest.fn();
const mockList = jest.fn();
const mockUpdateStatus = jest.fn();
const mockFindLatestByEmail = jest.fn();

await jest.unstable_mockModule(
  '../../../src/modules/access-request/access-request.repository.js',
  () => ({
    accessRequestRepository: {
      findPendingByEmail: mockFindPendingByEmail,
      create: mockCreate,
      list: mockList,
      updateStatus: mockUpdateStatus,
      findLatestByEmail: mockFindLatestByEmail
    }
  })
);

const { accessRequestService } = await import(
  '../../../src/modules/access-request/access-request.service.js'
);

describe('accessRequestService', () => {
  beforeEach(() => {
    mockFindPendingByEmail.mockReset();
    mockCreate.mockReset();
    mockList.mockReset();
    mockUpdateStatus.mockReset();
    mockFindLatestByEmail.mockReset();
  });

  test('normalizes and stores a new request', async () => {
    mockFindPendingByEmail.mockResolvedValue(undefined);
    mockCreate.mockResolvedValue({ id: 1 });

    await expect(
      accessRequestService.submit({
        fullName: '  Amina   Khan ',
        workEmail: ' AMINA@EXAMPLE.COM ',
        organization: ' Example   Labs ',
        role: ' Technical Recruiter ',
        purpose: ' I am reviewing this engineering portfolio. '
      })
    ).resolves.toEqual({ received: true });

    expect(mockFindPendingByEmail).toHaveBeenCalledWith('amina@example.com');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'Amina Khan',
        workEmail: 'amina@example.com',
        organization: 'Example Labs',
        role: 'Technical Recruiter',
        purpose: 'I am reviewing this engineering portfolio.',
        consentAt: expect.any(Date)
      })
    );
  });

  test('returns the same response without duplicating a pending email', async () => {
    mockFindPendingByEmail.mockResolvedValue({ id: 7, status: 'pending' });

    await expect(
      accessRequestService.submit({
        fullName: 'Amina Khan',
        workEmail: 'amina@example.com',
        purpose: 'I am reviewing this engineering portfolio.'
      })
    ).resolves.toEqual({ received: true });

    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('updates administrator review state', async () => {
    mockUpdateStatus.mockResolvedValue({ id: 4, status: 'invited' });
    await expect(accessRequestService.review(4, 'invited')).resolves.toMatchObject({
      status: 'invited'
    });
  });

  test('returns the latest request status without provider credentials', async () => {
    mockFindLatestByEmail.mockResolvedValue({
      status: 'pending',
      workspaceId: 'workspace_demo_123',
      reviewNote: null,
      createdAt: new Date('2026-09-20T00:00:00.000Z'),
      reviewedAt: null
    });

    await expect(accessRequestService.status(' REVIEWER@EXAMPLE.COM ')).resolves.toMatchObject({
      status: 'pending',
      workspaceId: 'workspace_demo_123'
    });
    expect(mockFindLatestByEmail).toHaveBeenCalledWith('reviewer@example.com');
  });

  test('rejects review of a missing request', async () => {
    mockUpdateStatus.mockResolvedValue(undefined);
    await expect(accessRequestService.review(404, 'declined')).rejects.toMatchObject({
      statusCode: 404
    });
  });
});
