import { expect, test, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const demoToken = `header.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.signature`;

const overview = {
  casesProcessed: 1,
  completed: 1,
  failed: 0,
  processing: 0,
  pending: 0,
  pendingManualReview: 0,
  duplicateEventsPrevented: 0,
  casesBySource: { demo: 1 },
  casesByCategory: { leave: 1 },
  mentionStatus: { resolved: 1 },
  matchedEmployeeCases: 1,
  casesWithRelated: 1,
  employeeDirectoryCount: 4,
  averageMatchConfidence: 92,
  recentCases: []
};

const trendBuckets = Array.from({ length: 30 }, (_, index) => ({
  date: new Date(Date.UTC(2026, 7, 22 + index)).toISOString().slice(0, 10),
  casesCreated: index === 29 ? 1 : 0,
  completed: index === 29 ? 1 : 0,
  failed: 0
}));

const caseRow = {
  id: 42,
  source: 'demo',
  subject: 'Leave request',
  status: 'ready',
  category: 'leave',
  employee: 'Jordan Hale',
  storeNumber: '041',
  relatedCaseCount: 1,
  confidence: 0.92,
  receivedAt: '2026-09-20T08:00:00.000Z',
  mentionStatus: 'resolved',
  requiresManualReview: false
};

const caseDetail = {
  case: { id: 42, intercomSyncStatus: 'ready', openInIntercomUrl: null },
  conversation: {
    subject: 'Leave request',
    body: 'Jordan asked about leave coverage for next week.',
    source: 'demo',
    sender: 'jordan@example.com',
    senderName: 'Jordan Hale'
  },
  snapshot: {
    processingMode: 'apify',
    caseType: 'leave',
    requiresManualReview: false,
    employeeMatches: [{ canonicalName: 'Jordan Hale', confidenceScore: 92, matchMethod: 'exact name' }],
    relatedCases: [{ conversationId: 17, subject: 'Previous leave question', matchedEmployeeNames: ['Jordan Hale'] }],
    ccRecipients: { recipients: [{ name: 'Mina Patel', email: 'mina@example.com', role: 'manager' }] }
  },
  timeline: { createdAt: '2026-09-20T08:00:00.000Z', processedAt: '2026-09-20T08:00:03.000Z', processingDurationMs: 3000 }
};

async function json(route: Route, data: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status < 400, data }) });
}

