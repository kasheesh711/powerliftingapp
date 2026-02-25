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

test('dashboard supports save all and clears dirty state', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect.poll(async () => page.locator('tbody tr').count(), { timeout: 45000 }).toBeGreaterThan(1);

  const firstRow = page.getByTestId('editable-row-0');
  const inputs = page.locator('tbody input');
  await expect.poll(async () => inputs.count(), { timeout: 45000 }).toBeGreaterThan(1);

  await inputs.nth(0).fill('122');
  await inputs.nth(1).fill('9');

  await expect(firstRow).toContainText('Dirty');
  await expect(page.getByTestId('save-all-button')).toContainText('Save All (2)');

  await page.getByTestId('save-all-button').click();

  await expect(page.getByTestId('save-all-button')).toContainText('Save All (0)');
  await expect(firstRow).toContainText('Clean');
  await expect(page.getByTestId('save-notice')).toContainText('Saved 2 updates');
});
