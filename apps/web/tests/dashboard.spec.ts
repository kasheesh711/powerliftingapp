import { test, expect } from '@playwright/test';

test('homepage renders migration title', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Powerlifting Dashboard Migration' })).toBeVisible();
});