async function mockApi(page: Page, options: { casesStatus?: number; accessStatus?: unknown } = {}): Promise<void> {
  await page.route('**/api/auth/refresh-token', route => json(route, null, 401));
  await page.route('**/ready', (route) => json(route, { status: 'ready' }));
  await page.route('**/api/auth/demo', (route) => json(route, {
    token: demoToken,
    user: { id: 1, name: 'Demo Reviewer', email: 'reviewer@example.com', role: 'viewer' },
    expiresAt: '2026-09-20T09:00:00.000Z',
    access: 'demo'
  }));
  await page.route('**/api/cases/overview', (route) => json(route, overview));
  await page.route('**/api/demo/cases**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/demo/cases/42') return json(route, caseDetail);
    return json(route, { items: [caseRow], total: 1 });
  });
  await page.route('**/api/operations/reviewer-summary', (route) => json(route, {
    jobProcessingMode: 'apify', pendingOutbox: 0, recoveryStatus: 'clear', actorRuns: { queued: 0, running: 0, completed: 1, failed: 0, retryableFailures: 0, latestFailureCode: null, recentRunDurationMs: 3000 }
  }));
  await page.route('**/api/access-requests/me', (route) => json(route, options.accessStatus ?? null));
  await page.route('**/api/access-requests', (route) => {
    if (new URL(route.request().url()).pathname === '/api/access-requests/me') return json(route, options.accessStatus ?? null);
    if (route.request().method() === 'POST') return json(route, { received: true }, 201);
    return json(route, []);
  });
  await page.route('**/api/directory', (route) => json(route, {
    companies: [{ name: 'Northwind Bakery', slug: 'northwind-bakery' }],
    stores: [{ storeNumber: '1042', storeName: 'Harbor Street', districtManagerName: 'Sam Patel', vpName: 'Mina Patel' }],
    employees: [{ id: 1, canonicalName: 'Jordan Hale', storeNumber: '1042', companyDomain: 'northwind.co' }],
    fixedContacts: [{ name: 'Mina Patel', email: 'mina@example.com', role: 'manager' }],
    importHistory: [],
    boxConfigured: false
  }));
  await page.route('**/api/evaluation', (route) => json(route, {
    datasetVersion: 'fixture-v1', datasetSize: 1, promptVersion: 'portfolio-v1', modelVersion: 'fixture-v1', usesLiveModel: false,
    method: 'subject-heuristic', fixtureDirectory: ['Jordan Hale'], classificationAccuracy: 1, classificationHits: 1,
    employeeMatchPrecision: 1, employeeMatchRecall: 1, employeeTruePositives: 1, employeeFalsePositives: 0, employeeFalseNegatives: 0,
    directoryResolutionPrecision: 1, directoryTruePositives: 1, relatedCasePrecision: 1, relatedCaseRecall: 1,
    relatedTruePositives: 1, relatedFalsePositives: 0, relatedFalseNegatives: 0, lowConfidenceRate: 0, lowConfidenceCount: 0,
    manualReviewRate: 0, manualReviewCount: 0, cases: [{ id: 'fixture-1', subject: 'Leave — Jordan Hale', expectedEmployee: 'Jordan Hale', predictedEmployee: 'Jordan Hale', expectedCategory: 'leave', predictedCategory: 'leave', nameMatch: true, categoryMatch: true, inFixtureDirectory: true, flaggedForReview: false }]
  }));
  await page.route('**/api/cases/trends**', (route) => json(route, { range: new URL(route.request().url()).searchParams.get('range') ?? '30d', startDate: '2026-08-22', endDate: '2026-09-20', buckets: trendBuckets }));
  await page.route('**/api/demo/sessions', (route) => json(route, {
    session: { token: 'demo-session-token', receivingAddress: 'demo@example.test', expiresAt: '2026-09-20T09:00:00.000Z', remainingCases: 3, remainingEmails: 3, remainingLiveLlm: 0 },
    scenarios: [{ id: 'leave', title: 'Leave request', summary: 'A synthetic leave request.' }],
    llmModeDefault: 'fixture',
    liveAiConfigured: false
  }));
  await page.route('**/api/cases**', (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/cases/overview') return json(route, overview);
    if (pathname === '/api/cases/trends') return json(route, { range: new URL(route.request().url()).searchParams.get('range') ?? '30d', startDate: '2026-08-22', endDate: '2026-09-20', buckets: trendBuckets });
    if (pathname === '/api/cases/42') return json(route, caseDetail);
    if (options.casesStatus && options.casesStatus >= 400) return route.fulfill({ status: options.casesStatus, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Case service unavailable' }) });
    return json(route, { items: [caseRow], total: 1 });
  });
}

async function enterDemo(page: Page): Promise<void> {
  await page.goto('/login?mode=demo');
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole('heading', { name: 'Organization overview' })).toBeVisible();
}

test('public landing page is usable and passes critical accessibility checks', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /HR conversations.*Clearer decisions/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Explore reviewer walkthrough/ })).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === 'critical')).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test('landing workflow supports keyboard exploration, motion controls, and on-demand video', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.locator('.neural-core').evaluate((canvas: HTMLCanvasElement) => canvas.width)).toBeGreaterThan(300);
  await page.getByRole('button', { name: 'Pause visual animation' }).click();
  await expect(page.getByRole('button', { name: 'Resume visual animation' })).toHaveAttribute('aria-pressed', 'true');

  const firstStep = page.getByRole('tab', { name: /Understand the conversation/ });
  await firstStep.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('tab', { name: /Connect the right context/ })).toBeFocused();
  await expect(page.locator('.workflow-explorer').getByRole('tabpanel')).toContainText('Directory record matched');
  await page.keyboard.press('End');
  await expect(page.locator('.workflow-explorer').getByRole('tabpanel')).toContainText('Human reviewer decides');

  await expect(page.locator('.product-film iframe')).toHaveCount(0);
  await page.locator('.film-poster').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('.film-poster img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.route('https://embed.app.guidde.com/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Product walkthrough player</p>' }));
  await page.getByRole('button', { name: 'Play the five-minute product walkthrough' }).click();
  await expect(page.locator('.product-film iframe')).toBeVisible();
  await page.getByRole('button', { name: 'Close video' }).click();
  await expect(page.getByRole('button', { name: 'Play the five-minute product walkthrough' })).toBeVisible();
});

