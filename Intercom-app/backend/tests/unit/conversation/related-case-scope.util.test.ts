import {
  conversationMatchesRelatedCaseScope,
  isStoreScopedConversation,
  resolveRelatedCaseSearchScope,
  resolveRelatedCaseSearchScopeFromConversation,
  widenStoreScopeToDomainWhenNeeded
} from '../../../src/modules/conversation/related-case-scope.util.js';

describe('related-case-scope.util', () => {
  it('prefers store scope when reporter email has numeric local part', () => {
    expect(
      resolveRelatedCaseSearchScope({
        storeNumber: '3456',
        domain: 'acmecorp.com'
      })
    ).toEqual({
      mode: 'store',
      storeNumber: '3456',
      domain: null
    });
  });

  it('uses domain scope when no store number is present', () => {
    expect(
      resolveRelatedCaseSearchScope({
        storeNumber: null,
        domain: 'acmecorp.com'
      })
    ).toEqual({
      mode: 'domain',
      storeNumber: null,
      domain: 'acmecorp.com'
    });
  });

  it('classifies store and domain-only conversations', () => {
    expect(
      isStoreScopedConversation({
        reporterEmail: 'dd1976@demoops.co',
        reporterStoreNumber: 'dd1976'
      })
    ).toBe(true);

    expect(
      isStoreScopedConversation({
        reporterEmail: 'zubair-zahid@demoops.co',
        reporterStoreNumber: null
      })
    ).toBe(false);
  });

  it('matches related cases only within the same store inbox', () => {
    const scope = { mode: 'store' as const, storeNumber: 'dd1976', domain: null };

    expect(
      conversationMatchesRelatedCaseScope(
        {
          reporterEmail: 'dd1976@demoops.co',
          reporterStoreNumber: 'dd1976',
          reporterCompanyDomain: 'demoops.co'
        },
        scope
      )
    ).toBe(true);

    expect(
      conversationMatchesRelatedCaseScope(
        {
          reporterEmail: '10206@demoops.co',
          reporterStoreNumber: '10206',
          reporterCompanyDomain: 'demoops.co'
        },
        scope
      )
    ).toBe(false);

    expect(
      conversationMatchesRelatedCaseScope(
        {
          reporterEmail: 'zubair-zahid@demoops.co',
          reporterCompanyDomain: 'demoops.co'
        },
        scope
      )
    ).toBe(false);
  });

  it('matches related cases only for same domain when both sides are domain-only', () => {
    const scope = { mode: 'domain' as const, storeNumber: null, domain: 'demoops.co' };

    expect(
      conversationMatchesRelatedCaseScope(
        {
          reporterEmail: 'zubair-zahid@demoops.co',
          reporterCompanyDomain: 'demoops.co'
        },
        scope
      )
    ).toBe(true);

    expect(
      conversationMatchesRelatedCaseScope(
        {
          reporterEmail: 'dd1976@demoops.co',
          reporterStoreNumber: 'dd1976',
          reporterCompanyDomain: 'demoops.co'
        },
        scope
      )
    ).toBe(false);

    expect(
      conversationMatchesRelatedCaseScope(
        {
          reporterEmail: 'hr@acmecorp.com',
          reporterCompanyDomain: 'acmecorp.com'
        },
        scope
      )
    ).toBe(false);
  });

  it('does not cross-match store tickets with domain-only tickets', () => {
    const storeScope = { mode: 'store' as const, storeNumber: 'dd1976', domain: null };
    const domainScope = { mode: 'domain' as const, storeNumber: null, domain: 'demoops.co' };
    const domainOnlyConversation = {
      reporterEmail: 'zubair-zahid@demoops.co',
      reporterCompanyDomain: 'demoops.co'
    };
    const storeConversation = {
      reporterEmail: 'dd1976@demoops.co',
      reporterStoreNumber: 'dd1976',
      reporterCompanyDomain: 'demoops.co'
    };

    expect(conversationMatchesRelatedCaseScope(domainOnlyConversation, storeScope)).toBe(false);
    expect(conversationMatchesRelatedCaseScope(storeConversation, domainScope)).toBe(false);
  });

  it('reads stored reporter scope from conversation columns', () => {
    expect(
      resolveRelatedCaseSearchScopeFromConversation({
        reporterName: 'Amber R',
        reporterEmail: 'hr@acmecorp.com',
        reporterStoreNumber: '3456',
        reporterCompanyDomain: 'acmecorp.com'
      })
    ).toEqual({
      mode: 'store',
      storeNumber: '3456',
      domain: null
    });
  });

  it('falls back to parsing reporter fields when stored columns are empty', () => {
    expect(
      resolveRelatedCaseSearchScopeFromConversation({
        reporterName: 'Amber R',
        reporterEmail: '3456@acmecorp.com',
        reporterStoreNumber: null,
        reporterCompanyDomain: null
      })
    ).toEqual({
      mode: 'store',
      storeNumber: '3456',
      domain: null
    });
  });

  it('widens store scope to same store plus company domain after domain employee search', () => {
    const scope = { mode: 'store' as const, storeNumber: 'dd1976', domain: null };

    expect(widenStoreScopeToDomainWhenNeeded(scope, 'demoops.co', true)).toEqual({
      mode: 'store-and-domain',
      storeNumber: 'dd1976',
      domain: 'demoops.co'
    });
    expect(widenStoreScopeToDomainWhenNeeded(scope, 'demoops.co', false)).toEqual(scope);
  });

  it('matches store and company-domain tickets after domain search widen', () => {
    const scope = {
      mode: 'store-and-domain' as const,
      storeNumber: '10206',
      domain: 'demoops.co'
    };

    expect(
      conversationMatchesRelatedCaseScope(
        {
          reporterEmail: '10206@demoops.co',
          reporterStoreNumber: '10206',
          reporterCompanyDomain: 'demoops.co'
        },
        scope
      )
    ).toBe(true);

    expect(
      conversationMatchesRelatedCaseScope(
        {
          reporterEmail: 'zubair-zahid@demoops.co',
          reporterCompanyDomain: 'demoops.co'
        },
        scope
      )
    ).toBe(true);

    expect(
      conversationMatchesRelatedCaseScope(
        {
          reporterEmail: 'dd1976@demoops.co',
          reporterStoreNumber: 'dd1976',
          reporterCompanyDomain: 'demoops.co'
        },
        scope
      )
    ).toBe(true);

    expect(
      conversationMatchesRelatedCaseScope(
        {
          reporterEmail: 'hr@acmecorp.com',
          reporterCompanyDomain: 'acmecorp.com'
        },
        scope
      )
    ).toBe(false);
  });
});
