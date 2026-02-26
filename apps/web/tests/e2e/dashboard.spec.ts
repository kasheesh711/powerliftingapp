import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function getSaveAllCount(page: Page): Promise<number> {
  const label = await page.getByRole('button', { name: /Save All/ }).innerText();
  const match = label.match(/\((\d+)\)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

async function signInLocalDev(page: Page): Promise<void> {
  await page.goto('/api/auth/signin?callbackUrl=%2Fdashboard');

  const localButton = page.getByRole('button', { name: /Sign in with Local Dev/i });
  const localVisible = await localButton.isVisible({ timeout: 15000 }).catch(() => false);

  if (localVisible) {
    await localButton.click();
    await page.waitForURL('**/dashboard', { timeout: 45000 });
    return;
  }

  // Fallback: if auth bypass is enabled the dashboard still loads.
  await page.goto('/dashboard');
}

test('unauthenticated dashboard shows a single setup action', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard');

  await expect(page.getByTestId('shell-guidance')).toBeVisible();
  await expect(page.getByTestId('shell-guidance').getByRole('link', { name: 'Sign In' })).toBeVisible();
  await expect(page.getByTestId('connection-pane')).toBeVisible();
  await expect(page.getByTestId('week-tabs')).toHaveCount(0);
});

test('authenticated ready state supports prompt copy and save parity', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as any).__copiedPrompt = value;
        }
      }
    });
  });

  await signInLocalDev(page);
  await page.goto('/dashboard');

  await expect(page.getByRole('heading', { name: 'Powerlifting Performance Dashboard' })).toBeVisible();
  await expect(page.getByTestId('performance-snapshot')).toBeVisible();
  await expect(page.getByTestId('overall-chart-panel')).toBeVisible();
  await expect(page.getByTestId('week-tabs')).toBeVisible();

  const promptButton = page.getByTestId('prompt-copy-weekly_training_review');
  await expect(promptButton).toBeVisible();
  await promptButton.click();
  await expect(promptButton).toContainText('Copied');
  await expect
    .poll(async () =>
      page.evaluate(() => {
        return ((window as any).__copiedPrompt || '') as string;
      })
    )
    .not.toBe('');

  const editableRows = page.locator('tbody tr:has(button:has-text("Save Row"))');
  await expect.poll(async () => editableRows.count(), { timeout: 45000 }).toBeGreaterThan(0);

  const firstRow = editableRows.first();
  const firstInput = firstRow.locator('input').first();
  await expect(firstInput).toBeVisible();

  const currentValue = await firstInput.inputValue();
  const nextValue = currentValue === '111' ? '112' : '111';

  await firstInput.fill(nextValue);
  await expect(firstRow).toContainText('Dirty');
  await expect.poll(() => getSaveAllCount(page), { timeout: 10000 }).toBeGreaterThan(0);

  await firstRow.getByRole('button', { name: 'Save Row' }).click();
  await expect(firstRow).toContainText('Clean');
  await expect.poll(() => getSaveAllCount(page), { timeout: 10000 }).toBe(0);
});

test('mobile pane navigation uses hybrid scroll layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await signInLocalDev(page);
  await page.goto('/dashboard');

  await expect(page.getByTestId('mobile-pane-tabs')).toBeVisible();

  await page.getByTestId('mobile-pane-analysis').click();
  await expect(page.getByTestId('analysis-pane')).toBeVisible();

  await page.getByTestId('mobile-pane-training').click();
  await expect(page.getByTestId('training-pane')).toBeVisible();

  const metrics = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    viewportHeight: window.innerHeight,
    htmlOverflowY: getComputedStyle(document.documentElement).overflowY,
    bodyOverflowY: getComputedStyle(document.body).overflowY
  }));

  expect(['hidden', 'clip']).not.toContain(metrics.htmlOverflowY);
  expect(['hidden', 'clip']).not.toContain(metrics.bodyOverflowY);

  if (metrics.documentHeight > metrics.viewportHeight) {
    const scrollDelta = await page.evaluate(() => {
      const before = window.scrollY;
      window.scrollTo(0, Math.max(200, before + 200));
      const after = window.scrollY;
      window.scrollTo(0, before);
      return after - before;
    });
    expect(scrollDelta).toBeGreaterThan(0);
  }
});

test('overall chart legend toggles visible series', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInLocalDev(page);
  await page.goto('/dashboard');

  const squatToggle = page.getByTestId('overall-legend-squat');
  await expect(squatToggle).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => page.locator('.overall-line-squat').count(), { timeout: 45000 }).toBeGreaterThan(0);

  await squatToggle.click();
  await expect(squatToggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.overall-line-squat')).toHaveCount(0);

  await squatToggle.click();
  await expect(squatToggle).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => page.locator('.overall-line-squat').count(), { timeout: 45000 }).toBeGreaterThan(0);
});
