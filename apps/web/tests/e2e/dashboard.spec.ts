import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function getSaveAllCount(page: Page): Promise<number> {
  const label = await page.getByRole('button', { name: /Save All/ }).innerText();
  const match = label.match(/\((\d+)\)/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

test('dashboard renders redesigned layout and chart surfaces', async ({ page }) => {
  const initialResponse = page.waitForResponse(
    (response) => response.url().includes('/api/dashboard/initial') && response.status() === 200
  );

  await page.goto('/dashboard');
  await initialResponse;

  await expect(page.getByRole('heading', { name: 'Powerlifting Performance Dashboard' })).toBeVisible();
  await expect(page.getByTestId('performance-snapshot')).toBeVisible();
  await expect(page.getByTestId('overall-chart-panel')).toBeVisible();
  await expect(page.getByTestId('block-chart-panel')).toBeVisible();
  await expect(page.getByTestId('block-comparison-chart-panel')).toBeVisible();
  await expect(page.getByTestId('meet-projection-chart-panel')).toBeVisible();
  await expect.poll(async () => page.locator('[data-testid="week-divider"]').count(), { timeout: 45000 }).toBeGreaterThan(0);
  await expect.poll(async () => page.locator('[data-testid="day-divider"]').count(), { timeout: 45000 }).toBeGreaterThan(0);
});

test('overall chart legend toggles visible series', async ({ page }) => {
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

test('dashboard supports grouped-row inline edit and save parity', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Powerlifting Performance Dashboard' })).toBeVisible();

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
