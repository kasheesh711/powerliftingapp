import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function getSaveAllCount(page: Page): Promise<number> {
  const label = await page.getByRole('button', { name: /Save All/ }).innerText();
  const match = label.match(/\((\d+)\)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

async function expectNoPageScroll(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    documentHeight: document.documentElement.scrollHeight,
    bodyHeight: document.body.scrollHeight,
    viewportHeight: window.innerHeight,
  }));

  expect(metrics.documentHeight).toBeLessThanOrEqual(metrics.viewportHeight + 1);
  expect(metrics.bodyHeight).toBeLessThanOrEqual(metrics.viewportHeight + 1);
}

test('dashboard renders single-screen desktop layout with analysis switcher', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  const initialResponse = page.waitForResponse(
    (response) => response.url().includes('/api/dashboard/initial') && response.status() === 200
  );

  await page.goto('/dashboard');
  await initialResponse;

  await expect(page.getByRole('heading', { name: 'Powerlifting Performance Dashboard' })).toBeVisible();
  await expect(page.getByTestId('performance-snapshot')).toBeVisible();
  await expect(page.getByTestId('overall-chart-panel')).toBeVisible();
  await expect(page.getByTestId('block-chart-panel')).toBeVisible();
  await expect(page.getByTestId('analysis-slot-tabs')).toBeVisible();
  await expect(page.getByTestId('analysis-slot-blockComparison')).toHaveAttribute('aria-selected', 'true');

  await page.getByTestId('analysis-slot-meetProjection').click();
  await expect(page.getByTestId('analysis-slot-meetProjection')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('meet-projection-chart-panel')).toBeVisible();

  await page.getByTestId('analysis-slot-recap').click();
  await expect(page.getByTestId('analysis-slot-recap')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('analysis-recap-panel')).toBeVisible();

  await expectNoPageScroll(page);
});

test('dashboard uses one-screen pane navigation on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');

  await expect(page.getByTestId('mobile-pane-tabs')).toBeVisible();

  await page.getByTestId('mobile-pane-analysis').click();
  await expect(page.getByTestId('analysis-pane')).toBeVisible();
  await expect(page.getByTestId('analysis-slot-tabs')).toBeVisible();
  await expectNoPageScroll(page);

  await page.getByTestId('mobile-pane-training').click();
  await expect(page.getByTestId('training-pane')).toBeVisible();
  await expect(page.getByTestId('week-tabs')).toBeVisible();
  await expectNoPageScroll(page);

  await page.getByTestId('mobile-pane-connection').click();
  await expect(page.getByTestId('connection-pane')).toBeVisible();
  await expectNoPageScroll(page);
});

test('overall chart legend toggles visible series', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Powerlifting Performance Dashboard' })).toBeVisible();

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

test('dashboard supports week/day tabbed edit and save parity', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Powerlifting Performance Dashboard' })).toBeVisible();

  const weekTabs = page.getByTestId('week-tabs').getByRole('tab');
  await expect.poll(async () => weekTabs.count(), { timeout: 45000 }).toBeGreaterThan(0);

  const weekCount = await weekTabs.count();
  if (weekCount > 1) {
    const secondWeek = weekTabs.nth(1);
    await secondWeek.click();
    await expect(secondWeek).toHaveAttribute('aria-selected', 'true');
  }

  const dayTabs = page.getByTestId('day-tabs').getByRole('tab');
  await expect.poll(async () => dayTabs.count(), { timeout: 45000 }).toBeGreaterThan(0);

  const dayCount = await dayTabs.count();
  if (dayCount > 1) {
    const secondDay = dayTabs.nth(1);
    await secondDay.click();
    await expect(secondDay).toHaveAttribute('aria-selected', 'true');
  }

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

  await expectNoPageScroll(page);
});
