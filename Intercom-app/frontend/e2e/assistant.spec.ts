import { expect, test, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const answer = {
  answer: '**HR Intelligence** connects your HR conversations.\n- Resolve employee identity.\n- Surface related history.',
  tool: 'getProductContext', provider: 'fixture', readOnly: true,
  sources: ['product:overview'], suggestedPrompts: ['How does identity matching work?']
};

async function respond(route: Route, data = answer) {
  await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
}

test('assistant shows real pending state, formatted answers, and useful follow-up questions', async ({ page }) => {
  let release: () => void = () => {};
  let calls = 0;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/assistant/ask', async route => {
    calls++;
    expect(route.request().postDataJSON()).toMatchObject({ route: '/', workspace: 'hr-intelligence-workspace' });
    if (calls === 1) await pending;
    await respond(route);
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ask HR Intelligence', exact: true }).click();
  const assistant = page.getByRole('dialog', { name: 'Ask HR Intelligence' });
  await expect(assistant.getByText('Product guide', { exact: true })).toBeVisible();
  await expect(assistant.getByRole('textbox', { name: 'Ask HR Intelligence' })).toBeFocused();
  await assistant.getByRole('button', { name: 'What problem does HR Intelligence solve?' }).click();
  await expect(assistant.getByRole('status')).toContainText('Connecting the context');
  await expect(assistant.getByRole('button', { name: 'Start a new conversation' })).toBeDisabled();
  await assistant.getByRole('textbox').fill('A draft for my next question');
  await assistant.getByRole('textbox').press('Enter');
  expect(calls).toBe(1);
  await expect(assistant.getByRole('textbox')).toHaveValue('A draft for my next question');
  release();
  await expect(assistant.getByRole('article', { name: 'Assistant answer' })).toContainText('Resolve employee identity.');
  await expect(assistant.getByText('1 permitted context source')).toBeVisible();
  await expect(assistant.getByRole('button', { name: 'How does identity matching work?' })).toBeVisible();
  await expect(assistant.locator('strong')).toContainText('HR Intelligence');
  await expect(assistant).not.toContainText('getProductContext');
  await assistant.getByRole('button', { name: 'How does identity matching work?' }).click();
  await expect(assistant.getByRole('article', { name: 'Assistant answer' })).toHaveCount(2);
  expect(calls).toBe(2);
});

test('assistant preserves multiline input, retries without duplicates, and restores keyboard focus', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/assistant/ask', async route => {
    calls++;
    expect(route.request().postDataJSON().message).toBe('Explain identity matching\nand related cases');
    if (calls === 1) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) });
    return respond(route);
  });
  await page.goto('/');
  const launcher = page.getByRole('button', { name: 'Ask HR Intelligence', exact: true });
  await launcher.click();
  const assistant = page.getByRole('dialog', { name: 'Ask HR Intelligence' });
  const input = assistant.getByRole('textbox');
  await input.fill('Explain identity matching');
  await input.press('Shift+Enter');
  await input.pressSequentially('and related cases');
  await input.press('Enter');
  await expect(assistant.getByRole('alert')).toContainText('Your question is saved');
  await assistant.getByRole('button', { name: 'Try again' }).click();
  await expect(assistant.getByRole('article', { name: 'Assistant answer' })).toBeVisible();
  await expect(assistant.getByRole('article', { name: 'Your question' })).toHaveCount(1);
  await assistant.getByRole('button', { name: 'Start a new conversation' }).click();
  await expect(assistant.getByRole('article')).toHaveCount(0);
  await expect(input).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(assistant).toHaveCount(0);
  await expect(launcher).toBeFocused();
});

test('assistant fits mobile and keyboard-height viewports and passes serious accessibility checks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Ask HR Intelligence', exact: true }).click();
  const assistant = page.getByRole('dialog', { name: 'Ask HR Intelligence' });
  const result = await new AxeBuilder({ page }).include('#hr-intelligence-assistant').analyze();
  expect(result.violations.filter(item => ['critical', 'serious'].includes(item.impact ?? ''))).toEqual([]);
  for (const viewport of [{ width: 320, height: 640 }, { width: 390, height: 420 }]) {
    await page.setViewportSize(viewport);
    await expect(assistant).toBeInViewport({ ratio: 1 });
    const bounds = await assistant.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    expect(await assistant.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(assistant.getByRole('textbox')).toBeInViewport();
  }
  await assistant.getByRole('button', { name: 'Close assistant' }).click();
  await expect(assistant).toHaveCount(0);
});
