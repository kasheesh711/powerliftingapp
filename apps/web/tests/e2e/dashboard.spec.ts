import { test, expect } from '@playwright/test';

test('dashboard loads', async ({ page }) => {
  const initialResponse = page.waitForResponse(
    (response) => response.url().includes('/api/dashboard/initial') && response.status() === 200
  );
  await page.goto('/dashboard');
  await initialResponse;

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.locator('select option')).not.toHaveCount(0);
  await expect.poll(async () => page.locator('tbody tr').count(), { timeout: 45000 }).toBeGreaterThan(0);
});

test('dashboard supports inline edit and save row', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect.poll(async () => page.locator('tbody tr').count(), { timeout: 45000 }).toBeGreaterThan(0);

  const firstRow = page.locator('tbody tr').first();
  const firstEditableInput = firstRow.locator('input').first();

  await expect(firstEditableInput).toBeVisible();
  await firstEditableInput.fill('111');
  await expect(firstRow).toContainText('Dirty');

  await firstRow.getByRole('button', { name: 'Save Row' }).click();
  await expect(firstRow).toContainText('Clean');
});
