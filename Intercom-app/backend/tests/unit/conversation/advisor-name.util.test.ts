import { extractAdvisorNameFromPayload } from '../../../src/modules/conversation/advisor-name.util.js';

describe('extractAdvisorNameFromPayload', () => {
  it('reads assigned_admin name from payload', () => {
    expect(
      extractAdvisorNameFromPayload({
        assigned_admin: { name: 'Crystal' }
      })
    ).toBe('Crystal');
  });

  it('falls back to assignee name', () => {
    expect(
      extractAdvisorNameFromPayload({
        assignee: { name: 'Phoebe' }
      })
    ).toBe('Phoebe');
  });

  it('returns null when no advisor name is present', () => {
    expect(extractAdvisorNameFromPayload({})).toBeNull();
  });
});