test('landing case animation is explorable and real product screenshots explain the evidence', async ({ page }) => {
  await page.goto('/');
  const caseControls = page.getByRole('group', { name: 'Explore a sample HR case' });
  await caseControls.getByRole('button', { name: /Resolve identity/ }).click();
  await expect(page.locator('.core-process')).toContainText('Connecting the employee');
  await expect(page.getByRole('button', { name: 'Resume visual animation' })).toHaveAttribute('aria-pressed', 'true');

  const proof = page.locator('.product-proof');
  const firstScreen = proof.getByRole('tab', { name: 'Employee identity', exact: true });
  await firstScreen.focus();
  await page.keyboard.press('ArrowRight');
  await expect(proof.getByRole('tab', { name: 'Related history', exact: true })).toBeFocused();
  await expect(proof.getByRole('tabpanel')).toContainText('Uncertain identity stays a human decision.');
  await expect(proof.getByRole('link', { name: 'Open full-size product screenshot: Related history' })).toHaveAttribute('href', '/product-screenshots/ayesha-related-case-evidence.webp');
  await expect.poll(() => proof.locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.keyboard.press('End');
  await expect(proof.getByRole('tabpanel')).toContainText('The conversation has a clear case category.');
  await expect(proof.getByRole('link', { name: 'Explore the product yourself' })).toHaveAttribute('href', '/login?mode=demo');
});

test('mobile landing navigation and FAQs work without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /HR conversations/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open menu' }).click();
  const mobileNav = page.getByRole('navigation', { name: 'Mobile landing' });
  await expect(mobileNav).toBeVisible();
  await mobileNav.getByRole('link', { name: 'How it works' }).click();
  await expect(mobileNav).toHaveCount(0);
  await expect(page).toHaveURL(/#workflow$/);
  await page.locator('summary').filter({ hasText: 'Can I explore it without connecting company data?' }).click();
  await expect(page.getByText(/The reviewer walkthrough uses synthetic records in a read-only workspace/)).toBeVisible();
});

test('landing engineering CTA opens the public case study and passes axe checks', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Explore the engineering/ }).click();
  await expect(page).toHaveURL(/\/engineering$/);
  await expect(page.getByRole('heading', { name: 'Engineering at Case Lense' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A durable path for bursty background work.' })).toBeVisible();
  await expect(page.getByText('API → Apify on-demand Actor')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === 'critical')).toEqual([]);
});

test('reviewer demo opens the overview and case intelligence flow', async ({ page }) => {
  await mockApi(page);
  await enterDemo(page);
  await expect(page.getByText('Demo Reviewer')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Volume and processing outcomes over time' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cases created' })).toBeVisible();
  await page.getByRole('button', { name: '7 days' }).click();
  await expect(page.getByRole('button', { name: '7 days' })).toHaveAttribute('aria-pressed', 'true');
  const overviewA11y = await new AxeBuilder({ page }).analyze();
  expect(overviewA11y.violations.filter((violation) => violation.impact === 'critical')).toEqual([]);

  await page.goto('/cases');
  await expect(page.getByRole('link', { name: 'Leave request' })).toBeVisible();
  await page.getByRole('link', { name: 'Leave request' }).click();
  await expect(page.getByText('Leave request').last()).toBeVisible();
  await expect(page.getByText('Jordan Hale').first()).toBeVisible();
  await expect(page.getByText('Previous leave question')).toBeVisible();
});

