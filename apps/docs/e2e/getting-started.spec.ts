import { expect, test } from '@playwright/test';

test.describe('Getting started — layout and UX', () => {
  test('introduction: hero, comparison grid, and steps', async ({ page }) => {
    await page.goto('/docs/getting-started');
    await expect(page.getByRole('heading', { level: 1, name: 'Introduction' })).toBeVisible();
    await expect(page.getByText('Start here')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Where other frameworks trade off' })).toBeVisible();
    await expect(page.getByText('Express', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Core mental model' })).toBeVisible();
  });

  test('framework overview: stats strip and highlight cards', async ({ page }) => {
    await page.goto('/docs/getting-started/overview');
    await expect(page.getByRole('heading', { level: 1, name: 'Framework Overview' })).toBeVisible();
    await expect(page.getByText('Framework overview')).toBeVisible();
    await expect(page.getByText('35k+', { exact: true })).toBeVisible();
    await expect(page.getByText('Zero core dependencies')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Why NextRush' })).toBeVisible();
  });
});