test('recruiter demo exposes the read-only product surface and hides access management', async ({ page }) => {
  await mockApi(page);
  await enterDemo(page);

  const sidebar = page.getByRole('navigation', { name: 'Application' });
  for (const label of ['Organization overview', 'Case operations', 'Directory intelligence', 'Operational health', 'AI quality', 'Architecture', 'Product walkthrough']) {
    await expect(sidebar.getByRole('link', { name: label })).toBeVisible();
  }
  await expect(sidebar.getByRole('link', { name: 'Access management' })).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: 'Reviewer access' })).toBeVisible();
  await expect(page.getByText('Product demo · Read-only')).toBeVisible();

  await expect(page.getByRole('button', { name: 'Open Intercom inbox' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Intercom inbox' }).click();
  await expect(page.getByRole('dialog', { name: 'Connect an Intercom workspace' })).toBeVisible();
  await expect(page.getByText('Never paste Intercom API keys or access tokens here.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Connect an Intercom workspace' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Intercom inbox' }).click();
  await page.getByRole('link', { name: 'Request reviewer access' }).click();
  await expect(page).toHaveURL(/\/access$/);
  await expect(page.getByRole('heading', { name: 'Request a personal reviewer account.' })).toBeVisible();
  await expect(page.getByLabel('Intercom Workspace ID')).toBeVisible();
  await page.getByLabel('Full name').fill('Demo Recruiter');
  await page.getByLabel('Work email').fill('demo.recruiter@example.test');
  await page.getByLabel('Intercom Workspace ID').fill('workspace_demo_123');
  await page.getByLabel('Reason for access').fill('I am reviewing this portfolio and need the connected demo workflow.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Request reviewer access' }).click();
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible();
  await expect(page.getByText('pending', { exact: true })).toBeVisible();

  await page.goto('/directory');
  await expect(page.getByRole('heading', { name: 'Directory intelligence' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Import & sync' })).toHaveCount(0);

  await page.goto('/operations');
  await expect(page.getByRole('heading', { name: 'Operational health' })).toBeVisible();
  await expect(page.getByText('Product demo · Read-only.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /Force replay|Retry write-back|Dispatch pending events/ })).toHaveCount(0);

  await page.goto('/evaluation');
  await expect(page.getByRole('heading', { name: 'AI Quality' })).toBeVisible();
  await expect(page.getByText('Deterministic safety baseline')).toBeVisible();

  await page.goto('/architecture');
  await expect(page.getByRole('heading', { name: 'Architecture' })).toBeVisible();
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'Product walkthrough & access' })).toBeVisible();

  await page.goto('/access-requests');
  await expect(page).toHaveURL(/\/overview$/);
  await page.goto('/access');
  await expect(page).toHaveURL(/\/access$/);
  await expect(page.getByRole('heading', { name: 'Request a personal reviewer account.' })).toBeVisible();
});

test('recruiter demo is redirected away from access management', async ({ page }) => {
  await mockApi(page);
  await enterDemo(page);
  await page.goto('/access-requests');
  await expect(page).toHaveURL(/\/overview$/);
});

test('approved reviewer status explains when no safe inbox deep link is configured', async ({ page }) => {
  await mockApi(page, { accessStatus: { status: 'approved', workspaceId: 'workspace_demo_123', connectedInboxUrl: null } });
  await enterDemo(page);
  await page.getByRole('button', { name: 'Open Intercom inbox' }).click();
  await expect(page.getByRole('dialog', { name: 'Connect an Intercom workspace' })).toBeVisible();
  await expect(page.getByText('Approved', { exact: true })).toBeVisible();
  await expect(page.getByText('this environment does not have a safe direct inbox link configured', { exact: false })).toBeVisible();
});

test('admin navigation keeps access and maintenance destinations', async ({ page }) => {
  await mockApi(page);
  await page.addInitScript(({ token, user }) => {
    sessionStorage.setItem('adminToken', token);
    sessionStorage.setItem('adminUser', JSON.stringify(user));
  }, { token: demoToken, user: { id: 2, name: 'Admin', email: 'admin@example.test', role: 'admin' } });
  await page.goto('/overview');

  const sidebar = page.getByRole('navigation', { name: 'Application' });
  await expect(sidebar.getByRole('link', { name: 'Access management' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Reviewer access' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Operational health' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'AI quality' })).toBeVisible();
  await expect(page.getByText('Admin workspace')).toBeVisible();
});

test('case list exposes a recoverable service failure', async ({ page }) => {
  await mockApi(page, { casesStatus: 500 });
  await enterDemo(page);
  await page.goto('/cases');
  await expect(page.getByRole('heading', { name: 'Could not load cases' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});


test('customer demo requests retain the workflow context and use the existing approval service', async ({ page }) => {
  await mockApi(page);
  let refreshCalls = 0;
  await page.route('**/api/auth/refresh-token', route => { refreshCalls++; return json(route, null, 401); });
  let requestBody: Record<string, unknown> | null = null;
  await page.route('**/api/access-requests', async route => {
    requestBody = route.request().postDataJSON();
    return json(route, { received: true }, 201);
  });
  await page.goto('/');
  await page.getByRole('link', { name: 'Request a product demo', exact: true }).first().click();
  await expect(page).toHaveURL(/access\?intent=customer/);
  await expect(page.getByRole('heading', { name: 'Put your HR workflow in the picture.' })).toBeVisible();
  expect(refreshCalls).toBe(0);
  await expect(page.getByRole('button', { name: /For my organization/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Full name').fill('Morgan Smith');
  await page.getByLabel('Work email').fill('morgan@example.test');
  await page.getByLabel('Organization').fill('Example Stores');
  await page.getByLabel('What would you like to explore?').fill('We want to connect attendance cases across our store teams.');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Request a product demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible();
  expect(requestBody).toMatchObject({ organization: 'Example Stores', purpose: '[Customer product demo] We want to connect attendance cases across our store teams.' });
  expect(requestBody).not.toHaveProperty('workspaceId');
});

test('authentication explains the product and provides working demo and recovery paths', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await expect(page.getByText('AI-POWERED HR CASE INTELLIGENCE', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Request a product demo/ })).toHaveAttribute('href', '/access?intent=customer');
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(a11y.violations.filter(violation => violation.impact === 'critical')).toEqual([]);
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Let’s get you back in.' })).toBeVisible();
  await expect(page.getByText(/This page does not send a reset email/)).toBeVisible();
  await page.goto('/set-password');
  await expect(page.getByRole('alert').filter({ hasText: 'missing its invitation token' })).toBeVisible();
  await page.route('**/api/auth/invite?token=synthetic-invitation', route => json(route, { name: 'Morgan Smith', email: 'morgan@example.test', expiresAt: '2026-11-05T00:00:00Z' }));
  await page.route('**/api/auth/invite/accept', route => json(route, { token: demoToken, user: { id: 2, name: 'Morgan Smith', email: 'morgan@example.test', role: 'viewer' } }));
  await page.goto('/set-password?token=synthetic-invitation');
  await page.getByLabel(/^New password/).fill('first-password-123');
  await page.getByLabel('Confirm password').fill('other-password-123');
  await page.getByRole('button', { name: 'Create password and enter workspace' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Passwords do not match.' })).toBeVisible();
  await expect(page.getByLabel('Confirm password')).toBeVisible();
  await page.getByLabel('Confirm password').fill('first-password-123');
  await page.getByRole('button', { name: 'Create password and enter workspace' }).click();
  await expect(page).toHaveURL(/overview$/);
});

test('mobile workspace and authentication keep the product context usable', async ({ page }) => {
  await mockApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Your inbox has the messages/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Enter read-only demo' }).click();
  await expect(page).toHaveURL(/overview$/);
  await expect(page.getByRole('navigation', { name: 'Workspace quick actions' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('navigation', { name: 'Mobile application' }).getByRole('link', { name: 'Case operations' }).click();
  await expect(page.getByRole('heading', { name: 'Case operations', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
